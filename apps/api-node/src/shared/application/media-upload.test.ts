import assert from "node:assert/strict";
import test from "node:test";
import { persistUpload } from "./media-upload.js";
import { recordTransactionOutcome } from "./transaction.js";

for (const mode of ["COMMITTED", "ABSENT", "READ_FAILED", "TIMEOUT", "ROLLED_BACK", "LOCK_LOST"] as const) {
  test(`media persistence reconciles ${mode} without guessing the transaction outcome`, async () => {
    const failure = Object.assign(new Error("write acknowledgement unavailable"), { code: "ECONNRESET" });
    if (mode === "ROLLED_BACK" || mode === "LOCK_LOST") recordTransactionOutcome(failure, "ROLLED_BACK");
    let deleted = 0;
    const logs: string[] = [];
    const operation = { id: "opaque-operation-id", canCompensate: async () => mode !== "LOCK_LOST" };
    const result = persistUpload({ operation, kind: "TEST", timeoutMs: 10, logger: { warn: message => logs.push(String(message)) },
      unreferenced: async () => true,
      write: async () => { throw failure; }, remove: async () => { deleted++; },
      matches: async () => {
        if (mode === "READ_FAILED") throw new Error("database unavailable");
        if (mode === "TIMEOUT") return new Promise<boolean>(() => {});
        return mode === "COMMITTED";
      } });
    if (mode === "COMMITTED") await result;
    else await assert.rejects(result, error => error === failure);
    assert.equal(deleted, mode === "ROLLED_BACK" ? 1 : 0);
    assert.equal(logs.length, ["COMMITTED", "ROLLED_BACK"].includes(mode) ? 0 : 1);
    assert.ok(logs.every(log => !log.includes("ECONNRESET")));
  });
}

test("failed compensation records a review operation and never changes a failure into success", async () => {
  const error = new Error("rolled back"); recordTransactionOutcome(error, "ROLLED_BACK");
  const logs: string[] = [];
  await assert.rejects(persistUpload({ operation: { id: "operation", canCompensate: async () => true }, kind: "TEST",
    unreferenced: async () => true,
    write: async () => { throw error; }, matches: async () => false,
    remove: async () => { throw new Error("provider unavailable"); }, logger: { warn: log => logs.push(String(log)) } }));
  assert.match(logs[0]!, /media_upload_cleanup_required/);
});

test("an unmatched existing reference is not safe to remove even after rollback", async () => {
  const error = new Error("rollback"); recordTransactionOutcome(error, "ROLLED_BACK");
  let removed = false;
  await assert.rejects(persistUpload({ operation: { id: "id", canCompensate: async () => true }, kind: "TEST",
    write: async () => { throw error; }, matches: async () => false, unreferenced: async () => false,
    remove: async () => { removed = true; } }));
  assert.equal(removed, false);
});
