import assert from "node:assert/strict";
import { mock } from "node:test";
import { createServer, get } from "node:http";
import { createNotificationEmailWorker } from "../modules/notifications/application/notification-email.worker.ts";

const [entry, outcome] = process.argv.slice(2);
const events = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let startHttp;
const httpStarted = new Promise(resolve => { startHttp = resolve; });
const source = path => new URL(path, import.meta.url).href;
const replace = (path, namedExports) => mock.module(source(path), { namedExports });
let poolClosed = false;
let claims = 0;
const item = { id: "email", notificationId: "notification", recipientUserId: "user", eventType: "CLAIM", entityType: "CLAIM", entityId: "claim", roomId: null, deliveryMode: "IMMEDIATE", idempotencyKey: "stable", attemptCount: 1 };
const emailWorker = createNotificationEmailWorker({
  repository: {
    claimDue: async () => { claims++; return [item]; },
    claimCoalesced: async () => {},
    listLease: async () => [{ ...item, email: "fixture@example.invalid", emailVerified: true, accountActive: true, notificationUnread: true, entityAccessible: true }],
    getPreferences: async () => ({ chatMode: "IMMEDIATE", claimMode: "IMMEDIATE", timezone: "UTC" }),
    renewLease: async () => { assert.equal(poolClosed, false); events.push("lease.renew"); return true; },
    markSent: async () => { assert.equal(poolClosed, false); await delay(40); events.push("smtp.ack"); },
    cancelLease: async () => { assert.equal(poolClosed, false); await delay(40); events.push("smtp.cancel"); }
  },
  emailDelivery: { send: async () => {
    if (entry === "server") await httpStarted;
    events.push("smtp.started");
    process.emit("SIGTERM");
    process.emit("SIGINT");
    process.emit("SIGTERM");
    await delay(140);
    events.push("smtp.completed");
    assert.equal(poolClosed, false);
    if (outcome === "failure") throw new Error("Uncertain delivery");
    return {};
  } },
  leaseSeconds: 0.12, id: () => "lease", frontendUrl: "https://fixture.example.invalid", logger: { warn() {} }
});
replace("../shared/infrastructure/config/env.ts", { env: {
  port: 0, notificationEmail: { workerEnabled: outcome !== "disabled", workerPollSeconds: 0.01 },
  matchingRefresh: { enabled: true, pollSeconds: 0.01 }
} });
replace("../main/database.ts", { pool: { end: async () => {
  assert.equal(poolClosed, false);
  poolClosed = true;
  events.push("pool.end");
} } });
replace("../main/runtime.ts", { services: {
  notificationEmailWorker: emailWorker, matchingService: {},
  warehouseService: { runMaintenance: async () => { assert.equal(poolClosed, false); } },
  realtimeService: { stop: () => { events.push("sse.stop"); } }
} });
replace("../main/warehouse-maintenance-schema.ts", { checkWarehouseMaintenanceSchema: async () => {
  await delay(90); assert.equal(poolClosed, false); events.push("warehouse.schema"); return { ready: true, missing: [] };
} });
replace("../main/matching-refresh-schema.ts", { checkMatchingRefreshSchema: async () => {
  await delay(110); assert.equal(poolClosed, false); events.push("matching.schema"); return true;
} });
let matchingStopped = false;
replace("../modules/matching/application/matching-refresh.worker.ts", { createMatchingRefreshWorker: () => ({
  runOnce: async () => { assert.equal(matchingStopped, true); },
  stop: async () => { matchingStopped = true; }
}) });
replace("../main/app.ts", { createApp: () => ({ listen: (port, callback) => {
  const server = createServer(async (_request, response) => {
    startHttp();
    await delay(210);
    assert.equal(poolClosed, false);
    events.push("http.completed");
    response.end("done");
  });
  return server.listen(port, "127.0.0.1", () => {
    callback();
    get(`http://127.0.0.1:${server.address().port}`, response => response.resume());
  });
} }) });
process.on("beforeExit", () => {
  assert.equal(events.filter(event => event === "pool.end").length, 1);
  if (outcome === "disabled") assert.equal(claims, 0);
  else {
    assert.equal(claims, 1);
    assert.ok(events.indexOf("pool.end") > events.indexOf("smtp.completed"));
    assert.ok(events.indexOf("pool.end") > events.indexOf(outcome === "success" ? "smtp.ack" : "smtp.cancel"));
    if (entry === "server") {
      for (const phase of ["http.completed", "warehouse.schema", "matching.schema", "sse.stop"]) {
        assert.ok(events.indexOf(phase) >= 0);
        assert.ok(events.indexOf("pool.end") > events.indexOf(phase));
      }
    }
  }
  console.info("shutdown_drained", JSON.stringify(events));
});
await import(source(`../main/${entry}.ts`));
