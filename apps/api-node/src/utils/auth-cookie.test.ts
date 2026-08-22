import assert from "node:assert/strict";
import test from "node:test";
import { env } from "../config/env.js";
import { refreshCookieOptions } from "./auth-cookie.js";

test("refresh cookies use the parsed COOKIE_SECURE setting consistently", () => {
  const expiresAt = new Date("2030-01-01T00:00:00.000Z");
  const setOptions = refreshCookieOptions(expiresAt);
  const clearOptions = refreshCookieOptions();

  assert.equal(setOptions.secure, env.cookieSecure);
  assert.equal(clearOptions.secure, env.cookieSecure);
  assert.equal(setOptions.httpOnly, true);
  assert.equal(setOptions.sameSite, "lax");
  assert.equal(setOptions.path, "/api/auth");
  assert.equal(setOptions.expires, expiresAt);
  assert.equal(clearOptions.expires, undefined);
});
