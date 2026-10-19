import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { legacyMigrationCompatibility } from "./legacy-migration-compatibility.js";
import { migrationChecksums, readMigrationFiles } from "./migration-state.js";

test("original historical 053 matches the ledger but is excluded from forward migrations", async () => {
  const original = await readFile(new URL("./historical/053_custody_and_guarded_disposition.sql", import.meta.url), "utf8");
  const record = legacyMigrationCompatibility.find(entry => entry.version === "053_custody_and_guarded_disposition.sql")!;
  assert.equal(migrationChecksums(original).normalized, record.checksum);
  const directory = fileURLToPath(new URL("./", import.meta.url));
  const runnable = await readMigrationFiles(directory);
  const forwardFiles = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
  assert.deepEqual(runnable.map(file => file.version), forwardFiles);
  assert.ok(runnable.some(file => file.version === "063_appointment_workflow.sql"));
  assert.equal(runnable.some(file => file.version === record.version), false);
});
