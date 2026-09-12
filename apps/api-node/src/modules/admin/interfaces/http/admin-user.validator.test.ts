import assert from "node:assert/strict";
import test from "node:test";
import { createAdminUserSchema, updateAdminUserRoleSchema, updateAdminUserSchema, updateAdminUserStatusSchema } from "./admin-user.validator.js";

test("admin user validator accepts valid create input", () => {
  const result = createAdminUserSchema.safeParse({
    email: "new.admin@example.com",
    password: "strong-password",
    fullName: "New Admin",
    accessRole: "ADMIN",
    status: "ACTIVE"
  });
  assert.equal(result.success, true);
});

test("admin user validator rejects invalid role and status", () => {
  assert.equal(updateAdminUserRoleSchema.safeParse({ accessRole: "SUPER_ADMIN" }).success, false);
  assert.equal(updateAdminUserStatusSchema.safeParse({ status: "LOCKED" }).success, false);
});

test("admin user validator rejects empty update payload", () => {
  const result = updateAdminUserSchema.safeParse({});
  assert.equal(result.success, false);
});

test("admin user validator accepts atomic role and status updates with a reason", () => {
  const result = updateAdminUserSchema.safeParse({ accessRole: "STAFF", status: "DISABLED", reason: "Review complete" });
  assert.equal(result.success, true);
});
