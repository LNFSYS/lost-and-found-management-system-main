import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";
import type { RowDataPacket } from "mysql2/promise";
import { createApp } from "../main/app.js";
import { pool as defaultPool } from "../main/database.js";
import { createServices } from "../main/services.js";
import { createAuthSecurity } from "../modules/auth/infrastructure/auth-security.js";
import { createCloudinaryPrivateMediaStorage } from "../shared/infrastructure/cloudinary-private-media-storage.js";
import { env } from "../shared/infrastructure/config/env.js";
import type { Role } from "../shared/domain/auth.js";
import { withActorJourney } from "../test/actor-journey-fixture.js";

let phase = "ISOLATION_CHECK";
async function run() {
  if (process.env.LNFS_DB_INTEGRATION !== "1" || process.env.LNFS_TEST_DB_HOST !== "127.0.0.1" || !process.env.LNFS_TEST_DB_NAME?.endsWith("_test")) throw new Error("Explicit isolated SQL configuration required");
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) throw new Error("Live provider configuration required");
  await withActorJourney(async f => {
    const servers: Server[] = [];
    const directories: string[] = [];
    const services: ReturnType<typeof createServices>[] = [];
    const children: ChildProcess[] = [];
    const storage = createCloudinaryPrivateMediaStorage({ config: env.cloudinary, namespace: "warehouse-proof", allowLocalWrites: false,
      fetcher: url => fetch(url, { signal: AbortSignal.timeout(20_000) }) });
    const security = createAuthSecurity(env);
    const token = (id: string, roles: Role[]) => security.signAccessToken({ sub: id, email: `${id}@example.invalid`, roles, sessionVersion: 0 });
    const tokens = { staff: token(f.ids.staff, ["STAFF"]), admin: token(f.ids.admin, ["ADMIN"]), outsider: token(f.ids.outsider, ["STUDENT"]) };
    const source = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNXkAAAAASUVORK5CYII=", "base64");
    async function instance(configured = true) {
      const uploadDir = await mkdtemp(path.join(os.tmpdir(), "lnfs-cloud-api-"));
      directories.push(uploadDir);
      const api = createServices(f.p, { ...env, nodeEnv: "production", uploadDir, ...(configured ? {} : { cloudinary: { cloudName: null, apiKey: null, apiSecret: null } }) });
      services.push(api);
      const server = createApp({ services: api, checkReadiness: async () => { await f.pool.query("SELECT 1"); } }).listen(0, "127.0.0.1");
      servers.push(server);
      await once(server, "listening");
      return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/staff`, uploadDir };
    }
    async function independentProcess() {
      const uploadDir = await mkdtemp(path.join(os.tmpdir(), "lnfs-cloud-api-"));
      directories.push(uploadDir);
      const [database] = await f.pool.query<RowDataPacket[]>("SELECT DATABASE() AS name");
      const child = spawn(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./warehouse-cloud-acceptance-server.ts", import.meta.url))], {
        env: { ...process.env, NODE_ENV: "production", DB_HOST: "127.0.0.1", DB_PORT: process.env.LNFS_TEST_DB_PORT, DB_NAME: database[0].name,
          DB_USER: process.env.LNFS_TEST_DB_USER, DB_PASSWORD: process.env.LNFS_TEST_DB_PASSWORD, DB_SSL: "false", UPLOAD_DIR: uploadDir },
        windowsHide: true, stdio: ["ignore", "pipe", "pipe"]
      });
      children.push(child);
      child.stderr!.resume();
      const port = await new Promise<number>((resolve, reject) => {
        let output = "";
        const timer = setTimeout(() => reject(new Error("Acceptance process startup timed out")), 30_000);
        child.once("error", error => { clearTimeout(timer); reject(error); });
        child.once("exit", () => { clearTimeout(timer); reject(new Error("Acceptance process exited before readiness")); });
        child.stdout!.on("data", chunk => {
          output += chunk.toString();
          for (const line of output.split("\n")) {
            if (!line.startsWith("{")) continue;
            const value = JSON.parse(line) as { port?: number };
            if (value.port) { clearTimeout(timer); resolve(value.port); }
          }
        });
      });
      return { base: `http://127.0.0.1:${port}/api/staff`, child };
    }
    async function stopChild(child: ChildProcess) {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const stopped = once(child, "exit");
      child.kill("SIGTERM");
      await stopped;
    }
    async function upload(base: string, route: string, fields: Record<string, string>, status: number) {
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) form.set(key, value);
      form.set("file", new Blob([source], { type: "image/png" }), "synthetic.png");
      const response = await fetch(`${base}${route}`, { method: "POST", headers: { authorization: `Bearer ${tokens.staff}` }, body: form });
      assert.equal(response.status, status);
      return await response.json() as { id: string };
    }
    async function delivery(base: string, route: string, bearer: string | null, status: number) {
      const response = await fetch(`${base}${route}`, { headers: bearer ? { authorization: `Bearer ${bearer}` } : {} });
      assert.equal(response.status, status);
      const body = Buffer.from(await response.arrayBuffer());
      if (status === 200) {
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.equal(response.headers.get("content-type")?.startsWith("image/png"), true);
        assert.equal(body.subarray(1, 4).toString(), "PNG");
      }
      return body;
    }
    try {
      const a = await instance();
      const b = await instance();
      phase = "INTAKE_UPLOAD";
      const intakeKey = randomUUID();
      const intake = await upload(a.base, "/warehouse-intake-images", { intakeKey }, 201);
      phase = "PHYSICAL_INTAKE";
      const creation = await fetch(`${a.base}/warehouse-items`, { method: "POST", headers: { authorization: `Bearer ${tokens.staff}`, "content-type": "application/json" },
        body: JSON.stringify({ intakeKey, intakeImageIds: [intake.id], receivedQuantity: 1, accessories: "None", physicalReviewConfirmed: true,
          itemName: "Synthetic cloud acceptance fixture", handoverPointId: f.point, categoryId: f.categoryId, conditionNotes: "Synthetic item, no personal data" }) });
      assert.equal(creation.status, 201);
      const item = await creation.json() as { id: string };
      phase = "INDEPENDENT_INTAKE_DELIVERY";
      const imageRoute = `/warehouse-images/${intake.id}?provenance=INTAKE`;
      assert.deepEqual(await delivery(a.base, imageRoute, tokens.staff, 200), await delivery(b.base, imageRoute, tokens.staff, 200));
      await delivery(b.base, imageRoute, tokens.admin, 200);
      await delivery(b.base, imageRoute, tokens.outsider, 403);
      await delivery(b.base, imageRoute, null, 401);
      phase = "PROOF_UPLOAD";
      const proof = await upload(a.base, "/warehouse-items/upload-proof", { itemId: item.id }, 200);
      const proofRoute = `/warehouse-proofs/${proof.id}`;
      assert.deepEqual(await delivery(a.base, proofRoute, tokens.staff, 200), await delivery(b.base, proofRoute, tokens.admin, 200));
      await delivery(b.base, proofRoute, tokens.outsider, 403);
      await delivery(b.base, proofRoute, null, 401);
      phase = "SEPARATE_PROCESS_DELIVERY";
      const separate = await independentProcess();
      assert.deepEqual(await delivery(b.base, proofRoute, tokens.staff, 200), await delivery(separate.base, proofRoute, tokens.staff, 200));
      await delivery(separate.base, imageRoute, tokens.admin, 200);
      await delivery(separate.base, imageRoute, tokens.outsider, 403);
      await delivery(separate.base, proofRoute, null, 401);
      await stopChild(separate.child);
      const replacedProcess = await independentProcess();
      await delivery(replacedProcess.base, proofRoute, tokens.staff, 200);
      await delivery(replacedProcess.base, imageRoute, tokens.staff, 200);
      phase = "CANONICAL_OFFLINE_RETURN";
      const returned = await fetch(`${a.base}/warehouse-items/${item.id}/return`, { method: "POST", headers: { authorization: `Bearer ${tokens.staff}`, "content-type": "application/json" },
        body: JSON.stringify({ receiverName: "Synthetic Recipient", receiverIdentity: "TEST-ONLY-IDENTITY", receiverPhone: "0900000000", proofImage: proof.id, note: "Synthetic acceptance only" }) });
      assert.equal(returned.status, 200);
      assert.equal((await returned.json() as { status: string }).status, "RETURNED");
      phase = "RESTART_DELIVERY";
      a.server.closeAllConnections();
      await new Promise<void>(resolve => a.server.close(() => resolve()));
      const restarted = await instance();
      assert.deepEqual(await delivery(b.base, proofRoute, tokens.staff, 200), await delivery(restarted.base, proofRoute, tokens.staff, 200));
      await delivery(restarted.base, imageRoute, tokens.staff, 200);
      phase = "PRODUCTION_MISSING_CREDENTIALS";
      const bad = await instance(false);
      const [before] = await f.pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM warehouse_intake_images");
      await upload(bad.base, "/warehouse-intake-images", { intakeKey: randomUUID() }, 503);
      const [after] = await f.pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM warehouse_intake_images");
      assert.equal(after[0].total, before[0].total);
      assert.deepEqual(await readdir(bad.uploadDir), []);
      phase = "DRAFT_CLEANUP";
      const draftKey = randomUUID();
      const draft = await upload(b.base, "/warehouse-intake-images", { intakeKey: draftKey }, 201);
      const deleted = await fetch(`${b.base}/warehouse-intake-images/${draft.id}`, { method: "DELETE", headers: { authorization: `Bearer ${tokens.staff}`, "content-type": "application/json" }, body: JSON.stringify({ intakeKey: draftKey }) });
      assert.equal(deleted.status, 200);
      await deleted.json();
      await delivery(b.base, `/warehouse-images/${draft.id}?provenance=INTAKE`, tokens.staff, 404);
      phase = "ATTACHED_EVIDENCE_MAINTENANCE";
      await services[1].warehouseService.runMaintenance();
      await delivery(b.base, proofRoute, tokens.staff, 200);
      await delivery(b.base, imageRoute, tokens.staff, 200);
      phase = "UNSIGNED_PROVIDER_DENIAL";
      const [refs] = await f.pool.query<RowDataPacket[]>("SELECT storage_ref FROM warehouse_private_proofs WHERE id=?", [proof.id]);
      const publicId = refs[0].storage_ref.replace("cloudinary://warehouse-proof/", "lnfs/warehouse-proof/").replace(/\.png$/, "");
      const anonymous = await fetch(cloudinary.url(publicId, { secure: true, type: "authenticated", sign_url: false, resource_type: "image", format: "png" }), { signal: AbortSignal.timeout(20_000) });
      assert.ok([401, 403, 404].includes(anonymous.status));
      await anonymous.arrayBuffer();
      for (const directory of directories) assert.deepEqual(await readdir(directory), []);
      console.info(JSON.stringify({ status: "PASSED", independentInstances: 2, separateProcessDelivery: true, processReplacementDelivery: true, restartDelivery: true, rolePrivacy: true, canonicalOfflineReturn: true,
        missingConfigurationStatus: 503, instanceLocalWrites: 0, draftCleanup: true, attachedEvidenceRetained: true, anonymousProviderDenied: true }));
    } finally {
      for (const child of children) await stopChild(child);
      for (const api of services) api.realtimeService.stop();
      for (const server of servers) if (server.listening) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
      const [refs] = await f.pool.query<RowDataPacket[]>("SELECT storage_ref FROM warehouse_intake_images UNION SELECT storage_ref FROM warehouse_private_proofs");
      for (const ref of refs) if (String(ref.storage_ref).startsWith("cloudinary://warehouse-proof/")) await storage.remove(ref.storage_ref);
      for (const directory of directories) {
        if (!path.resolve(directory).startsWith(`${path.resolve(os.tmpdir())}${path.sep}lnfs-cloud-api-`)) throw new Error("Unsafe acceptance cleanup path");
        await rm(directory, { recursive: true, force: true });
      }
    }
  });
}
run().catch(error => { console.error("warehouse_cloud_acceptance_failed", { phase, causeCode: typeof error?.code === "string" ? error.code : "ACCEPTANCE_CHECK_FAILED" }); process.exitCode = 1; })
  .finally(() => defaultPool.end());
