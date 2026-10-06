import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { createAuthRoutes } from "./auth.routes.js";
import type { AuthController } from "./auth.controller.js";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";

test("refresh has a separate bounded IP budget, including invalid cookies and spoofed identities", async () => {
  let refreshed = 0;
  const controller = {
    async refresh(request, response) {
      refreshed++;
      const token = request.header("cookie") ?? "";
      response.status(token.startsWith("lnfs_refresh=valid-") ? 200 : 401).json({ authenticated: token.startsWith("lnfs_refresh=valid-") });
    },
    async register(_request, response) { response.status(422).json({ message: "Invalid registration" }); },
    async resetPassword(_request, response) { response.status(422).json({ message: "Invalid reset" }); }
  } as AuthController;
  const app = express();
  app.set("trust proxy", false);
  const auth: AuthMiddleware = {
    async requireAuth(_request, response) { response.sendStatus(401); },
    async optionalAuth(_request, _response, next) { next(); },
    requireAnyRole: () => (_request, _response, next) => { next(); }
  };
  app.use(createAuthRoutes({ authController: controller, auth }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (let index = 0; index < 10; index++) assert.equal((await fetch(`${base}/register`, { method: "POST" })).status, 422);
    assert.equal((await fetch(`${base}/reset-password`, { method: "POST" })).status, 429);
    for (let index = 0; index < 30; index++) {
      assert.equal((await fetch(`${base}/refresh`, { method: "POST", headers: { cookie: `lnfs_refresh=valid-${index % 3}` } })).status, 200);
    }
    assert.equal((await fetch(`${base}/refresh`, { method: "POST" })).status, 401);
    for (let index = 31; index < 120; index++) {
      assert.equal((await fetch(`${base}/refresh`, { method: "POST", headers: { cookie: `lnfs_refresh=fabricated-${index}`, "x-user-id": String(index), "x-forwarded-for": `198.51.100.${index}` } })).status, 401);
    }
    const blocked = await fetch(`${base}/refresh`, { method: "POST", headers: { cookie: "lnfs_refresh=valid-another-session", "x-forwarded-for": "203.0.113.9" } });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    assert.equal(refreshed, 120);
  } finally {
    server.close();
    await once(server, "close");
  }
});
