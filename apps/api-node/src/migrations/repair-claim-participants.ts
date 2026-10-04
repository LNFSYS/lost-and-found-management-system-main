import { createDatabasePool } from "../shared/infrastructure/config/db.js";
import { runInTransaction } from "../shared/infrastructure/config/db.js";

type CountRow = { total: number };

/**
 * Repairs legacy claims created before participant rows were consistently
 * backfilled. The statements are idempotent and only add missing rows.
 */
async function repair() {
  const pool = createDatabasePool();
  const connection = await pool.getConnection();
  try {
    const result = await runInTransaction(connection, async (transaction) => {
      const [beforeRows] = await transaction.query(`
        SELECT COUNT(*) AS total FROM claims c JOIN posts p ON p.id = c.post_id
        WHERE NOT EXISTS (
          SELECT 1 FROM claim_participants cp
          WHERE cp.claim_id = c.id AND cp.user_id = c.claimant_id AND cp.participant_role = 'CLAIMANT'
        ) OR (p.user_id <> c.claimant_id AND NOT EXISTS (
          SELECT 1 FROM claim_participants cp
          WHERE cp.claim_id = c.id AND cp.user_id = p.user_id AND cp.participant_role = 'FINDER'
        ))`);

      await transaction.query(`
        INSERT IGNORE INTO claim_participants
          (claim_id, user_id, participant_role, consent_status, joined_at)
        SELECT c.id, c.claimant_id, 'CLAIMANT', 'ACCEPTED', c.created_at
        FROM claims c`);
      await transaction.query(`
        INSERT IGNORE INTO claim_participants
          (claim_id, user_id, participant_role, consent_status, joined_at)
        SELECT c.id, found.user_id, 'FINDER',
          CASE
            WHEN c.status IN ('CONVERSATION_OPEN', 'NEED_MORE_INFO', 'ACCEPTED') THEN 'ACCEPTED'
            WHEN c.status = 'REJECTED' THEN 'DECLINED'
            ELSE 'PENDING'
          END,
          CASE WHEN c.status IN ('CONVERSATION_OPEN', 'NEED_MORE_INFO', 'ACCEPTED') THEN c.accepted_at ELSE NULL END
        FROM claims c
        INNER JOIN posts found ON found.id = c.post_id`);

      const [afterRows] = await transaction.query(`
        SELECT COUNT(*) AS total FROM claims c JOIN posts p ON p.id = c.post_id
        WHERE NOT EXISTS (
          SELECT 1 FROM claim_participants cp
          WHERE cp.claim_id = c.id AND cp.user_id = c.claimant_id AND cp.participant_role = 'CLAIMANT'
        ) OR (p.user_id <> c.claimant_id AND NOT EXISTS (
          SELECT 1 FROM claim_participants cp
          WHERE cp.claim_id = c.id AND cp.user_id = p.user_id AND cp.participant_role = 'FINDER'
        ))`);
      const [unresolvedRows] = await transaction.query(`
        SELECT c.id, c.claimant_id, p.user_id AS finder_id,
          NOT EXISTS (
            SELECT 1 FROM claim_participants cp
            WHERE cp.claim_id = c.id AND cp.user_id = c.claimant_id AND cp.participant_role = 'CLAIMANT'
          ) AS missing_claimant,
          NOT EXISTS (
            SELECT 1 FROM claim_participants cp
            WHERE cp.claim_id = c.id AND cp.user_id = p.user_id AND cp.participant_role = 'FINDER'
          ) AS missing_finder
        FROM claims c JOIN posts p ON p.id = c.post_id
        WHERE NOT EXISTS (
          SELECT 1 FROM claim_participants cp
          WHERE cp.claim_id = c.id AND cp.user_id = c.claimant_id AND cp.participant_role = 'CLAIMANT'
        ) OR (p.user_id <> c.claimant_id AND NOT EXISTS (
          SELECT 1 FROM claim_participants cp
          WHERE cp.claim_id = c.id AND cp.user_id = p.user_id AND cp.participant_role = 'FINDER'
        )) LIMIT 20`);
      return {
        before: Number((beforeRows as CountRow[])[0]?.total ?? 0),
        after: Number((afterRows as CountRow[])[0]?.total ?? 0),
        unresolved: unresolvedRows
      };
    });
    console.info(JSON.stringify({ status: result.after === 0 ? "repaired" : "incomplete", ...result }));
    if (result.after !== 0) process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

repair().catch((error: unknown) => {
  const databaseError = error as { code?: unknown };
  console.error("Claim participant repair failed", typeof databaseError.code === "string"
    ? databaseError.code : error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
