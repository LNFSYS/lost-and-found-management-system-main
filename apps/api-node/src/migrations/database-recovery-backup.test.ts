import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { encryptBackup, decryptBackup, type RecoveryBackup } from "./database-recovery-backup.js";

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
