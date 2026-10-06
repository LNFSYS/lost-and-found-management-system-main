import { env } from "../shared/infrastructure/config/env.js";
import { createApp } from "./app.js";
import { pool } from "./database.js";
import { services } from "./runtime.js";
import { createMatchingRefreshWorker } from "../modules/matching/application/matching-refresh.worker.js";
import { checkWarehouseMaintenanceSchema } from "./warehouse-maintenance-schema.js";
import { createWarehouseMaintenanceTask } from "./warehouse-maintenance.js";
import { notificationEmailWorkerError } from "./notification-email-worker-error.js";
import { checkMatchingRefreshSchema } from "./matching-refresh-schema.js";
import { matchingRefreshWorkerError, type MatchingRefreshPhase } from "./matching-refresh-worker-error.js";
import { createBackgroundTask, createShutdownHandler } from "./background-task.js";

const app = createApp();
const server = app.listen(env.port, () => console.info(`LNFS auth API listening on http://localhost:${env.port}`));
const notificationEmailTask = createBackgroundTask(
  () => services.notificationEmailWorker.runOnce(),
  error => {
    console.warn("notification_email_worker_tick_failed", notificationEmailWorkerError(error));
  }
);
const notificationWorkerTimer = env.notificationEmail.workerEnabled
  ? setInterval(() => { void notificationEmailTask.tick(); }, env.notificationEmail.workerPollSeconds * 1_000)
  : null;
if (env.notificationEmail.workerEnabled) void notificationEmailTask.tick();
const warehouseMaintenance = createWarehouseMaintenanceTask({
  checkSchema: () => checkWarehouseMaintenanceSchema(pool),
  runOnce: async () => { await services.warehouseService.runMaintenance(); await services.claimService.cleanupContactPhotos(); },
  logger: console
});
const warehouseMaintenanceTimer = setInterval(() => { void warehouseMaintenance.tick(); }, 60_000);
void warehouseMaintenance.tick();

const matchingRefreshWorker = createMatchingRefreshWorker(services.matchingService, env.matchingRefresh);
let matchingSchemaReady = false;
let matchingSchemaWarning = false;
let matchingRefreshPhase: MatchingRefreshPhase = "SCHEMA_CHECK";
const matchingRefreshTask = createBackgroundTask(
  async () => {
    matchingRefreshPhase = matchingSchemaReady ? "REFRESH" : "SCHEMA_CHECK";
    if (!matchingSchemaReady) {
      matchingSchemaReady = await checkMatchingRefreshSchema(pool);
      if (!matchingSchemaReady) {
        if (!matchingSchemaWarning) console.warn("matching_refresh_paused", { errorCode: "MATCHING_LEASE_SCHEMA_REQUIRED", migration: "060_matching_refresh_leases.sql" });
        matchingSchemaWarning = true;
        return;
      }
      console.info("matching_refresh_ready", { schemaChecked: true });
    }
    matchingRefreshPhase = "REFRESH";
    await matchingRefreshWorker.runOnce();
  },
  error => {
    console.warn("matching_refresh_tick_failed", matchingRefreshWorkerError(error, matchingRefreshPhase));
  }
);
const matchingRefreshTimer = env.matchingRefresh.enabled
  ? setInterval(() => { void matchingRefreshTask.tick(); }, env.matchingRefresh.pollSeconds * 1_000)
  : null;
if (env.matchingRefresh.enabled) void matchingRefreshTask.tick();

const shutdown = createShutdownHandler(async () => {
  clearInterval(warehouseMaintenanceTimer);
  if (notificationWorkerTimer) clearInterval(notificationWorkerTimer);
  if (matchingRefreshTimer) clearInterval(matchingRefreshTimer);
  const httpClosed = new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  services.realtimeService.stop();
  // Drain HTTP, schema checks, SMTP acknowledgements and lease heartbeats before DB closure.
  const drained = await Promise.allSettled([
    httpClosed, warehouseMaintenance.stop(), matchingRefreshTask.stop(), matchingRefreshWorker.stop(),
    notificationEmailTask.stop(), services.notificationEmailWorker.stop()
  ]);
  await pool.end();
  if (drained.some(result => result.status === "rejected")) throw new Error("Shutdown drain failed");
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
