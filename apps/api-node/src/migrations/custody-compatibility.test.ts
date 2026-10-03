import assert from "node:assert/strict";
import test from "node:test";
import { verifyCustodyTimeRemoval } from "./legacy-schema-verification.js";
import { legacyMigrationCompatibility } from "./legacy-migration-compatibility.js";
import type { MigrationConnection } from "./migration-state.js";

test("custody history has one authoritative verifier per version/checksum", () => {
  const keys = legacyMigrationCompatibility.map(entry => entry.version + ":" + entry.checksum);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(legacyMigrationCompatibility.find(entry => entry.version === "055_remove_proposed_time_from_custody.sql")?.verifier, "custody-time-removal");
});

test("custody compatibility rejects an incomplete historical schema", async () => {
  const connection: MigrationConnection = { async query() { return [[], []]; }, release() {}, destroy() {} };
  await assert.rejects(verifyCustodyTimeRemoval(connection), /audited runtime baseline/);
});
