import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test, { type TestContext } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import type { AccessTokenPayload } from "../../../../shared/domain/auth.js";
import { createAuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import { errorHandler } from "../../../../shared/interfaces/http/error-handler.js";
import { createRealtimeUseCases } from "../../application/realtime.use-cases.js";
import { createRealtimeController } from "./realtime.controller.js";
import { createRealtimeRoutes } from "./realtime.routes.js";

async function fixture(t: TestContext, expiresIn: number) {
  let active = true;
  const secret = "isolated-realtime-test-only";
  const validateSession = async () => active;
  const service = createRealtimeUseCases({ claimRepository: { findRoomForParticipant: async () => null }, id: () => "test-stream", validateSession });
  const auth = createAuthMiddleware({ authService: { validateAccessSession: validateSession }, verifyAccessToken: token => jwt.verify(token, secret) as AccessTokenPayload });
  const app = express();
  app.use("/realtime", createRealtimeRoutes({ auth, realtimeController: createRealtimeController({ realtimeService: service }) }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { service.stop(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const token = jwt.sign({ sub: "user", email: "test@example.invalid", roles: ["STUDENT"], sessionVersion: 0 }, secret, { expiresIn });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/realtime`;
  const headers = { authorization: `Bearer ${token}` };
  const response = await fetch(url, { headers });
  assert.equal(response.status, 200);
  const reader = response.body!.getReader();
  await reader.read();
  t.after(() => reader.cancel());
  return { service, reader, url, headers, revoke: () => { active = false; } };
}

test("HTTP SSE expires idle streams at JWT expiry, with no late delivery", { timeout: 4000 }, async t => {
  const f = await fixture(t, 2);
  assert.equal((await f.reader.read()).done, true);
  assert.equal(f.service.stats().connections, 0);
  const rejected = await fetch(f.url, { headers: f.headers });
  assert.equal(rejected.status, 401);
  await rejected.text();
});

test("HTTP SSE rejects revoked sessions before publishing another notification", { timeout: 4000 }, async t => {
  const f = await fixture(t, 60);
  f.revoke();
  const rejected = await fetch(f.url, { headers: f.headers });
  assert.equal(rejected.status, 401);
  await rejected.text();
  const delivery = await f.service.publishNotification({ userId: "user", workflow: "CUSTODY", notification: {
    id: "after-revocation", type: "CLAIM_ACCEPTED", title: "Synthetic", body: "No shared data", entityType: "CLAIM", entityId: "test", isRead: false, readAt: null, createdAt: new Date().toISOString()
  } });
  assert.deepEqual(delivery, { delivered: 0 });
  assert.equal((await f.reader.read()).done, true);
  assert.equal(f.service.stats().connections, 0);
});

test("HTTP SSE registration failure keeps a normal JSON error response", { timeout: 4000 }, async t => {
  const secret = "isolated-registration-test-only";
  const service = createRealtimeUseCases({ claimRepository: { findRoomForParticipant: async () => null }, id: () => "rejected-stream", validateSession: async () => false });
  const auth = createAuthMiddleware({ authService: { validateAccessSession: async () => true }, verifyAccessToken: token => jwt.verify(token, secret) as AccessTokenPayload });
  const app = express();
  app.use("/realtime", createRealtimeRoutes({ auth, realtimeController: createRealtimeController({ realtimeService: service }) }));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { service.stop(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const token = jwt.sign({ sub: "user", email: "test@example.invalid", roles: ["STUDENT"], sessionVersion: 0 }, secret, { expiresIn: 60 });
  const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/realtime`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 401);
  assert.match(response.headers.get("content-type")!, /^application\/json/);
  assert.equal((await response.json() as { message: string }).message, "Realtime session has expired");
  assert.equal(service.stats().connections, 0);
});
