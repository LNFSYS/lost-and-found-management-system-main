import type { MigrationConnection } from "./migration-state.js";

type Column = { t: string; n: string; ty: string; nullable: string; def: string | null; extra: string; gen: string; collation: string | null };
type Index = { t: string; n: string; non_unique: number; seq: number; c: string; prefix: number | null; visible: string };
type ForeignKey = { t: string; n: string; c: string; rt: string; rc: string; rule: string; update_rule: string };
type ColumnSpec = [string, string, boolean, string | null];

const stringColumn = (name: string, type: string, nullable = false, def: string | null = null): ColumnSpec => [name, type, nullable, def];
const columns: Record<string, ColumnSpec[]> = {
  claims: [
    stringColumn("status", "enum('PENDING','CONVERSATION_OPEN','NEED_MORE_INFO','ACCEPTED','REJECTED','CANCELLED')", false, "PENDING"),
    stringColumn("lost_post_id", "char(36)", true), stringColumn("request_key", "varchar(190)", true),
    stringColumn("finder_decision", "enum('PENDING','ACCEPTED','DECLINED')", false, "PENDING"),
    stringColumn("active_pair_key", "varchar(112)", true)
  ],
  claim_participants: [
    stringColumn("claim_id", "char(36)"), stringColumn("user_id", "char(36)"),
    stringColumn("participant_role", "enum('CLAIMANT','FINDER')"),
    stringColumn("consent_status", "enum('PENDING','ACCEPTED','DECLINED')", false, "PENDING"),
    stringColumn("joined_at", "datetime", true),
    stringColumn("created_at", "datetime", false, "CURRENT_TIMESTAMP"),
    stringColumn("updated_at", "datetime", false, "CURRENT_TIMESTAMP")
  ],
  claim_audit_events: [
    stringColumn("id", "char(36)"), stringColumn("claim_id", "char(36)"), stringColumn("actor_id", "char(36)"),
    stringColumn("action", "varchar(60)"), stringColumn("from_status", "varchar(40)", true),
    stringColumn("to_status", "varchar(40)", true), stringColumn("metadata_json", "json", true),
    stringColumn("created_at", "datetime", false, "CURRENT_TIMESTAMP")
  ],
  chat_messages: [stringColumn("client_message_id", "varchar(190)", true)],
  claim_evidence: [stringColumn("uploaded_by", "char(36)", true), stringColumn("media_format", "varchar(10)", true), stringColumn("media_bytes", "int unsigned", true)]
};

const indexes: [string, string, number, string[]][] = [
  ["claims", "uq_claim_active_pair", 0, ["active_pair_key"]],
  ["claims", "uq_claim_request_key", 0, ["claimant_id", "request_key"]],
  ["claims", "idx_claims_lost_post", 1, ["lost_post_id"]],
  ["claims", "idx_claims_finder_decision", 1, ["post_id", "finder_decision"]],
  ["claim_participants", "PRIMARY", 0, ["claim_id", "user_id"]],
  ["claim_participants", "uq_claim_participant_role", 0, ["claim_id", "participant_role"]],
  ["claim_participants", "idx_claim_participants_user", 1, ["user_id", "consent_status"]],
  ["claim_audit_events", "PRIMARY", 0, ["id"]],
  ["claim_audit_events", "idx_claim_audit_claim_created", 1, ["claim_id", "created_at"]],
  ["claim_audit_events", "idx_claim_audit_actor_created", 1, ["actor_id", "created_at"]],
  ["chat_messages", "uq_chat_message_idempotency", 0, ["room_id", "sender_id", "client_message_id"]],
  ["claim_evidence", "idx_claim_evidence_uploader", 1, ["uploaded_by"]]
];
const foreignKeys = [
  ["claims", "fk_claims_lost_post", "lost_post_id", "posts", "id"],
  ["claim_participants", "fk_claim_participants_claim", "claim_id", "claims", "id"],
  ["claim_participants", "fk_claim_participants_user", "user_id", "users", "id"],
  ["claim_audit_events", "fk_claim_audit_claim", "claim_id", "claims", "id"],
  ["claim_audit_events", "fk_claim_audit_actor", "actor_id", "users", "id"],
  ["claim_evidence", "fk_claim_evidence_uploader", "uploaded_by", "users", "id"]
];

function canonicalExpression(expression: string) {
  return expression.toLowerCase().replace(/_utf8mb4/g, "").replace(/\\'/g, "'").replace(/[`\s()]/g, "");
}

export async function verifyClaimConversationSchema(connection: MigrationConnection) {
  const failures: string[] = [];
  const [columnRows] = await connection.query(`SELECT TABLE_NAME AS t, COLUMN_NAME AS n, COLUMN_TYPE AS ty,
    IS_NULLABLE AS nullable, COLUMN_DEFAULT AS def, EXTRA AS extra, GENERATION_EXPRESSION AS gen, COLLATION_NAME AS collation
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`);
  const actualColumns = columnRows as Column[];
  for (const [table, specs] of Object.entries(columns)) {
    for (const [name, type, nullable, def] of specs) {
      const row = actualColumns.find((c) => c.t === table && c.n === name);
      const normalizeDefault = (value: string | null) => value?.replace(/\(\)$/, "").toLowerCase() ?? null;
      if (!row || row.ty.toLowerCase() !== type.toLowerCase() || row.nullable !== (nullable ? "YES" : "NO")
        || normalizeDefault(row.def) !== normalizeDefault(def)) failures.push(`column:${table}.${name}`);
      if (row && /^(char|varchar|enum)/.test(type) && row.collation !== "utf8mb4_unicode_ci") failures.push(`collation:${table}.${name}`);
    }
  }
  const generated = actualColumns.find((c) => c.t === "claims" && c.n === "active_pair_key");
  const expression = "CASE WHEN lost_post_id IS NOT NULL AND status IN ('PENDING','CONVERSATION_OPEN','NEED_MORE_INFO') THEN CONCAT(lost_post_id, ':', post_id, ':', claimant_id) ELSE NULL END";
  if (!generated || !generated.extra.includes("STORED GENERATED") || canonicalExpression(generated.gen) !== canonicalExpression(expression)) {
    failures.push("generated:claims.active_pair_key");
  }
  const updated = actualColumns.find((c) => c.t === "claim_participants" && c.n === "updated_at");
  if (!updated?.extra.toLowerCase().includes("on update current_timestamp")) failures.push("on-update:claim_participants.updated_at");
  const [indexRows] = await connection.query(`SELECT TABLE_NAME AS t, INDEX_NAME AS n, NON_UNIQUE AS non_unique,
    SEQ_IN_INDEX AS seq, COLUMN_NAME AS c, SUB_PART AS prefix, IS_VISIBLE AS visible
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() ORDER BY SEQ_IN_INDEX`);
  for (const [table, name, nonUnique, names] of indexes) {
    const rows = (indexRows as Index[]).filter((r) => r.t === table && r.n === name);
    if (rows.length !== names.length || rows.some((r, i) => r.c !== names[i] || Number(r.non_unique) !== nonUnique || r.prefix !== null || r.visible !== "YES")) {
      failures.push(`index:${table}.${name}`);
    }
  }
  const [fkRows] = await connection.query(`SELECT k.TABLE_NAME AS t, k.CONSTRAINT_NAME AS n, k.COLUMN_NAME AS c,
    k.REFERENCED_TABLE_NAME AS rt, k.REFERENCED_COLUMN_NAME AS rc, r.DELETE_RULE AS rule, r.UPDATE_RULE AS update_rule
    FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
      ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
    WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_SCHEMA=DATABASE()`);
  for (const [t, n, c, rt, rc] of foreignKeys) {
    const rows = (fkRows as ForeignKey[]).filter((row) => row.t === t && row.n === n);
    if (rows.length !== 1 || !rows.some((row) => row.c === c && row.rt === rt && row.rc === rc
      && ["RESTRICT", "NO ACTION"].includes(row.rule) && ["RESTRICT", "NO ACTION"].includes(row.update_rule))) failures.push(`foreign-key:${t}.${n}`);
  }
  const [tables] = await connection.query("SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('claim_participants','claim_audit_events','schema_migrations','schema_migration_attempts')");
  for (const name of ["claim_participants", "claim_audit_events", "schema_migrations"]) {
    if (!(tables as { name: string; engine: string }[]).some((t) => t.name === name && t.engine === "InnoDB")) failures.push(`engine:${name}`);
  }
  if ((tables as { name: string; engine: string }[]).some((t) => t.name === "schema_migration_attempts" && t.engine !== "InnoDB")) failures.push("engine:schema_migration_attempts");
  if (failures.length) throw new Error(`Claim migration schema mismatch: ${failures.join(", ")}`);

  // Migration 045 also backfills participants. Missing rows are not a completed migration.
  const [missing] = await connection.query(`SELECT COUNT(*) AS total FROM claims c JOIN posts p ON p.id=c.post_id
    WHERE NOT EXISTS (SELECT 1 FROM claim_participants cp WHERE cp.claim_id=c.id AND cp.user_id=c.claimant_id AND cp.participant_role='CLAIMANT')
       OR NOT EXISTS (SELECT 1 FROM claim_participants cp WHERE cp.claim_id=c.id AND cp.user_id=p.user_id AND cp.participant_role='FINDER')`);
  if (Number((missing as { total: number }[])[0]?.total) !== 0) throw new Error("Claim migration participant backfill is incomplete");
}
