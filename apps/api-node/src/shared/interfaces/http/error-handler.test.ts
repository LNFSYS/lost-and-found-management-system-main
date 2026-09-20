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
