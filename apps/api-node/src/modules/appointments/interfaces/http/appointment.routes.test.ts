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
import { createAppointmentRoutes } from "./appointment.routes.js";
import type { createAppointmentUseCases } from "../../application/appointment.use-cases.js";

function makeAccessToken(roles: Role[] = ["USER"]) {
  return jwt.sign({ sub: "user-test", email: "user@example.com", roles, sessionVersion: 0 }, env.jwtAccessSecret, { expiresIn: "1h" });
}

test("appointment shortcut routes validate body with Zod schemas", async () => {
  let capturedActInput: any = null;

  const mockService = {
    async get(_userId: string, _id: string) {
      return { id: "11111111-1111-4111-8111-111111111111", version: 1 };
    },
    async act(userId: string, appointmentId: string, payload: any) {
      capturedActInput = { userId, appointmentId, payload };
      return { id: appointmentId, status: "ACCEPTED", version: payload.version + 1 };
    }
  } as unknown as ReturnType<typeof createAppointmentUseCases>;

  const auth = createAuthMiddleware({
    authService: { validateAccessSession: async () => true },
    verifyAccessToken: (token) => jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload
  });

  const routes = createAppointmentRoutes(mockService, auth);
  const app = express();
  app.use(express.json());
  app.use("/api/appointments", routes);
  app.use(errorHandler);

  const server = app.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api/appointments`;
  const appointmentId = "11111111-1111-4111-8111-111111111111";

  try {
    const token = makeAccessToken(["USER"]);

    // 1. Invalid/unknown property in /accept body -> 422 Unprocessable Entity
    const invalidAcceptRes = await fetch(`${baseUrl}/${appointmentId}/accept`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ unknownProperty: "attack", version: 1 })
    });
    assert.equal(invalidAcceptRes.status, 422);

    // 2. Valid empty body in /accept -> 200 OK
    const validAcceptRes = await fetch(`${baseUrl}/${appointmentId}/accept`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(validAcceptRes.status, 200);
    assert.equal(capturedActInput.payload.action, "ACCEPT");
    assert.equal(capturedActInput.payload.version, 1);

    // 3. Valid /reject with reason
    const validRejectRes = await fetch(`${baseUrl}/${appointmentId}/reject`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ reason: "Bận việc đột xuất", version: 2 })
    });
    assert.equal(validRejectRes.status, 200);
    assert.equal(capturedActInput.payload.action, "REJECT");
    assert.equal(capturedActInput.payload.reason, "Bận việc đột xuất");
    assert.equal(capturedActInput.payload.version, 2);

    // 4. Invalid extra field in /cancel -> 422
    const invalidCancelRes = await fetch(`${baseUrl}/${appointmentId}/cancel`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ maliciousField: true })
    });
    assert.equal(invalidCancelRes.status, 422);

    // 5. Valid /confirm-handover
    const validConfirmRes = await fetch(`${baseUrl}/${appointmentId}/confirm-handover`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ physicallyChecked: true })
    });
    assert.equal(validConfirmRes.status, 200);
    assert.equal(capturedActInput.payload.action, "CONFIRM");
    assert.equal(capturedActInput.payload.physicallyChecked, true);
  } finally {
    server.close();
  }
});
