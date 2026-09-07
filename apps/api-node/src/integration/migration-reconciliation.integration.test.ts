import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runMigrations } from "../migrations/migration-runner.js";
import { migrationLockName, readMigrationFiles, type MigrationPool } from "../migrations/migration-state.js";
import { canonicalClaimVersion, legacyClaimVersion, reconcileClaimMigration } from "../migrations/reconcile-claim-migration.js";
import { claimRepository } from "../repositories/claim.repository.js";
import { returnFeedbackRepository } from "../repositories/return-feedback.repository.js";
import { createReturnFeedbackService } from "../services/return-feedback.service.js";
import { runInTransaction } from "../config/db.js";

const enabled = process.env.LNFS_DB_INTEGRATION === "1";
const directory = fileURLToPath(new URL("../migrations/", import.meta.url));
const silent = () => undefined;
const asMigrationPool = (pool: Pool) => pool as unknown as MigrationPool;

function isolatedOptions() {
  const host = process.env.LNFS_TEST_DB_HOST ?? "";
  if (!["127.0.0.1", "localhost", "::1"].includes(host) || !process.env.LNFS_TEST_DB_NAME?.endsWith("_test")) {
    throw new Error("Migration tests require explicit loopback host and *_test database; shared Aiven is forbidden");
  }
  if (!process.env.LNFS_TEST_DB_USER || !process.env.LNFS_TEST_DB_PASSWORD) throw new Error("Explicit isolated MySQL test credentials required");
  return { host, port: Number(process.env.LNFS_TEST_DB_PORT ?? 3306), user: process.env.LNFS_TEST_DB_USER,
    password: process.env.LNFS_TEST_DB_PASSWORD, multipleStatements: true, timezone: "Z", connectionLimit: 5 };
}

async function fixture(pool: Pool, legacy = false) {
  const finder = randomUUID(), owner = randomUUID(), outsider = randomUUID();
  for (const id of [finder, owner, outsider]) await pool.execute(
    "INSERT INTO users (id,email,normalized_email,password_hash,full_name,email_verified_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP())",
    [id, `${id}@example.invalid`, `${id}@example.invalid`, "test-only-hash", "Schema fixture"]
  );
  const found = randomUUID(), lost = randomUUID();
  for (const [id, user, type] of [[found, finder, "FOUND"], [lost, owner, "LOST"]]) await pool.execute(
    "INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized) VALUES (?,?,?,'Fixture','fixture','Fixture','fixture')", [id, user, type]
  );
  const claim = randomUUID();
  if (legacy) await pool.execute("INSERT INTO claims (id,post_id,claimant_id,status) VALUES (?,?,?,'PENDING')", [claim, found, owner]);
  else {
    await pool.execute("INSERT INTO claims (id,post_id,lost_post_id,claimant_id,status,finder_decision) VALUES (?,?,?,?,'CONVERSATION_OPEN','ACCEPTED')", [claim, found, lost, owner]);
    await pool.execute("INSERT INTO claim_participants (claim_id,user_id,participant_role,consent_status) VALUES (?,?,'CLAIMANT','ACCEPTED'), (?,?,'FINDER','ACCEPTED')", [claim, owner, claim, finder]);
  }
  return { finder, owner, outsider, found, lost, claim };
}

test("isolated MySQL: fresh/legacy migration reconciliation and runtime contracts", {
  skip: enabled ? false : "Requires LNFS_DB_INTEGRATION=1 and isolated LNFS_TEST_DB_*"
}, async (t) => {
  const options = isolatedOptions();
  const admin = mysql.createPool(options);
  const databases: string[] = [];
  const pools: Pool[] = [];
  const tempDirs: string[] = [];
  const files = await readMigrationFiles(directory);
  async function newDatabase() {
    const name = `lnfs_reconcile_${randomUUID().replaceAll("-", "")}_test`;
    assert.match(name, /^lnfs_reconcile_[a-f0-9]{32}_test$/);
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    databases.push(name);
    const pool = mysql.createPool({ ...options, database: name });
    pools.push(pool);
    return { pool, name };
  }
  async function migrationDirectory(until: number, alias = false) {
    const dir = await mkdtemp(path.join(os.tmpdir(), "lnfs-reconciliation-test-"));
    tempDirs.push(dir);
    for (const file of files.filter((f) => Number(f.version.slice(0, 3)) <= until)) {
      await writeFile(path.join(dir, alias && file.version === canonicalClaimVersion ? legacyClaimVersion : file.version), file.sql);
    }
    return dir;
  }
  const inspect = async (pool: Pool, apply = false, name?: string) => reconcileClaimMigration({ directory, pool: asMigrationPool(pool), apply, expectedDatabase: name });
  try {
    await t.test("fresh migrations run twice; all checksums, feedback indexes and FKs remain valid", async () => {
      const { pool, name } = await newDatabase();
      await runMigrations({ directory, pool: asMigrationPool(pool), log: silent });
      await runMigrations({ directory, pool: asMigrationPool(pool), log: silent });
      const [ledger] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM schema_migrations");
      assert.equal(Number(ledger[0].total), files.length);
      assert.equal((await inspect(pool, true, name)).after, "ALREADY_CANONICAL");
      const [indexes] = await pool.query<RowDataPacket[]>("SELECT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='return_feedback'");
      assert.ok(indexes.some((r) => r.name === "uq_return_feedback_appointment_reviewer_idempotency"));
      assert.ok(!indexes.some((r) => r.name === "uq_return_feedback_reviewer_idempotency"));
      const [fk] = await pool.query<RowDataPacket[]>("SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME='fk_return_feedback_reviewer'");
      assert.equal(fk.length, 1);
      await exerciseRuntime(pool);
    });

    await t.test("old alias blocks runner before 043; dry-run writes nothing; rename preserves history and data", async () => {
      const { pool, name } = await newDatabase();
      const beforeAlias = await migrationDirectory(42);
      await runMigrations({ directory: beforeAlias, pool: asMigrationPool(pool), log: silent });
      const data = await fixture(pool, true);
      const oldDir = await migrationDirectory(42);
      await writeFile(path.join(oldDir, legacyClaimVersion), files.find((f) => f.version === canonicalClaimVersion)!.sql);
      await runMigrations({ directory: oldDir, pool: asMigrationPool(pool), log: silent });
      const [before] = await pool.query<RowDataPacket[]>("SELECT * FROM schema_migrations ORDER BY version");
      await assert.rejects(runMigrations({ directory, pool: asMigrationPool(pool), log: silent }), /Unknown applied migration/);
      await assert.rejects(pool.query("SELECT idempotency_key FROM return_feedback LIMIT 0"), { code: "ER_BAD_FIELD_ERROR" });
      assert.equal((await inspect(pool)).after, "READY");
      const [afterDryRun] = await pool.query("SELECT * FROM schema_migrations ORDER BY version");
      assert.deepEqual(afterDryRun, before);
      await assert.rejects(inspect(pool, true, "wrong_test"), /target/);
      const interrupted: MigrationPool = { async getConnection() {
        const real = await pool.getConnection();
        return {
          async query(sql, values) {
            if (sql.startsWith("UPDATE schema_migration_attempts SET version")) throw new Error("simulated ledger write failure");
            return real.query(sql, values);
          },
          release: () => real.release(), destroy: () => real.destroy()
        };
      } };
      await assert.rejects(reconcileClaimMigration({ directory, pool: interrupted, apply: true, expectedDatabase: name }), /simulated ledger write failure/);
      const [afterRollback] = await pool.query("SELECT * FROM schema_migrations ORDER BY version");
      assert.deepEqual(afterRollback, before);
      assert.equal((await inspect(pool, true, name)).after, "ALREADY_CANONICAL");
      assert.equal((await inspect(pool, true, name)).after, "ALREADY_CANONICAL");
      await pool.execute("UPDATE schema_migration_attempts SET version=? WHERE version=?", [legacyClaimVersion, canonicalClaimVersion]);
      await assert.rejects(inspect(pool), /Legacy attempt has no matching legacy ledger/);
      await pool.execute("UPDATE schema_migration_attempts SET version=? WHERE version=?", [canonicalClaimVersion, legacyClaimVersion]);
      const [canonical] = await pool.execute<RowDataPacket[]>("SELECT * FROM schema_migrations WHERE version=?", [canonicalClaimVersion]);
      const original = before.find((r) => r.version === legacyClaimVersion)!;
      assert.equal(canonical[0].checksum, original.checksum);
      assert.deepEqual(canonical[0].applied_at, original.applied_at);
      await runMigrations({ directory, pool: asMigrationPool(pool), log: silent });
      await runMigrations({ directory, pool: asMigrationPool(pool), log: silent });
      const [claims] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM claims WHERE id=?", [data.claim]);
      assert.equal(Number(claims[0].total), 1);
      const [participants] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM claim_participants WHERE claim_id=?", [data.claim]);
      assert.equal(Number(participants[0].total), 2);
      const [attempts] = await pool.query<RowDataPacket[]>("SELECT version,status FROM schema_migration_attempts");
      assert.ok(!attempts.some((r) => r.version === legacyClaimVersion || r.status !== "APPLIED"));
    });

    await t.test("partial schema, wrong checksum and incomplete backfill never become APPLIED", async () => {
      const { pool, name } = await newDatabase();
      const oldDir = await migrationDirectory(45, true);
      await runMigrations({ directory: oldDir, pool: asMigrationPool(pool), log: silent });
      await pool.query("ALTER TABLE claim_evidence DROP COLUMN media_bytes");
      await assert.rejects(inspect(pool, true, name), /schema mismatch/);
      await pool.query("ALTER TABLE claim_evidence ADD COLUMN media_bytes INT UNSIGNED NULL AFTER media_format");
      await pool.query("ALTER TABLE claims DROP INDEX uq_claim_active_pair");
      await assert.rejects(inspect(pool, true, name), /index:claims.uq_claim_active_pair/);
      await pool.query("CREATE UNIQUE INDEX uq_claim_active_pair ON claims(active_pair_key)");
      await pool.query("ALTER TABLE claims DROP FOREIGN KEY fk_claims_lost_post");
      await assert.rejects(inspect(pool, true, name), /foreign-key:claims.fk_claims_lost_post/);
      await pool.query("ALTER TABLE claims ADD CONSTRAINT fk_claims_lost_post FOREIGN KEY(lost_post_id) REFERENCES posts(id)");
      await pool.execute("UPDATE schema_migrations SET checksum=? WHERE version=?", ["0".repeat(64), legacyClaimVersion]);
      await assert.rejects(inspect(pool, true, name), /checksum mismatch/);
      await pool.execute("UPDATE schema_migrations SET checksum=? WHERE version=?", [files.find((f) => f.version === canonicalClaimVersion)!.raw, legacyClaimVersion]);
      const data = await fixture(pool);
      await pool.execute("DELETE FROM claim_participants WHERE claim_id=? AND user_id=?", [data.claim, data.finder]);
      await assert.rejects(inspect(pool, true, name), /backfill is incomplete/);
      const [ledger] = await pool.execute<RowDataPacket[]>("SELECT version FROM schema_migrations WHERE version IN (?,?)", [legacyClaimVersion, canonicalClaimVersion]);
      assert.deepEqual(ledger.map((r) => r.version), [legacyClaimVersion]);
    });

    await t.test("migration/reconciliation share the same session lock; concurrent owner cannot write", async () => {
      const { pool, name } = await newDatabase();
      const holder = await pool.getConnection();
      try {
        await holder.query("SELECT GET_LOCK(?,0)", [migrationLockName(name)]);
        const results = await Promise.allSettled([
          runMigrations({ directory, pool: asMigrationPool(pool), log: silent }), inspect(pool, true, name)
        ]);
        for (const result of results) {
          assert.equal(result.status, "rejected");
          if (result.status === "rejected") assert.match(String(result.reason), /database lock/);
        }
        const [tables] = await pool.query<RowDataPacket[]>("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()");
        assert.equal(tables.length, 0);
        await holder.query("COMMIT");
        await assert.rejects(runMigrations({ directory, pool: asMigrationPool(pool), log: silent }), /database lock/);
      } finally { await holder.query("SELECT RELEASE_LOCK(?)", [migrationLockName(name)]); holder.release(); }
      await runMigrations({ directory, pool: asMigrationPool(pool), log: silent });
    });

    await t.test("partial DDL persists a FAILED attempt and blocks rerun before further writes", async () => {
      const { pool } = await newDatabase();
      const dir = await migrationDirectory(0);
      await writeFile(path.join(dir, "001_partial.sql"), "CREATE TABLE partial_probe (id INT PRIMARY KEY); ALTER TABLE partial_probe ADD id INT;");
      await assert.rejects(runMigrations({ directory: dir, pool: asMigrationPool(pool), log: silent }), /failed at/);
      const [attempt] = await pool.query<RowDataPacket[]>("SELECT status FROM schema_migration_attempts");
      assert.equal(attempt[0].status, "FAILED");
      const [ledger] = await pool.query<RowDataPacket[]>("SELECT version FROM schema_migrations");
      assert.equal(ledger.length, 0);
      await assert.rejects(runMigrations({ directory: dir, pool: asMigrationPool(pool), log: silent }), /incomplete attempt/);
      await pool.query("SELECT id FROM partial_probe LIMIT 0");
    });
  } finally {
    for (const pool of pools) await pool.end();
    // Only databases created by this test run, on the validated loopback connection.
    for (const name of databases) { assert.match(name, /^lnfs_reconcile_[a-f0-9]{32}_test$/); await admin.query(`DROP DATABASE \`${name}\``); }
    await admin.end();
    for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
  }
});

async function exerciseRuntime(pool: Pool) {
  const data = await fixture(pool);
  const room = await claimRepository.createRoom(data.claim, pool);
  assert.ok(await claimRepository.findRoomForParticipant(room.id, data.owner, pool));
  assert.equal(await claimRepository.findRoomForParticipant(room.id, data.outsider, pool), null);
  const messages = await Promise.all(Array.from({ length: 4 }, () => claimRepository.createMessage({ roomId: room.id, senderId: data.owner, content: "Synthetic test message", clientMessageId: "retry-key" }, pool)));
  assert.equal(new Set(messages.map((m) => m?.id)).size, 1);
  const [count] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM chat_messages");
  assert.equal(Number(count[0].total), 1);

  const contenders = [randomUUID(), randomUUID()];
  await pool.execute("INSERT INTO claims (id,post_id,claimant_id) VALUES (?,?,?)", [contenders[0], data.found, data.finder]);
  await pool.execute("INSERT INTO claims (id,post_id,claimant_id) VALUES (?,?,?)", [contenders[1], data.found, data.outsider]);
  const results = await Promise.allSettled(contenders.map((id) => pool.execute("UPDATE claims SET status='ACCEPTED' WHERE id=?", [id])));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const rejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  assert.equal(rejected?.reason.code, "ER_DUP_ENTRY");

  const appointments = [randomUUID(), randomUUID()];
  const active = await Promise.allSettled(appointments.map((id) => pool.execute("INSERT INTO return_appointments (id,claim_id,post_id,proposer_id,proposed_at) VALUES (?,?,?,?,UTC_TIMESTAMP())", [id, data.claim, data.found, data.finder])));
  assert.equal(active.filter((r) => r.status === "fulfilled").length, 1);
  for (const result of active) if (result.status === "rejected") assert.equal(result.reason.code, "ER_DUP_ENTRY");
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM return_appointments");
  const appointmentId = rows[0].id as string;
  await pool.execute("UPDATE return_appointments SET status='COMPLETED',completed_at=UTC_TIMESTAMP(),finder_confirmed_at=UTC_TIMESTAMP(),owner_confirmed_at=UTC_TIMESTAMP() WHERE id=?", [appointmentId]);
  const service = createReturnFeedbackService({ repository: returnFeedbackRepository, runInTransaction: async (work) => {
    const c = await pool.getConnection();
    try { return await runInTransaction(c, work); } finally { c.release(); }
  } });
  const viewer = { sub: data.owner, email: "fixture@example.invalid", roles: ["USER" as const], sessionVersion: 1 };
  await assert.rejects(service.submitFeedback(appointmentId, { rating: 5, comment: null, idempotencyKey: "outsider" }, { ...viewer, sub: data.outsider }), (e: unknown) => (e as { status: number }).status === 403);
  const feedback = await Promise.allSettled(Array.from({ length: 3 }, () => service.submitFeedback(appointmentId, { rating: 5, comment: "Test", idempotencyKey: "feedback-retry" }, viewer)));
  for (const result of feedback) {
    if (result.status === "rejected") throw result.reason;
  }
  const [feedbackCount] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM return_feedback");
  const [reputationCount] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM reputation_logs");
  assert.equal(Number(feedbackCount[0].total), 1);
  assert.equal(Number(reputationCount[0].total), 1);
  assert.equal((await returnFeedbackRepository.findAppointmentForFeedback(appointmentId, pool))?.ownerConfirmedAt !== null, true);
  const nextAppointment = randomUUID();
  await pool.execute("INSERT INTO return_appointments (id,claim_id,post_id,proposer_id,proposed_at,status,completed_at,finder_confirmed_at) VALUES (?,?,?,?,UTC_TIMESTAMP(),'COMPLETED',UTC_TIMESTAMP(),UTC_TIMESTAMP())", [nextAppointment, data.claim, data.found, data.finder]);
  await assert.rejects(service.submitFeedback(nextAppointment, { rating: 5, comment: null, idempotencyKey: "feedback-retry" }, viewer), (e: unknown) => (e as { status: number }).status === 409);
  await pool.execute("UPDATE return_appointments SET owner_confirmed_at=UTC_TIMESTAMP() WHERE id=?", [nextAppointment]);
  const secondReturn = await service.submitFeedback(nextAppointment, { rating: 5, comment: null, idempotencyKey: "feedback-retry" }, viewer);
  assert.equal(secondReturn.idempotent, false);
  const [secondFeedbackCount] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM return_feedback");
  assert.equal(Number(secondFeedbackCount[0].total), 2);
}
