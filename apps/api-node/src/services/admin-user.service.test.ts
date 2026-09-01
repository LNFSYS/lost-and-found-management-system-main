import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import type { AdminUserRecord, AdminUserRepository } from "../repositories/admin-user.repository.js";
import type { Role } from "../types/auth.js";
import { HttpError } from "../utils/http-error.js";
import { createAdminUserService } from "./admin-user.service.js";

function makeUser(overrides: Partial<AdminUserRecord> = {}): AdminUserRecord {
  const roles = overrides.roles ?? ["USER"];
  return {
    id: overrides.id ?? "user-id",
    email: overrides.email ?? "user@example.com",
    fullName: overrides.fullName ?? "Test User",
    studentCode: overrides.studentCode ?? null,
    phoneNumber: overrides.phoneNumber ?? null,
    status: overrides.status ?? "ACTIVE",
    roles,
    accessRole: roles.includes("ADMIN") ? "ADMIN" : roles.includes("STAFF") ? "STAFF" : "USER",
    createdAt: overrides.createdAt ?? "2026-08-24T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-08-24T00:00:00.000Z"
  };
}

function normalize(email: string) {
  return email.trim().toLowerCase();
}

function fakeRepository(seed: AdminUserRecord[] = []) {
  const users = new Map(seed.map((user) => [user.id, { ...user, roles: [...user.roles] }]));
  const normalizedEmails = new Map(seed.map((user) => [user.id, normalize(user.email)]));
  const passwordHashes = new Map<string, string>();
  const revokedRefreshTokenUserIds: string[] = [];
  const lockCalls = { count: 0 };

  const repository: AdminUserRepository = {
    async listUsers(filters) {
      const items = [...users.values()].filter((user) => (
        (!filters.status || user.status === filters.status) &&
        (!filters.role || user.accessRole === filters.role)
      ));
      return { total: items.length, page: filters.page, pageSize: filters.pageSize, items: items.map((user) => ({ ...user, roles: [...user.roles] })) };
    },
    async findById(userId) {
      const user = users.get(userId);
      return user ? { ...user, roles: [...user.roles] } : null;
    },
    async findByNormalizedEmail(normalizedEmail, exceptUserId) {
      for (const [userId, email] of normalizedEmails) {
        if (email === normalizedEmail && userId !== exceptUserId) return userId;
      }
      return null;
    },
    async createUser(input) {
      users.set(input.id, makeUser({
        id: input.id,
        email: input.email,
        fullName: input.fullName,
        studentCode: input.studentCode ?? null,
        phoneNumber: input.phoneNumber ?? null,
        status: input.status,
        roles: []
      }));
      normalizedEmails.set(input.id, input.normalizedEmail);
      passwordHashes.set(input.id, input.passwordHash);
    },
    async updateUser(userId, input) {
      const user = users.get(userId);
      if (!user) return;
      if (input.email !== undefined) user.email = input.email;
      if (input.normalizedEmail !== undefined) normalizedEmails.set(userId, input.normalizedEmail);
      if (input.fullName !== undefined) user.fullName = input.fullName;
      if (input.studentCode !== undefined) user.studentCode = input.studentCode;
      if (input.phoneNumber !== undefined) user.phoneNumber = input.phoneNumber;
    },
    async setAccessRole(userId, accessRole) {
      const user = users.get(userId);
      if (!user) return;
      user.roles = user.roles.filter((role) => role !== "ADMIN" && role !== "STAFF");
      if (!user.roles.includes("USER")) user.roles.push("USER");
      if (accessRole !== "USER") user.roles.push(accessRole);
      user.accessRole = accessRole;
    },
    async assignRole(userId, role: Role) {
      const user = users.get(userId);
      if (user && !user.roles.includes(role)) user.roles.push(role);
      if (user) user.accessRole = user.roles.includes("ADMIN") ? "ADMIN" : user.roles.includes("STAFF") ? "STAFF" : "USER";
    },
    async setStatus(userId, status) {
      const user = users.get(userId);
      if (user) user.status = status;
    },
    async revokeRefreshTokens(userId) {
      revokedRefreshTokenUserIds.push(userId);
    },
    async countActiveAdmins() {
      return [...users.values()].filter((user) => user.status === "ACTIVE" && user.accessRole === "ADMIN").length;
    },
    async lockActiveAdmins() {
      lockCalls.count += 1;
      return [...users.values()].filter((user) => user.status === "ACTIVE" && user.accessRole === "ADMIN").length;
    },
    async softDeleteUser(userId) {
      const user = users.get(userId);
      if (!user) return false;
      user.status = "DISABLED";
      return true;
    }
  };

  return { repository, users, passwordHashes, revokedRefreshTokenUserIds, lockCalls };
}

function serviceFor(repository: AdminUserRepository, auditRecords: unknown[] = []) {
  return createAdminUserService({
    repository,
    auditRepository: { async record(input) { auditRecords.push(input); } },
    transaction: async (work) => work({} as PoolConnection),
    hashPassword: async (password) => `hash:${password}`,
    idFactory: () => "created-user-id"
  });
}

test("admin user service supports CRUD without leaking sensitive fields", async () => {
  const admin = makeUser({ id: "admin-id", email: "admin@example.com", roles: ["USER", "ADMIN"] });
  const { repository, passwordHashes, revokedRefreshTokenUserIds, lockCalls } = fakeRepository([admin]);
  const auditRecords: unknown[] = [];
  const service = serviceFor(repository, auditRecords);

  const created = await service.createUser(admin.id, {
    email: "member@example.com",
    password: "member-password",
    fullName: "Member User",
    studentCode: null,
    phoneNumber: null,
    audienceRole: "STUDENT",
    accessRole: "USER",
    status: "ACTIVE"
  });

  assert.equal(created.id, "created-user-id");
  assert.deepEqual(created.roles.sort(), ["STUDENT", "USER"]);
  assert.equal(passwordHashes.get(created.id), "hash:member-password");
  assert.equal("password" in created, false);
  assert.equal("passwordHash" in created, false);
  assert.equal("token" in created, false);

  const listed = await service.listUsers({ page: 1, pageSize: 20 });
  assert.equal(listed.total, 2);
  assert.equal((await service.getUser(created.id)).email, "member@example.com");

  const updated = await service.updateUser(admin.id, created.id, { fullName: "Updated Member", phoneNumber: "0909000000" });
  assert.equal(updated.fullName, "Updated Member");
  assert.ok(revokedRefreshTokenUserIds.includes(created.id));

  const promoted = await service.changeRole(admin.id, created.id, { accessRole: "STAFF" });
  assert.equal(promoted.accessRole, "STAFF");

  const disabled = await service.changeStatus(admin.id, created.id, { status: "DISABLED" });
  assert.equal(disabled.status, "DISABLED");

  await service.deleteUser(admin.id, created.id);
  assert.equal((await service.getUser(created.id)).status, "DISABLED");
  assert.ok(lockCalls.count >= 4);
  assert.equal(auditRecords.length, 5);
  assert.equal(auditRecords.some((record) => JSON.stringify(record).includes("passwordHash")), false);
  assert.equal(auditRecords.some((record) => JSON.stringify(record).includes("member-password")), false);
});

test("admin user service blocks self disable and self delete", async () => {
  const admin = makeUser({ id: "admin-id", roles: ["USER", "ADMIN"] });
  const service = serviceFor(fakeRepository([admin]).repository);

  await assert.rejects(() => service.changeStatus(admin.id, admin.id, { status: "DISABLED" }), (error: unknown) => (
    error instanceof HttpError && error.status === 409
  ));
  await assert.rejects(() => service.deleteUser(admin.id, admin.id), (error: unknown) => (
    error instanceof HttpError && error.status === 409
  ));
});

test("admin user service blocks removing the last active admin", async () => {
  const admin = makeUser({ id: "admin-id", roles: ["USER", "ADMIN"] });
  const service = serviceFor(fakeRepository([admin]).repository);

  await assert.rejects(() => service.changeRole("other-admin-id", admin.id, { accessRole: "STAFF" }), (error: unknown) => (
    error instanceof HttpError && error.status === 409
  ));
  await assert.rejects(() => service.deleteUser("other-admin-id", admin.id), (error: unknown) => (
    error instanceof HttpError && error.status === 409
  ));
});

test("admin user service rejects duplicate email", async () => {
  const admin = makeUser({ id: "admin-id", email: "admin@example.com", roles: ["USER", "ADMIN"] });
  const user = makeUser({ id: "user-id", email: "user@example.com" });
  const service = serviceFor(fakeRepository([admin, user]).repository);

  await assert.rejects(() => service.updateUser(admin.id, user.id, { email: "admin@example.com" }), (error: unknown) => (
    error instanceof HttpError && error.status === 409
  ));
});

test("admin user edit applies profile, role, and status through one transaction", async () => {
  const admin = makeUser({ id: "admin-id", email: "admin@example.com", roles: ["USER", "ADMIN"] });
  const user = makeUser({ id: "user-id", email: "user@example.com" });
  const { repository, lockCalls } = fakeRepository([admin, user]);
  const service = serviceFor(repository);

  const updated = await service.updateUser(admin.id, user.id, {
    fullName: "Updated User",
    accessRole: "STAFF",
    status: "DISABLED",
    reason: "Account review"
  });

  assert.equal(updated.fullName, "Updated User");
  assert.equal(updated.accessRole, "STAFF");
  assert.equal(updated.status, "DISABLED");
  assert.equal(lockCalls.count, 1);
});
