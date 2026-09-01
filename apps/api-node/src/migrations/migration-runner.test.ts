import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runMigrations, type MigrationPool } from "./migration-runner.js";

async function withMigration(sql: string, run: (directory: string, file: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lnfs-migration-test-"));
  const file = "001_probe.sql";
  await writeFile(path.join(directory, file), sql, "utf8");
  try {
    await run(directory, file);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("records a checksum only after the complete migration query succeeds", async () => {
  await withMigration("CREATE TABLE probe (id INT);", async (directory, file) => {
    const events: string[] = [];
    let released = false;
    const pool: MigrationPool = {
      async query(sql) {
        events.push(`pool:${sql.replace(/\s+/g, " ").trim()}`);
        if (sql.startsWith("SELECT checksum FROM schema_migrations")) return [[], []];
        if (sql.startsWith("SELECT checksum, status FROM schema_migration_attempts")) return [[], []];
        return [[], []];
      },
      async getConnection() {
        return {
          async query(sql) { events.push(`connection:${sql}`); return [[], []]; },
          release() { released = true; }
        };
      }
    };

    await runMigrations({ directory, pool, log: (message) => events.push(message) });

    const migrationIndex = events.indexOf("connection:CREATE TABLE probe (id INT);");
    const checksumIndex = events.findIndex((event) => event.startsWith("connection:INSERT INTO schema_migrations"));
    assert.ok(migrationIndex >= 0);
    assert.ok(checksumIndex > migrationIndex);
    assert.ok(events.includes(`Applied migration ${file}`));
    assert.equal(released, true);
  });
});

test("accepts an equivalent LF checksum for a CRLF migration file", async () => {
  const lfSql = "CREATE TABLE probe (id INT);\n";
  const crlfSql = lfSql.replaceAll("\n", "\r\n");
  await withMigration(crlfSql, async (directory, file) => {
    const events: string[] = [];
    let requestedConnection = false;
    const lfChecksum = createHash("sha256").update(lfSql).digest("hex");
    const pool: MigrationPool = {
      async query(sql) {
        events.push(sql);
        if (sql.startsWith("SELECT checksum FROM schema_migrations")) return [[{ checksum: lfChecksum }], []];
        if (sql.startsWith("SELECT checksum, status FROM schema_migration_attempts")) return [[], []];
        return [[], []];
      },
      async getConnection() {
        requestedConnection = true;
        throw new Error("must not execute an already-applied migration");
      }
    };

    await runMigrations({ directory, pool, log: () => undefined });

    assert.equal(requestedConnection, false);
    assert.equal(events.some((event) => event.includes("INSERT INTO schema_migration_attempts")), false);
    assert.equal(file, "001_probe.sql");
  });
});

test("marks a failed migration with its statement index and recovery guidance", async () => {
  await withMigration("CREATE TABLE probe (id INT); ALTER TABLE probe ADD value INT;", async (directory, file) => {
    const poolEvents: string[] = [];
    let released = false;
    const failure = Object.assign(new Error("duplicate column"), { index: 1, code: "ER_DUP_FIELDNAME" });
    const pool: MigrationPool = {
      async query(sql) {
        poolEvents.push(sql.replace(/\s+/g, " ").trim());
        if (sql.startsWith("SELECT checksum FROM schema_migrations")) return [[], []];
        if (sql.startsWith("SELECT checksum, status FROM schema_migration_attempts")) return [[], []];
        return [[], []];
      },
      async getConnection() {
        return {
          async query(sql) {
            if (sql.startsWith("CREATE TABLE probe")) throw failure;
            return [[], []];
          },
          release() { released = true; }
        };
      }
    };

    await assert.rejects(
      runMigrations({ directory, pool, log: () => undefined }),
      new RegExp(`Migration ${file} failed at statement 2.*Inspect the database for partially applied DDL`)
    );
    assert.ok(poolEvents.some((sql) => sql.startsWith("UPDATE schema_migration_attempts SET status = 'FAILED'")));
    assert.equal(released, true);
  });
});

test("blocks an automatic retry when a prior attempt was not fully recorded", async () => {
  const sql = "CREATE TABLE probe (id INT);";
  await withMigration(sql, async (directory, file) => {
    const checksum = createHash("sha256").update(sql).digest("hex");
    let requestedConnection = false;
    const pool: MigrationPool = {
      async query(query) {
        if (query.startsWith("SELECT checksum FROM schema_migrations")) return [[], []];
        if (query.startsWith("SELECT checksum, status FROM schema_migration_attempts")) {
          return [[{ checksum, status: "FAILED" }], []];
        }
        return [[], []];
      },
      async getConnection() {
        requestedConnection = true;
        throw new Error("must not execute");
      }
    };

    await assert.rejects(runMigrations({ directory, pool }), (error: unknown) => (
      error instanceof Error && error.message.includes(`Migration ${file} has an incomplete attempt (FAILED)`)
    ));
    assert.equal(requestedConnection, false);
  });
});
