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
import type { RadarAnalytics, RadarUseCases } from "../../application/index.js";
import { createRadarController } from "./radar.controller.js";
import { createRadarRoutes } from "./radar.routes.js";

function makeAccessToken(roles: Role[] = ["STAFF"]) {
  return jwt.sign({ sub: "staff-user-id", email: "staff@example.com", roles, sessionVersion: 0 }, env.jwtAccessSecret, { expiresIn: "1h" });
}

function jsonHeaders(roles: Role[] = ["STAFF"]) {
  return { authorization: `Bearer ${makeAccessToken(roles)}`, "content-type": "application/json" };
}

test("radar routes enforce authentication and role authorization", async () => {
  const mockAnalyticsData: RadarAnalytics = {
    from: "2026-10-01T00:00:00.000Z",
    to: "2026-10-15T23:59:59.999Z",
    categories: [{ categoryId: "cat-1", categoryName: "Balo", lostCount: 5 }],
    hotspots: [{ buildingId: "b-1", buildingName: "Alpha", areaName: "Sảnh", incidentCount: 3, commonCategories: "Balo" }],
    alerts: []
  };

  let capturedQuery: { from?: string; to?: string } | undefined;
  let capturedAlertId = "";
  let capturedActorId = "";

  const mockRadarService: RadarUseCases = {
    async getAnalytics(options) {
      capturedQuery = options;
      return mockAnalyticsData;
    },
    async acknowledgeAlert(alertId, actorId) {
      capturedAlertId = alertId;
      capturedActorId = actorId;
      return { success: true, id: alertId, status: "ACKNOWLEDGED" as const };
    }
  };

  const auth = createAuthMiddleware({
    authService: {
      validateAccessSession: async () => true
    },
    verifyAccessToken: (token) => jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload
  });

  const radarController = createRadarController({ radarService: mockRadarService });
  const radarRoutes = createRadarRoutes({ radarController, auth });

  const app = express();
  app.use(express.json());
  app.use("/api/radar", radarRoutes);
  app.use(errorHandler);

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    // 1. Unauthenticated -> 401
    const unauthGet = await fetch(`${url}/api/radar/analytics`);
    assert.equal(unauthGet.status, 401);

    const unauthPost = await fetch(`${url}/api/radar/alerts/alert-1/acknowledge`, { method: "POST" });
    assert.equal(unauthPost.status, 401);

    // 2. Normal USER role -> 403 Forbidden
    const forbiddenGet = await fetch(`${url}/api/radar/analytics`, { headers: jsonHeaders(["USER"]) });
    assert.equal(forbiddenGet.status, 403);

    const forbiddenPost = await fetch(`${url}/api/radar/alerts/alert-1/acknowledge`, {
      method: "POST",
      headers: jsonHeaders(["USER"])
    });
    assert.equal(forbiddenPost.status, 403);

    // 3. STAFF role -> 200 OK for GET analytics
    const staffGet = await fetch(`${url}/api/radar/analytics?from=2026-10-01&to=2026-10-15`, {
      headers: jsonHeaders(["STAFF"])
    });
    assert.equal(staffGet.status, 200);
    const getBody = await staffGet.json();
    assert.deepEqual(getBody, mockAnalyticsData);
    assert.equal((capturedQuery as { from?: string; to?: string } | undefined)?.from, "2026-10-01");
    assert.equal((capturedQuery as { from?: string; to?: string } | undefined)?.to, "2026-10-15");

    // 4. ADMIN role -> 200 OK for POST acknowledge
    const adminPost = await fetch(`${url}/api/radar/alerts/alert-999/acknowledge`, {
      method: "POST",
      headers: jsonHeaders(["ADMIN"])
    });
    assert.equal(adminPost.status, 200);
    const postBody = await adminPost.json();
    assert.deepEqual(postBody, { success: true, id: "alert-999", status: "ACKNOWLEDGED" });
    assert.equal(capturedAlertId, "alert-999");
    assert.equal(capturedActorId, "staff-user-id");
  } finally {
    server.close();
    server.closeAllConnections?.();
    await once(server, "close");
  }
});
