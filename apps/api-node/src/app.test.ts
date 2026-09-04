import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { authService } from "./services/auth.service.js";
import { adminUserService } from "./services/admin-user.service.js";
import { systemConfigService } from "./services/system-config.service.js";
import type { AdminUserRecord } from "./repositories/admin-user.repository.js";
import type { SystemConfigRecord } from "./repositories/system-config.repository.js";
import type { Role } from "./types/auth.js";

const userId = "11111111-1111-4111-8111-111111111111";
const configId = "22222222-2222-4222-8222-222222222222";

function makeAccessToken(roles: Role[] = ["USER", "ADMIN"]) {
  return jwt.sign({ sub: "admin-id", email: "admin@example.com", roles, sessionVersion: 0 }, env.jwtAccessSecret);
}

function jsonHeaders(roles: Role[] = ["USER", "ADMIN"]) {
  return { authorization: `Bearer ${makeAccessToken(roles)}`, "content-type": "application/json" };
}

function makeAdminUser(overrides: Partial<AdminUserRecord> = {}): AdminUserRecord {
  return {
    id: overrides.id ?? userId,
    email: overrides.email ?? "member@example.com",
    fullName: overrides.fullName ?? "Member User",
    studentCode: overrides.studentCode ?? null,
    phoneNumber: overrides.phoneNumber ?? null,
    status: overrides.status ?? "ACTIVE",
    roles: overrides.roles ?? ["USER"],
    accessRole: overrides.accessRole ?? "USER",
    createdAt: overrides.createdAt ?? "2026-09-02T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-09-02T00:00:00.000Z"
  };
}

function makeConfig(overrides: Partial<SystemConfigRecord> = {}): SystemConfigRecord {
  return {
    id: overrides.id ?? configId,
    configKey: overrides.configKey ?? "client.max_title_length",
    configValue: overrides.configValue ?? "120",
    valueType: overrides.valueType ?? "INTEGER",
    description: overrides.description ?? "Max title length",
    isPublic: overrides.isPublic ?? true,
    updatedBy: overrides.updatedBy ?? "admin-id",
    updatedAt: overrides.updatedAt ?? "2026-09-02T00:00:00.000Z"
  };
}

async function withServer(checkReadiness: () => Promise<void>, run: (baseUrl: string) => Promise<void>) {
  const server = createApp({ checkReadiness }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("malformed JSON returns a JSON 400 response", async () => {
  await withServer(async () => undefined, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });
    assert.equal(response.status, 400);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await response.json(), { message: "Nội dung JSON không hợp lệ" });
  });
});

test("unknown API routes return the JSON error convention", async () => {
  await withServer(async () => undefined, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await response.json(), { message: "Không tìm thấy endpoint" });
  });
});

test("admin user routes require authentication", async () => {
  await withServer(async () => undefined, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/users`);
    assert.equal(response.status, 401);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  });
});

test("admin config routes require authentication", async () => {
  await withServer(async () => undefined, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/configs`);
    assert.equal(response.status, 401);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  });
});

test("claim, room and private evidence routes require authentication", async () => {
  await withServer(async () => undefined, async (baseUrl) => {
    const claimList = await fetch(`${baseUrl}/api/claims`);
    assert.equal(claimList.status, 401);

    const room = await fetch(`${baseUrl}/api/claims/11111111-1111-4111-8111-111111111111/room`);
    assert.equal(room.status, 401);

    const evidence = await fetch(`${baseUrl}/api/claims/11111111-1111-4111-8111-111111111111/evidence/22222222-2222-4222-8222-222222222222`);
    assert.equal(evidence.status, 401);
  });
});

test("notification routes require authentication", async () => {
  await withServer(async () => undefined, async (baseUrl) => {
    const list = await fetch(`${baseUrl}/api/notifications`);
    assert.equal(list.status, 401);

    const markRead = await fetch(`${baseUrl}/api/notifications/11111111-1111-4111-8111-111111111111/read`, { method: "POST" });
    assert.equal(markRead.status, 401);
  });
});

test("public config route exposes safe config without authentication", async () => {
  const original = systemConfigService.listPublicConfigs;
  systemConfigService.listPublicConfigs = async () => ({ items: [], values: { "post.max_images": 5 } });
  try {
    await withServer(async () => undefined, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/config/public`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { items: [], values: { "post.max_images": 5 } });
    });
  } finally {
    systemConfigService.listPublicConfigs = original;
  }
});

test("admin HTTP routes enforce roles and expose user/config CRUD contracts", async () => {
  const originalValidateAccessSession = authService.validateAccessSession;
  const originalAdminListUsers = adminUserService.listUsers;
  const originalAdminCreateUser = adminUserService.createUser;
  const originalAdminUpdateUser = adminUserService.updateUser;
  const originalConfigList = systemConfigService.listConfigs;
  const originalConfigCreate = systemConfigService.createConfig;
  const originalConfigUpdate = systemConfigService.updateConfig;
  const originalConfigHistory = systemConfigService.listHistory;
  const originalConfigDelete = systemConfigService.deleteConfig;
  let updateCalls = 0;
  let lastUpdateInput: unknown;

  authService.validateAccessSession = async () => true;
  adminUserService.listUsers = async (filters) => ({ total: 1, page: filters.page, pageSize: filters.pageSize, items: [makeAdminUser()] });
  adminUserService.createUser = async () => makeAdminUser();
  adminUserService.updateUser = async (_actorId, _targetId, input) => {
    updateCalls += 1;
    lastUpdateInput = input;
    return makeAdminUser({ fullName: input.fullName ?? "Updated User", accessRole: input.accessRole ?? "USER", status: input.status ?? "ACTIVE" });
  };
  systemConfigService.listConfigs = async (filters) => ({ total: 1, page: filters.page, pageSize: filters.pageSize, items: [makeConfig()] });
  systemConfigService.createConfig = async () => makeConfig();
  systemConfigService.updateConfig = async () => makeConfig({ configValue: "160" });
  systemConfigService.listHistory = async () => ({ items: [] });
  systemConfigService.deleteConfig = async () => undefined;

  try {
    await withServer(async () => undefined, async (baseUrl) => {
      const staffResponse = await fetch(`${baseUrl}/api/admin/users`, { headers: jsonHeaders(["USER", "STAFF"]) });
      assert.equal(staffResponse.status, 403);

      const usersResponse = await fetch(`${baseUrl}/api/admin/users?page=1&pageSize=20`, { headers: jsonHeaders() });
      assert.equal(usersResponse.status, 200);
      assert.equal((await usersResponse.json()).items.length, 1);

      const createUserResponse = await fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ email: "member@example.com", password: "password123", fullName: "Member User", accessRole: "USER", status: "ACTIVE" })
      });
      assert.equal(createUserResponse.status, 201);

      const updateUserResponse = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ fullName: "Updated User", accessRole: "STAFF", status: "DISABLED", reason: "Review" })
      });
      assert.equal(updateUserResponse.status, 200);
      assert.equal(updateCalls, 1);
      assert.deepEqual(lastUpdateInput, { fullName: "Updated User", accessRole: "STAFF", status: "DISABLED", reason: "Review" });

      adminUserService.createUser = async () => { throw Object.assign(new Error("duplicate email"), { code: "ER_DUP_ENTRY" }); };
      const duplicateResponse = await fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ email: "member@example.com", password: "password123", fullName: "Member User" })
      });
      assert.equal(duplicateResponse.status, 409);

      const configResponse = await fetch(`${baseUrl}/api/admin/configs?page=1&pageSize=20`, { headers: jsonHeaders() });
      assert.equal(configResponse.status, 200);
      assert.equal((await configResponse.json()).items[0].configKey, "client.max_title_length");

      const createConfigResponse = await fetch(`${baseUrl}/api/admin/configs`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ configKey: "client.max_title_length", configValue: "120", valueType: "INTEGER", isPublic: true })
      });
      assert.equal(createConfigResponse.status, 201);

      const updateConfigResponse = await fetch(`${baseUrl}/api/admin/configs/${configId}`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ configValue: "160", reason: "Tune limits" })
      });
      assert.equal(updateConfigResponse.status, 200);

      const historyResponse = await fetch(`${baseUrl}/api/admin/configs/${configId}/history?limit=20`, { headers: jsonHeaders() });
      assert.equal(historyResponse.status, 200);

      const deleteConfigResponse = await fetch(`${baseUrl}/api/admin/configs/${configId}`, {
        method: "DELETE",
        headers: jsonHeaders(),
        body: JSON.stringify({ reason: "Retired" })
      });
      assert.equal(deleteConfigResponse.status, 204);
    });
  } finally {
    authService.validateAccessSession = originalValidateAccessSession;
    adminUserService.listUsers = originalAdminListUsers;
    adminUserService.createUser = originalAdminCreateUser;
    adminUserService.updateUser = originalAdminUpdateUser;
    systemConfigService.listConfigs = originalConfigList;
    systemConfigService.createConfig = originalConfigCreate;
    systemConfigService.updateConfig = originalConfigUpdate;
    systemConfigService.listHistory = originalConfigHistory;
    systemConfigService.deleteConfig = originalConfigDelete;
  }
});

test("liveness stays independent while readiness reflects database availability", async () => {
  await withServer(async () => { throw new Error("database unavailable"); }, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);

    const readiness = await fetch(`${baseUrl}/api/ready`);
    assert.equal(readiness.status, 503);
    assert.deepEqual(await readiness.json(), { status: "unavailable", message: "Dịch vụ chưa sẵn sàng" });
  });

  await withServer(async () => undefined, async (baseUrl) => {
    const readiness = await fetch(`${baseUrl}/api/ready`);
    assert.equal(readiness.status, 200);
    assert.deepEqual(await readiness.json(), { status: "ready", service: "lnfs-auth-api" });
  });
});
