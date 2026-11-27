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
import type { DamageInspectionServicePort } from "../../application/damage-inspection.port.js";
import { createDamageInspectionController } from "./damage-inspection.controller.js";
import { createDamageInspectionRoutes } from "./damage-inspection.routes.js";

function makeAccessToken(roles: Role[] = ["STAFF"]) {
  return jwt.sign({ sub: "user-123", email: "user@example.com", roles, sessionVersion: 0 }, env.jwtAccessSecret, { expiresIn: "1h" });
}

test("damage-inspection routes enforce authentication and role authorization", async () => {
  const mockService: DamageInspectionServicePort = {
    async initModel() { return true; },
    async getStatus() { return { status: "ready", runtime: "Node.js (ONNX Runtime)" }; },
    async analyze() {
      return {
        conditionScore: 95,
        grade: "Tốt",
        statusText: "Vật phẩm còn rất mới",
        damagePercentage: 1.2,
        totalDefects: 1,
        defectCounts: { "Vết trầy xước": 1 },
        defectDetails: [],
        annotatedImage: "data:image/jpeg;base64,mock"
      };
    }
  };

  const auth = createAuthMiddleware({
    authService: { validateAccessSession: async () => true },
    verifyAccessToken: (token) => jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload
  });

  const controller = createDamageInspectionController({ service: mockService });
  const routes = createDamageInspectionRoutes({ controller, auth });

  const app = express();
  app.use("/api/damage-inspection", routes);
  app.use(errorHandler);

  const server = app.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api/damage-inspection`;

  try {
    // 1. Unauthenticated request -> 401
    const unauthRes = await fetch(`${baseUrl}/status`);
    assert.equal(unauthRes.status, 401);

    // 2. Regular user (USER role) -> 403 Forbidden
    const forbiddenRes = await fetch(`${baseUrl}/status`, {
      headers: { authorization: `Bearer ${makeAccessToken(["USER"])}` }
    });
    assert.equal(forbiddenRes.status, 403);

    // 3. STAFF role -> 200 OK
    const staffRes = await fetch(`${baseUrl}/status`, {
      headers: { authorization: `Bearer ${makeAccessToken(["STAFF"])}` }
    });
    assert.equal(staffRes.status, 200);
    const staffData = await staffRes.json();
    assert.equal(staffData.status, "ready");

    // 4. ADMIN role -> 200 OK
    const adminRes = await fetch(`${baseUrl}/status`, {
      headers: { authorization: `Bearer ${makeAccessToken(["ADMIN"])}` }
    });
    assert.equal(adminRes.status, 200);

    // 5. Spoofed image file (PNG mimetype but fake bytes) -> rejected by magic bytes validation (400)
    const form = new FormData();
    const fakeBlob = new Blob(["not-a-real-png-bytes"], { type: "image/png" });
    form.append("file", fakeBlob, "fake.png");

    const fakeUploadRes = await fetch(`${baseUrl}/analyze`, {
      method: "POST",
      headers: { authorization: `Bearer ${makeAccessToken(["STAFF"])}` },
      body: form
    });
    assert.equal(fakeUploadRes.status, 400);

    // 6. Valid PNG magic bytes image upload -> 200
    const validPngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const validBlob = new Blob([validPngHeader], { type: "image/png" });
    const validForm = new FormData();
    validForm.append("file", validBlob, "test.png");

    const validUploadRes = await fetch(`${baseUrl}/analyze`, {
      method: "POST",
      headers: { authorization: `Bearer ${makeAccessToken(["STAFF"])}` },
      body: validForm
    });
    assert.equal(validUploadRes.status, 200);
    const analyzeData = await validUploadRes.json();
    assert.equal(analyzeData.conditionScore, 95);
  } finally {
    server.close();
  }
});

test("damage-inspection sanitizes internal 500 error messages", async () => {
  const failingService: DamageInspectionServicePort = {
    async initModel() { return true; },
    async getStatus() { return { status: "ready", runtime: "Node.js (ONNX Runtime)" }; },
    async analyze() {
      throw new Error("SECRET_DATABASE_CREDENTIAL_LEAK /internal/path/to/code.ts:123");
    }
  };

  const auth = createAuthMiddleware({
    authService: { validateAccessSession: async () => true },
    verifyAccessToken: (token) => jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload
  });

  const controller = createDamageInspectionController({ service: failingService });
  const routes = createDamageInspectionRoutes({ controller, auth });

  const app = express();
  app.use("/api/damage-inspection", routes);
  app.use(errorHandler);

  const server = app.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api/damage-inspection`;

  try {
    const validPngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const validBlob = new Blob([validPngHeader], { type: "image/png" });
    const validForm = new FormData();
    validForm.append("file", validBlob, "test.png");

    const res = await fetch(`${baseUrl}/analyze`, {
      method: "POST",
      headers: { authorization: `Bearer ${makeAccessToken(["STAFF"])}` },
      body: validForm
    });
    assert.equal(res.status, 500);
    const body = await res.json();
    // Verify sanitized error: no leaked path or internal message
    assert.equal(body.message, "Lỗi xử lý phân tích khuyết tật bề mặt.");
    assert.equal(JSON.stringify(body).includes("SECRET_DATABASE_CREDENTIAL_LEAK"), false);
  } finally {
    server.close();
  }
});
