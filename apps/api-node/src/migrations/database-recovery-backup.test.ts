import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { captureRecoveryBackup, encryptBackup, decryptBackup, type RecoveryBackup } from "./database-recovery-backup.js";

test("recovery backup encrypts and authenticates schema/data without plaintext leakage", () => {
  const key = randomBytes(32);
  const backup: RecoveryBackup = { format: "lnfs-recovery-v1", database: "fixture_test", capturedAt: "2026-10-02T00:00:00Z",
    tables: [{ name: "fixture", ddl: "CREATE TABLE fixture(id INT)", columns: ["id", "value"], rows: [[1, "private-test-value"]] }] };
  const bytes = encryptBackup(backup, key);
  assert.equal(bytes.includes(Buffer.from("private-test-value")), false);
  assert.deepEqual(decryptBackup(bytes, key), backup);
  assert.throws(() => decryptBackup(bytes, randomBytes(32)));
  const tampered = Buffer.from(bytes); tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decryptBackup(tampered, key));
});

test("backup capture restores ANSI, quoting and timezone even when reading DDL fails", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let released = false;
  const failure = new Error("DDL unavailable");
  const connection = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (sql.includes("@@SESSION.time_zone")) return [[{ zone: "+07:00" }]];
      if (sql.includes("@@SESSION.sql_mode")) return [[{ mode: "ANSI,STRICT_ALL_TABLES", quoted: 0 }]];
      if (sql.includes("SELECT DATABASE()")) return [[{ name: "fixture_test" }]];
      if (sql.includes("information_schema.TABLES")) return [[{ name: "fixture", type: "BASE TABLE", engine: "InnoDB" }]];
      if (sql.includes("SHOW CREATE TABLE")) throw failure;
      return [[]];
    },
    release() { released = true; },
    destroy() { assert.fail("A successful session restore must not destroy the connection"); }
  };
  await assert.rejects(captureRecoveryBackup({ getConnection: async () => connection } as unknown as Pool), failure);
  assert.ok(calls.some(call => call.sql === "SET SESSION sql_mode='', sql_quote_show_create=1"));
  assert.ok(calls.some(call => call.sql === "ROLLBACK"));
  assert.deepEqual(calls.find(call => call.sql === "SET SESSION sql_mode=?, sql_quote_show_create=?")?.values, ["ANSI,STRICT_ALL_TABLES", 0]);
  assert.deepEqual(calls.find(call => call.sql === "SET SESSION time_zone=?")?.values, ["+07:00"]);
  assert.equal(released, true);
});
