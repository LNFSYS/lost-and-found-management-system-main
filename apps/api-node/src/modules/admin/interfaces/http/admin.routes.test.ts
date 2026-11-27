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
import { createAdminRoutes } from "./admin.routes.js";
import type { AdminCatalogController } from "./admin-catalog.controller.js";
import type { AdminReportingController } from "./admin-reporting.controller.js";
import type { AdminUserController } from "./admin-user.controller.js";

function makeAccessToken(roles: Role[] = ["STAFF"]) {
  return jwt.sign({ sub: "user-test", email: "user@example.com", roles, sessionVersion: 0 }, env.jwtAccessSecret, { expiresIn: "1h" });
}

test("admin routes enforce strict ADMIN vs STAFF RBAC", async () => {
  const dummyCatalog = {
    getCatalog: async (_req: any, res: any) => res.json({ ok: true }),
    createCategory: async (_req: any, res: any) => res.json({ ok: true }),
    updateCategory: async (_req: any, res: any) => res.json({ ok: true }),
    deleteCategory: async (_req: any, res: any) => res.json({ ok: true }),
    createArea: async (_req: any, res: any) => res.json({ ok: true }),
    updateArea: async (_req: any, res: any) => res.json({ ok: true }),
    deleteArea: async (_req: any, res: any) => res.json({ ok: true }),
    createBuilding: async (_req: any, res: any) => res.json({ ok: true }),
    updateBuilding: async (_req: any, res: any) => res.json({ ok: true }),
    deleteBuilding: async (_req: any, res: any) => res.json({ ok: true }),
    createHandoverPoint: async (_req: any, res: any) => res.json({ ok: true }),
    updateHandoverPoint: async (_req: any, res: any) => res.json({ ok: true }),
    uploadHandoverMapImage: async (_req: any, res: any) => res.json({ ok: true }),
    deleteHandoverPoint: async (_req: any, res: any) => res.json({ ok: true }),
    listPublicHandoverPoints: async (_req: any, res: any) => res.json({ ok: true })
  } as unknown as AdminCatalogController;

  const dummyReporting = {
    listReports: async (_req: any, res: any) => res.json({ ok: true }),
    getReportDetail: async (_req: any, res: any) => res.json({ ok: true }),
    reviewReport: async (_req: any, res: any) => res.json({ ok: true }),
    getDashboardKpis: async (_req: any, res: any) => res.json({ ok: true }),
    exportStatistics: async (_req: any, res: any) => res.json({ ok: true })
  } as unknown as AdminReportingController;

  const dummyUser = {
    listUsers: async (_req: any, res: any) => res.json({ ok: true }),
    createUser: async (_req: any, res: any) => res.json({ ok: true }),
    getUser: async (_req: any, res: any) => res.json({ ok: true }),
    updateUser: async (_req: any, res: any) => res.json({ ok: true }),
    changeRole: async (_req: any, res: any) => res.json({ ok: true }),
    changeStatus: async (_req: any, res: any) => res.json({ ok: true }),
    deleteUser: async (_req: any, res: any) => res.json({ ok: true })
  } as unknown as AdminUserController;

  const auth = createAuthMiddleware({
    authService: { validateAccessSession: async () => true },
    verifyAccessToken: (token) => jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload
  });

  const routes = createAdminRoutes({
    adminCatalogController: dummyCatalog,
    adminReportingController: dummyReporting,
    adminUserController: dummyUser,
    auth
  });

  const app = express();
  app.use(express.json());
  app.use("/api/admin", routes);
  app.use(errorHandler);

  const server = app.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api/admin`;

  try {
    const staffToken = makeAccessToken(["STAFF"]);
    const adminToken = makeAccessToken(["ADMIN"]);

    // 1. Staff can view reports, catalog and KPIs
    const staffGetReports = await fetch(`${baseUrl}/reports`, { headers: { authorization: `Bearer ${staffToken}` } });
    assert.equal(staffGetReports.status, 200);

    const staffGetCatalog = await fetch(`${baseUrl}/catalog`, { headers: { authorization: `Bearer ${staffToken}` } });
    assert.equal(staffGetCatalog.status, 200);

    // 2. Staff is FORBIDDEN (403) from reviewReport
    const staffReview = await fetch(`${baseUrl}/reports/123/review`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${staffToken}`, "content-type": "application/json" },
      body: JSON.stringify({ action: "BAN_USER", reason: "test" })
    });
    assert.equal(staffReview.status, 403);

    // 3. Admin is allowed (200) for reviewReport
    const adminReview = await fetch(`${baseUrl}/reports/123/review`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({ action: "BAN_USER", reason: "test" })
    });
    assert.equal(adminReview.status, 200);

    // 4. Staff CAN access catalog management (create category)
    const staffCreateCat = await fetch(`${baseUrl}/categories`, {
      method: "POST",
      headers: { authorization: `Bearer ${staffToken}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "Category Test" })
    });
    assert.equal(staffCreateCat.status, 200);

    // 5. Admin can also create categories
    const adminCreateCat = await fetch(`${baseUrl}/categories`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "Category Test" })
    });
    assert.equal(adminCreateCat.status, 200);

    // 6. Staff is FORBIDDEN (403) from user management
    const staffGetUsers = await fetch(`${baseUrl}/users`, {
      headers: { authorization: `Bearer ${staffToken}` }
    });
    assert.equal(staffGetUsers.status, 403);
  } finally {
    server.close();
  }
});
