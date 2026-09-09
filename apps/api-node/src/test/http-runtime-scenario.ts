import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { createApp } from "../main/app.js";
import { createPersistence } from "../main/persistence.js";
import { createServices } from "../main/services.js";
import { env } from "../shared/infrastructure/config/env.js";

export async function exerciseHttpRuntime(pool: Pool) {
  const [database] = await pool.query<RowDataPacket[]>("SELECT DATABASE() AS name");
  assert.match(database[0].name, /^lnfs_reconcile_[a-f0-9]{32}_test$/);
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), "lnfs-http-test-"));
  const services = createServices(createPersistence(pool), { ...env, uploadDir });
  const server = createApp({ services, checkReadiness: async () => { await pool.query("SELECT 1"); } }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  async function request(route: string, status: number, token?: string, method = "GET", body?: unknown, extraHeaders: Record<string, string> = {}) {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: { Origin: "http://localhost:5173", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...extraHeaders },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body)
    });
    assert.equal(response.status, status, `${method} ${route}: ${response.status} ${response.status !== status ? await response.text() : ""}`);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
    return response;
  }
  const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  function imageForm(evidence = false) {
    const form = new FormData();
    form.set("file", new Blob([imageBytes], { type: "image/jpeg" }), "fixture.jpg");
    if (!evidence) form.set("mediaKind", "ITEM");
    return form;
  }
  try {
    const password = "isolated-http-password";
    const hash = await bcrypt.hash(password, 4);
    const members = ["finder", "owner", "outsider", "staff", "admin"] as const;
    const tokens = {} as Record<typeof members[number], string>;
    let originalCookie = "";
    for (const member of members) {
      const id = randomUUID();
      const email = `${id}@example.invalid`;
      await pool.execute("INSERT INTO users (id,email,normalized_email,password_hash,full_name,email_verified_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP())", [id, email, email, hash, `HTTP ${member}`]);
      await pool.execute("INSERT INTO user_roles (user_id,role_code) VALUES (?, 'USER')", [id]);
      if (member === "staff" || member === "admin") await pool.execute("INSERT INTO user_roles (user_id,role_code) VALUES (?,?)", [id, member.toUpperCase()]);
      const login = await request("/auth/login", 200, undefined, "POST", { email, password });
      tokens[member] = (await login.json()).accessToken;
      if (member === "owner") {
        originalCookie = login.headers.get("set-cookie")!.split(";")[0];
        assert.match(login.headers.get("set-cookie")!, /HttpOnly/i);
        assert.match(login.headers.get("set-cookie")!, /SameSite=Lax/i);
      }
    }
    const refreshed = await request("/auth/refresh", 200, undefined, "POST", {}, { Cookie: originalCookie });
    assert.notEqual(refreshed.headers.get("set-cookie")!.split(";")[0], originalCookie);
    tokens.owner = (await refreshed.json()).accessToken;
    await request("/auth/refresh", 401, undefined, "POST", {}, { Cookie: originalCookie });
    await request("/auth/me", 200, tokens.owner);
    await request("/auth/activity", 200, tokens.owner);

    const catalog = await (await request("/posts/catalog", 200, tokens.owner)).json();
    const categoryId = catalog.categories.find((item: { parentId: string | null }) => item.parentId)?.id;
    const areaId = catalog.areas[0]?.id;
    const handoverPointId = catalog.handoverPoints[0]?.id;
    assert.ok(categoryId && areaId && handoverPointId, "migrated catalog seed must be available");
    const postBody = { title: "Black wallet with student card", description: "Black leather wallet with student card SE123456 inside", categoryId, areaId, contactInfo: "fixture@example.invalid", lostFoundAt: new Date(Date.now() - 60_000).toISOString(), analysisSignals: { visualAttributes: ["black wallet"], visibleText: ["SE123456"], confidence: 0.95 } };
    const found = await (await request("/posts", 201, tokens.finder, "POST", { ...postBody, type: "FOUND", visibilityMode: "PRIVATE_DETAILS" })).json();
    const lost = await (await request("/posts", 201, tokens.owner, "POST", { ...postBody, type: "LOST" })).json();
    const board = await (await request("/posts", 200, tokens.outsider)).json();
    assert.ok(!board.items.some((item: { id: string }) => item.id === found.id));
    const own = await (await request("/posts/mine", 200, tokens.finder)).json();
    assert.ok(own.items.some((item: { id: string }) => item.id === found.id));
    const matches = await (await request(`/posts/${lost.id}/matches`, 200, tokens.owner)).json();
    const match = matches.results.find((item: { candidate: { id: string } }) => item.candidate.id === found.id);
    assert.ok(match && match.totalScore >= matches.thresholds.suggestion);
    assert.equal(match.candidate.description, null);
    await request(`/posts/${lost.id}/matches`, 403, tokens.outsider);
    await request(`/posts/${lost.id}`, 404, tokens.outsider, "PATCH", { title: "Unauthorized" });

    const media = await (await request(`/posts/${found.id}/media`, 201, tokens.finder, "POST", imageForm())).json();
    await request(media.url.replace(/^\/api/, ""), 403, tokens.outsider);
    const downloaded = await request(media.url.replace(/^\/api/, ""), 200, tokens.finder);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), imageBytes);
    const invalidUpload = new FormData();
    invalidUpload.set("file", new Blob(["not an image"], { type: "image/jpeg" }), "invalid.jpg");
    invalidUpload.set("mediaKind", "ITEM");
    await request(`/posts/${found.id}/media`, 415, tokens.finder, "POST", invalidUpload);

    const claimBody = { lostPostId: lost.id, foundPostId: found.id, description: "I can describe the contents", requestKey: "http-claim-key" };
    const created = await (await request("/claims", 201, tokens.owner, "POST", claimBody)).json();
    const claimId = created.id;
    const retried = await (await request("/claims", 200, tokens.owner, "POST", claimBody)).json();
    assert.equal(retried.id, claimId);
    await request(`/claims/${claimId}`, 404, tokens.outsider);
    await request(`/claims/${claimId}/messages`, 404, tokens.owner);
    await request(`/claims/${claimId}/decision`, 200, tokens.finder, "POST", { decision: "ACCEPT" });
    const messageBody = { content: "The card is inside the wallet", clientMessageId: "http-message-key" };
    const first = await (await request(`/claims/${claimId}/messages`, 201, tokens.owner, "POST", messageBody)).json();
    const second = await (await request(`/claims/${claimId}/messages`, 201, tokens.owner, "POST", messageBody)).json();
    assert.equal(first.id, second.id);
    const evidence = await (await request(`/claims/${claimId}/evidence`, 201, tokens.owner, "POST", imageForm(true))).json();
    await request(`/claims/${claimId}/evidence/${evidence.id}`, 404, tokens.outsider);
    const evidenceImage = await request(`/claims/${claimId}/evidence/${evidence.id}`, 200, tokens.finder);
    assert.equal(evidenceImage.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(Buffer.from(await evidenceImage.arrayBuffer()), imageBytes);
    await request("/notifications", 200, tokens.finder);

    await request("/staff/warehouse-items", 403, tokens.owner);
    const item = await (await request("/staff/warehouse-items", 201, tokens.staff, "POST", { handoverPointId, itemName: "HTTP warehouse fixture", conditionNotes: "Good condition", categoryId, areaId })).json();
    await request(`/staff/warehouse-items/${item.id}`, 200, tokens.staff, "PATCH", { status: "STORED", storageCode: "TEST-A1", note: "Stored by integration test" });
    await request(`/staff/warehouse-items/${item.id}/logs`, 200, tokens.staff);
    await request("/admin/users", 403, tokens.staff);
    await request("/admin/users", 200, tokens.admin);
    await request("/admin/configs", 200, tokens.admin);
    await request("/admin/statistics/export", 422, tokens.admin, "POST", { format: "INVALID" });
    const [failedExports] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM admin_audit_logs WHERE action = 'ADMIN_STATISTICS_EXPORT_FAILED'");
    assert.ok(Number(failedExports[0].total) > 0);
  } finally {
    server.close();
    await once(server, "close");
    await rm(uploadDir, { recursive: true, force: true });
  }
}
