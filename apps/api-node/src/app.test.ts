import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApp } from "./app.js";
import { systemConfigService } from "./services/system-config.service.js";

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
