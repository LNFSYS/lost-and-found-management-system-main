import assert from "node:assert/strict";
import test from "node:test";
import { createBackgroundTask } from "./background-task.js";
import { matchingRefreshWorkerError } from "./matching-refresh-worker-error.js";
import { createMatchingRefreshWorker } from "../modules/matching/application/matching-refresh.worker.js";

test("matching diagnostics distinguish transport, schema and closed-connection failures", () => {
  for (const code of ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "ER_LOCK_DEADLOCK"]) {
    const error = Object.assign(new Error("private connection details"), { code, syscall: "connect" });
    const details = matchingRefreshWorkerError(error, "REFRESH");
    assert.equal(details.causeCode, code);
    assert.equal(details.syscall, "connect");
    assert.equal(details.phase, "REFRESH");
  }
  const schema = Object.assign(new Error("private SQL"), { code: "ER_NO_SUCH_TABLE", errno: 1146, sqlState: "42S02" });
  assert.deepEqual(matchingRefreshWorkerError(schema, "SCHEMA_CHECK"), {
    errorCode: "MATCH_REFRESH_TICK_FAILED", causeCode: "ER_NO_SUCH_TABLE", causeType: "Error",
    syscall: undefined, errno: 1146, sqlState: "42S02", phase: "SCHEMA_CHECK"
  });
  assert.equal(matchingRefreshWorkerError(new Error("Can't add new command when connection is in closed state"), "REFRESH").causeCode, "DB_CONNECTION_CLOSED");
  assert.equal(matchingRefreshWorkerError(new TypeError("private payload"), "REFRESH").causeType, "TypeError");
});

test("matching diagnostics never log error messages, SQL, credentials or malformed metadata", () => {
  const error = Object.assign(new RangeError("private recipient secret"), {
    code: "SQL secret@example.com", errno: "private", sqlState: "private", syscall: "private-host",
    sql: "private SQL", sqlMessage: "private recipient", password: "private password"
  });
  const details = matchingRefreshWorkerError(error, "REFRESH");
  assert.equal(details.causeCode, undefined);
  assert.equal(details.causeType, "RangeError");
  assert.equal(details.errno, undefined);
  assert.equal(details.sqlState, undefined);
  assert.equal(details.syscall, undefined);
  assert.equal(JSON.stringify(details).includes("private"), false);
  assert.equal(matchingRefreshWorkerError({ errno: Infinity }, "REFRESH").errno, undefined);
  assert.equal(matchingRefreshWorkerError(null, "REFRESH").causeCode, undefined);
});

test("a failed matching tick reports its cause and permits the next tick to recover", async () => {
  let calls = 0;
  const failures: ReturnType<typeof matchingRefreshWorkerError>[] = [];
  const worker = createMatchingRefreshWorker({ runPeriodicRefresh: async () => {
    calls++;
    if (calls === 1) throw Object.assign(new Error("private transport"), { code: "ECONNRESET" });
    return { enqueued: 1, claimed: 1, completed: 1, failed: 0 };
  } }, { intervalHours: 6, batchSize: 5, staleMinutes: 15 });
  const task = createBackgroundTask(() => worker.runOnce(), error => {
    failures.push(matchingRefreshWorkerError(error, "REFRESH"));
  });
  try {
    await task.tick();
    await task.tick();
    assert.equal(calls, 2);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].causeCode, "ECONNRESET");
  } finally {
    await task.stop();
    await worker.stop();
  }
  await task.tick();
  assert.equal(calls, 2);
});
