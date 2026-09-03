import assert from "node:assert/strict";
import test from "node:test";
import type { AccessTokenPayload, User } from "../types/auth.js";
import { isAccessSessionValid } from "./auth.service.js";

const payload: AccessTokenPayload = {
  sub: "user-id",
  email: "user@example.com",
  roles: ["USER"],
  sessionVersion: 2
};

const activeUser: User & { sessionVersion: number } = {
  id: "user-id",
  email: "user@example.com",
  fullName: "User",
  studentCode: null,
  phoneNumber: null,
  avatar: { hasAvatar: false, updatedAt: null },
  status: "ACTIVE",
  roles: ["USER"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  sessionVersion: 2
};

test("access session accepts active user with matching session version", () => {
  assert.equal(isAccessSessionValid(activeUser, payload), true);
});

test("access session rejects disabled user even when token version still matches", () => {
  assert.equal(isAccessSessionValid({ ...activeUser, status: "DISABLED" }, payload), false);
});

test("access session rejects stale tokens after session version changes", () => {
  assert.equal(isAccessSessionValid({ ...activeUser, sessionVersion: 3 }, payload), false);
});
