import assert from "node:assert/strict";
import test from "node:test";
import { verifyCustodyWithoutProposedTime } from "./legacy-schema-verification.js";
import type { MigrationConnection } from "./migration-state.js";

function connection(columns: { name: string; type: string }[]): MigrationConnection {
  return { async query() { return [columns, []]; }, release() {}, destroy() {} };
}
const expected = [
  { name: "id", type: "char(36)" },
  { name: "post_id", type: "char(36)" },
  { name: "status", type: "enum('PENDING','ACCEPTED','REJECTED','CANCELLED','INTAKED')" }
];

test("custody compatibility requires the table and verifies removal of proposed_time", async () => {
  await verifyCustodyWithoutProposedTime(connection(expected));
  await assert.rejects(verifyCustodyWithoutProposedTime(connection([])), /schema mismatch/);
  await assert.rejects(verifyCustodyWithoutProposedTime(connection([
    ...expected, { name: "proposed_time", type: "datetime" }
  ])), /schema mismatch/);
});
