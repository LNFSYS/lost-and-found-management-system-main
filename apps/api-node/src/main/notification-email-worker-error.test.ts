import assert from "node:assert/strict";
import test from "node:test";
import { notificationEmailWorkerError } from "./notification-email-worker-error.js";

test("worker failures identify connection and schema errors without private payloads", () => {
  const reset = Object.assign(new Error("private transport details"), { code: "ECONNRESET", syscall: "read" });
  assert.equal(notificationEmailWorkerError(reset).causeCode, "ECONNRESET");
  assert.equal(notificationEmailWorkerError(reset).syscall, "read");
  const schemaError = Object.assign(new Error("private table details"), {
    code: "ER_NO_SUCH_TABLE", errno: 1146, sqlState: "42S02", sql: "private SQL", sqlMessage: "private recipient"
  });
  assert.deepEqual(notificationEmailWorkerError(schemaError), {
    errorCode: "WORKER_TICK_FAILED", causeCode: "ER_NO_SUCH_TABLE", causeType: "Error", syscall: undefined, errno: 1146, sqlState: "42S02"
  });
  assert.equal(JSON.stringify(notificationEmailWorkerError(schemaError)).includes("private"), false);
  assert.equal(notificationEmailWorkerError(new RangeError("private timezone")).causeType, "RangeError");
});

test("worker diagnostics omit malformed codes and nonnumeric metadata", () => {
  const details = notificationEmailWorkerError({ code: "SMTP secret@example.com", errno: "private", sqlState: "private" });
  assert.equal(details.causeCode, undefined);
  assert.equal(details.errno, undefined);
  assert.equal(details.sqlState, undefined);
});
