import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./migration-runner.js";
import { legacyMigrationCompatibility } from "./legacy-migration-compatibility.js";
import { migrationChecksums, pendingMigrationFiles, readMigrationFiles, validateMigrationState } from "./migration-state.js";
import { type MigrationPool, type LedgerRow, type AttemptRow } from "./migration-state.js";

async function withMigration(sql: string, run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lnfs-migration-test-"));
  await writeFile(path.join(directory, "001_probe.sql"), sql, "utf8");
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

function harness(options: { ledger?: LedgerRow[]; attempts?: AttemptRow[]; fail?: (sql: string) => unknown; locked?: boolean; releaseFails?: boolean } = {}) {
  const events: string[] = [];
  let released = false;
  let destroyed = false;
  const pool: MigrationPool = { async getConnection() { return {
    async query(sql: string): Promise<[unknown, unknown]> {
      events.push(sql);
      const failure = options.fail?.(sql);
      if (failure) throw failure;
      if (sql === "SELECT DATABASE() AS name") return [[{ name: "lnfs_test" }], []];
      if (sql.includes("GET_LOCK")) return [[{ acquired: options.locked ? 0 : 1 }], []];
      if (sql.includes("RELEASE_LOCK")) {
        if (options.releaseFails) throw new Error("release failed");
        return [[{ released: 1 }], []];
      }
      if (sql.includes("information_schema.TABLES")) return [[{ name: "schema_migrations" }, { name: "schema_migration_attempts" }], []];
      if (sql === "SELECT version, checksum FROM schema_migrations ORDER BY version") return [options.ledger ?? [], []];
      if (sql.includes("SELECT version, checksum, status")) return [options.attempts ?? [], []];
      return [[], []];
    },
    release() { released = true; },
    destroy() { destroyed = true; }
  }; } };
  return { pool, events, state: () => ({ released, destroyed }) };
}

test("records ledger and successful attempt atomically after DDL, then releases lock", async () => {
  await withMigration("CREATE TABLE probe (id INT);", async (directory) => {
    const h = harness();
    await runMigrations({ directory, pool: h.pool, log: () => undefined });
    const ddl = h.events.indexOf("CREATE TABLE probe (id INT);");
    const begin = h.events.indexOf("START TRANSACTION");
    const ledger = h.events.findIndex((s) => s.startsWith("INSERT INTO schema_migrations"));
    const commit = h.events.indexOf("COMMIT");
    assert.ok(ddl > -1 && begin > ddl && ledger > begin && commit > ledger);
    assert.ok(h.events.at(-1)?.includes("RELEASE_LOCK"));
    assert.equal(h.state().released, true);
  });
});

test("accepts equivalent LF checksum on CRLF without executing migration DDL", async () => {
  const sql = "CREATE TABLE probe (id INT);\n";
  await withMigration(sql.replaceAll("\n", "\r\n"), async (directory) => {
    const h = harness({ ledger: [{ version: "001_probe.sql", checksum: migrationChecksums(sql).raw }] });
    await runMigrations({ directory, pool: h.pool, log: () => undefined });
    assert.equal(h.events.some((s) => s.startsWith("INSERT INTO")), false);
  });
});

test("rejects unknown legacy version before any DDL or ledger writes", async () => {
  await withMigration("CREATE TABLE probe (id INT);", async (directory) => {
    const h = harness({ ledger: [{ version: "040_peer_claim_conversations.sql", checksum: "old" }] });
    await assert.rejects(runMigrations({ directory, pool: h.pool }), /Unknown applied migration/);
    assert.equal(h.events.some((s) => /^(CREATE|INSERT|UPDATE)/.test(s)), false);
  });
});

test("accepts only the audited Aiven legacy records and maps superseded migrations", async () => {
  const directory = fileURLToPath(new URL("./", import.meta.url));
  const files = await readMigrationFiles(directory);
  const ledger = legacyMigrationCompatibility.map(({ version, checksum }) => ({ version, checksum }));
  const attempts = legacyMigrationCompatibility.map(({ version, checksum }) => ({ version, checksum, status: "APPLIED" }));
  const matches = validateMigrationState(files, { ledger, attempts }, legacyMigrationCompatibility);
  const pending = pendingMigrationFiles(files, { ledger, attempts }, matches).map((file) => file.version);
  assert.ok(!pending.includes("045_peer_claim_conversations.sql"));
  assert.ok(!pending.includes("049_realtime_claim_chat_contract.sql"));
  assert.ok(!pending.includes("050_notification_type_text_contract.sql"));
  assert.deepEqual(new Set(matches.map((match) => match.version)), new Set(ledger.map((row) => row.version)));
});

test("accepts verified legacy and canonical claim records together but rejects any other checksum", async () => {
  const directory = fileURLToPath(new URL("./", import.meta.url));
  const files = await readMigrationFiles(directory);
  const old = legacyMigrationCompatibility.find((entry) => entry.version === "040_peer_claim_conversations.sql")!;
  const current = legacyMigrationCompatibility.find((entry) => entry.version === "045_peer_claim_conversations.sql")!;
  const state: { ledger: LedgerRow[]; attempts: AttemptRow[] } = {
    ledger: [{ version: old.version, checksum: old.checksum }, { version: current.version, checksum: current.checksum }],
    attempts: [{ version: old.version, checksum: old.checksum, status: "APPLIED" }, { version: current.version, checksum: current.checksum, status: "APPLIED" }]
  };
  assert.doesNotThrow(() => validateMigrationState(files, state, legacyMigrationCompatibility));
  state.ledger[1] = { ...state.ledger[1], checksum: "0".repeat(64) };
  await assert.rejects(async () => validateMigrationState(files, state, legacyMigrationCompatibility), /checksum mismatch/);
});

test("preflights later checksum mismatches before earlier pending migrations", async () => {
  await withMigration("CREATE TABLE probe (id INT);", async (directory) => {
    await writeFile(path.join(directory, "002_later.sql"), "SELECT 1;");
    const h = harness({ ledger: [{ version: "002_later.sql", checksum: "bad" }] });
    await assert.rejects(runMigrations({ directory, pool: h.pool }), /checksum mismatch/);
    assert.equal(h.events.some((s) => /^(CREATE|INSERT|UPDATE)/.test(s)), false);
  });
});

test("records a failed statement without logging private SQL values", async () => {
  await withMigration("CREATE TABLE probe (id INT);", async (directory) => {
    const h = harness({ fail: (sql) => sql === "CREATE TABLE probe (id INT);" ? Object.assign(new Error("private-value"), { index: 1 }) : null });
    await assert.rejects(runMigrations({ directory, pool: h.pool }), (error: unknown) => {
      assert.match(String(error), /failed at statement 2/);
      assert.doesNotMatch(String(error), /private-value/);
      return true;
    });
    assert.ok(h.events.some((s) => s.includes("SET status = 'FAILED'")));
    assert.ok(h.events.includes("ROLLBACK"));
    assert.equal(h.state().released, true);
  });
});

test("blocks incomplete attempts and concurrent migration owner", async () => {
  const sql = "SELECT 1;";
  await withMigration(sql, async (directory) => {
    const h = harness({ attempts: [{ version: "001_probe.sql", checksum: migrationChecksums(sql).raw, status: "FAILED" }] });
    await assert.rejects(runMigrations({ directory, pool: h.pool }), /incomplete attempt/);
    assert.equal(h.events.some((s) => s.startsWith("CREATE")), false);
    const busy = harness({ locked: true });
    await assert.rejects(runMigrations({ directory, pool: busy.pool }), /database lock/);
    assert.equal(busy.events.some((s) => s.includes("schema_migrations")), false);
  });
});

test("destroys pooled session if named lock release fails", async () => {
  await withMigration("SELECT 1;", async (directory) => {
    const h = harness({ releaseFails: true });
    await assert.rejects(runMigrations({ directory, pool: h.pool, log: () => undefined }), /release failed/);
    assert.deepEqual(h.state(), { released: false, destroyed: true });
  });
});

test("forward feedback migration preserves reviewer FK before removing legacy index", async () => {
  const migration = await readFile(new URL("./046_feedback_idempotency_legacy_cleanup.sql", import.meta.url), "utf8");
  assert.match(migration, /@legacy_feedback_idempotency_exists\s*>\s*0/);
  assert.match(migration, /CREATE INDEX idx_return_feedback_reviewer_fk_support ON return_feedback \(reviewer_id\)/);
  assert.ok(migration.indexOf("CREATE INDEX idx_return_feedback_reviewer_fk_support") < migration.indexOf("DROP INDEX uq_return_feedback_reviewer_idempotency"));
});

test("legacy bulk-checksum repair refuses apply before opening a database connection", async () => {
  const script = fileURLToPath(new URL("../../../../scripts/repair-migration-checksums.mjs", import.meta.url));
  await assert.rejects(promisify(execFile)(process.execPath, [script, "--apply"], { env: { ...process.env, DB_HOST: "127.0.0.1", DB_PORT: "1" } }), (error: unknown) => {
    const failure = error as { code: number; stderr: string };
    assert.equal(failure.code, 1);
    assert.match(failure.stderr, /Bulk checksum rewriting is disabled/);
    assert.doesNotMatch(failure.stderr, /ECONNREFUSED/);
    return true;
  });
});
