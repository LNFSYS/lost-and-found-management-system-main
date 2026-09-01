import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { requireAnyRole, requireAuth } from "./auth.middleware.js";
import { HttpError } from "../utils/http-error.js";

function captureNext() {
  let captured: unknown;
  const next: NextFunction = (error?: unknown) => { captured = error; };
  return { next, captured: () => captured };
}

test("requireAuth returns 401 when request has no token", async () => {
  const request = { header: () => undefined } as unknown as Request;
  const { next, captured } = captureNext();
  await requireAuth(request, {} as Response, next);
  assert.ok(captured() instanceof HttpError);
  assert.equal((captured() as HttpError).status, 401);
});

test("requireAnyRole blocks staff and user from admin routes", () => {
  for (const roles of [["STAFF"], ["USER"]]) {
    const request = { auth: { roles } } as unknown as Request;
    const { next, captured } = captureNext();
    requireAnyRole("ADMIN")(request, {} as Response, next);
    assert.ok(captured() instanceof HttpError);
    assert.equal((captured() as HttpError).status, 403);
  }
});

test("requireAnyRole lets admins pass", () => {
  const request = { auth: { roles: ["ADMIN"] } } as unknown as Request;
  const { next, captured } = captureNext();
  requireAnyRole("ADMIN")(request, {} as Response, next);
  assert.equal(captured(), undefined);
});
