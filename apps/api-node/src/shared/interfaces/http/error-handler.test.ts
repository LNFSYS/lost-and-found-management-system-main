import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { AppError, type AppErrorCode } from "../../domain/app-error.js";
import { errorHandler } from "./error-handler.js";
import { HttpError } from "./http-error.js";

function responseFor(error: Error) {
  const result: { status?: number; body?: unknown } = {};
  const response = {
    status(status: number) { result.status = status; return this; },
    json(body: unknown) { result.body = body; return this; }
  };
  errorHandler(error, {} as Request, response as Response, () => undefined);
  return result;
}

test("semantic application errors preserve the previous HTTP status and payload", () => {
  const cases: Array<[AppErrorCode, number]> = [
    ["bad_request", 400], ["unauthenticated", 401], ["forbidden", 403], ["not_found", 404],
    ["conflict", 409], ["payload_too_large", 413], ["unsupported_media", 415], ["invalid_input", 422],
    ["rate_limited", 429], ["internal", 500], ["upstream_failure", 502], ["unavailable", 503], ["upstream_timeout", 504]
  ];
  for (const [code, status] of cases) {
    const previous = responseFor(new HttpError(status, "Existing application message"));
    const current = responseFor(new AppError(code, "Existing application message"));
    assert.deepEqual(current, previous, code);
    assert.equal(current.status, status);
  }
  assert.deepEqual(responseFor(new AppError("payload_too_large", "Upload too large")).body, {
    code: "PAYLOAD_TOO_LARGE", message: "Nội dung gửi lên vượt quá giới hạn cho phép"
  });
});

test("database connection failures return a retryable unavailable response", () => {
  const error = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
  const result = responseFor(error);
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { message: "Kết nối cơ sở dữ liệu tạm thời gián đoạn, vui lòng thử lại." });
});

test("database failure logs identify the route without raw URLs or credentials", (t) => {
  const log = t.mock.method(console, "error", () => {});
  const result = { status: 0 };
  const response = {
    status(status: number) { result.status = status; return this; },
    json() { return this; }
  };
  const request = {
    method: "POST", route: { path: "/warehouse-items/:id/return" },
    originalUrl: "/warehouse-items/private-id/return?token=private-token",
    headers: { authorization: "Bearer private-token" }
  };
  errorHandler(Object.assign(new Error("private connection message"), { code: "ECONNRESET" }), request as Request, response as Response, () => {});
  assert.equal(result.status, 503);
  assert.deepEqual(log.mock.calls[0].arguments, ["Database connection unavailable", {
    code: "ECONNRESET", method: "POST", route: "/warehouse-items/:id/return"
  }]);
});

test("temporary and failed DNS lookups return 503 without disclosing the hostname", (t) => {
  const log = t.mock.method(console, "error", () => {});
  for (const code of ["EAI_AGAIN", "ENOTFOUND"]) {
    const error = Object.assign(new Error(`getaddrinfo ${code} private-db-host`), { code, syscall: "getaddrinfo" });
    const result = responseFor(error);
    assert.equal(result.status, 503);
    assert.deepEqual(result.body, { message: "Kết nối cơ sở dữ liệu tạm thời gián đoạn, vui lòng thử lại." });
  }
  assert.equal(log.mock.calls.length, 2);
  assert.equal(JSON.stringify(log.mock.calls.map(call => call.arguments)).includes("private-db-host"), false);
  assert.equal((log.mock.calls[0].arguments[1] as { syscall: string }).syscall, "getaddrinfo");
});
