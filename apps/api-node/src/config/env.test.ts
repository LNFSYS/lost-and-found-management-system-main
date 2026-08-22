import assert from "node:assert/strict";
import test from "node:test";
import { parseBooleanEnv } from "./env.js";

test("parseBooleanEnv accepts every documented true and false format", () => {
  for (const value of ["true", "TRUE", "1", "yes", " YES "]) {
    assert.equal(parseBooleanEnv(value, false, "COOKIE_SECURE"), true);
  }
  for (const value of ["false", "FALSE", "0", "no", " NO "]) {
    assert.equal(parseBooleanEnv(value, true, "COOKIE_SECURE"), false);
  }
  assert.equal(parseBooleanEnv(undefined, true, "COOKIE_SECURE"), true);
  assert.throws(() => parseBooleanEnv("sometimes", false, "COOKIE_SECURE"), /COOKIE_SECURE must be true or false/);
});
