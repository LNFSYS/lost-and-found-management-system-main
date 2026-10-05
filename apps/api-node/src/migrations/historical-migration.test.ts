import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { legacyMigrationCompatibility } from "./legacy-migration-compatibility.js";
import { migrationChecksums, readMigrationFiles } from "./migration-state.js";

test("original historical 053 matches the ledger but is excluded from forward migrations", async () => {
  const original = await readFile(new URL("./historical/053_custody_and_guarded_disposition.sql", import.meta.url), "utf8");
  const record = legacyMigrationCompatibility.find(entry => entry.version === "053_custody_and_guarded_disposition.sql")!;
  assert.equal(migrationChecksums(original).normalized, record.checksum);
  const runnable = await readMigrationFiles(fileURLToPath(new URL("./", import.meta.url)));
  assert.equal(runnable.length, 58);
  assert.equal(runnable.some(file => file.version === record.version), false);
});
