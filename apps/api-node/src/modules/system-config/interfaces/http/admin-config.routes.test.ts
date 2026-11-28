import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { env } from "../../../../shared/infrastructure/config/env.js";
import { createAuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import { errorHandler } from "../../../../shared/interfaces/http/error-handler.js";
import type { AccessTokenPayload, Role } from "../../../../shared/domain/auth.js";
import { createAdminConfigRoutes } from "./admin-config.routes.js";
import type { SystemConfigController } from "./system-config.controller.js";

function makeAccessToken(roles: Role[] = ["STAFF"]) {
  return jwt.sign({ sub: "user-test", email: "user@example.com", roles, sessionVersion: 0 }, env.jwtAccessSecret, { expiresIn: "1h" });
}

test("admin-config routes enforce requireAdmin for mutating configs", async () => {
  const dummyController = {
    listConfigs: async (_req: any, res: any) => res.json([]),
    getConfig: async (_req: any, res: any) => res.json({ id: "1" }),
    listHistory: async (_req: any, res: any) => res.json([]),
    createConfig: async (_req: any, res: any) => res.json({ id: "1" }),
    updateConfig: async (_req: any, res: any) => res.json({ id: "1" }),
    deleteConfig: async (_req: any, res: any) => res.json({ id: "1" })
  } as unknown as SystemConfigController;

  const auth = createAuthMiddleware({
    authService: { validateAccessSession: async () => true },
    verifyAccessToken: (token) => jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload
  });

  const routes = createAdminConfigRoutes({ systemConfigController: dummyController, auth });

  const app = express();
  app.use(express.json());
  app.use("/api/admin/configs", routes);
  app.use(errorHandler);

  const server = app.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api/admin/configs`;

  try {
    const staffToken = makeAccessToken(["STAFF"]);
    const adminToken = makeAccessToken(["ADMIN"]);

    // 1. Staff can list configs
    const staffList = await fetch(`${baseUrl}/`, { headers: { authorization: `Bearer ${staffToken}` } });
    assert.equal(staffList.status, 200);

    // 2. Staff cannot create config (403)
    const staffCreate = await fetch(`${baseUrl}/`, {
      method: "POST",
      headers: { authorization: `Bearer ${staffToken}`, "content-type": "application/json" },
      body: JSON.stringify({ key: "test", value: "val" })
    });
    assert.equal(staffCreate.status, 403);

    // 3. Admin can create config (200)
    const adminCreate = await fetch(`${baseUrl}/`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({ key: "test", value: "val" })
    });
    assert.equal(adminCreate.status, 200);

    // 4. Staff cannot update config (403)
    const staffUpdate = await fetch(`${baseUrl}/cfg-1`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${staffToken}`, "content-type": "application/json" },
      body: JSON.stringify({ value: "new" })
    });
    assert.equal(staffUpdate.status, 403);

    // 5. Staff cannot delete config (403)
    const staffDelete = await fetch(`${baseUrl}/cfg-1`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${staffToken}` }
    });
    assert.equal(staffDelete.status, 403);
  } finally {
    server.close();
  }
});
