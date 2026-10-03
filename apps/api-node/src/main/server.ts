import { env } from "../shared/infrastructure/config/env.js";
import { createApp } from "./app.js";
import { pool } from "./database.js";
import { services } from "./runtime.js";
import { createMatchingRefreshWorker } from "../modules/matching/application/matching-refresh.worker.js";
import { checkWarehouseMaintenanceSchema } from "./warehouse-maintenance-schema.js";
import { createWarehouseMaintenanceTask } from "./warehouse-maintenance.js";
import { notificationEmailWorkerError } from "./notification-email-worker-error.js";
import { checkMatchingRefreshSchema } from "./matching-refresh-schema.js";

const app = createApp();
const server = app.listen(env.port, () => console.info(`LNFS auth API listening on http://localhost:${env.port}`));
let notificationWorkerRunning = false;
async function processNotificationEmailQueue() {
  if (notificationWorkerRunning) return;
  notificationWorkerRunning = true;
  try {
    await services.notificationEmailWorker.runOnce();
  } catch (error) {
    console.warn("notification_email_worker_tick_failed", notificationEmailWorkerError(error));
  } finally {
    notificationWorkerRunning = false;
  }
}
const notificationWorkerTimer = env.notificationEmail.workerEnabled
  ? setInterval(() => { void processNotificationEmailQueue(); }, env.notificationEmail.workerPollSeconds * 1_000)
  : null;
if (env.notificationEmail.workerEnabled) void processNotificationEmailQueue();
const warehouseMaintenance = createWarehouseMaintenanceTask({
  checkSchema: () => checkWarehouseMaintenanceSchema(pool),
  runOnce: () => services.warehouseService.runMaintenance(),
  logger: console
});
const warehouseMaintenanceTimer = setInterval(() => { void warehouseMaintenance.tick(); }, 60_000);
void warehouseMaintenance.tick();

const matchingRefreshWorker = createMatchingRefreshWorker(services.matchingService, env.matchingRefresh);
let matchingSchemaReady = false;
let matchingSchemaWarning = false;
async function processMatchingRefresh() {
  try {
    if (!matchingSchemaReady) {
      matchingSchemaReady = await checkMatchingRefreshSchema(pool);
      if (!matchingSchemaReady) {
        if (!matchingSchemaWarning) console.warn("matching_refresh_paused", { errorCode: "MATCHING_LEASE_SCHEMA_REQUIRED", migration: "060_matching_refresh_leases.sql" });
        matchingSchemaWarning = true;
        return;
      }
      console.info("matching_refresh_ready", { schemaChecked: true });
    }
    await matchingRefreshWorker.runOnce();
  } catch {
    console.warn("matching_refresh_tick_failed", { errorCode: "MATCH_REFRESH_TICK_FAILED" });
  }
}
const matchingRefreshTimer = env.matchingRefresh.enabled
  ? setInterval(() => { void processMatchingRefresh(); }, env.matchingRefresh.pollSeconds * 1_000)
  : null;
if (env.matchingRefresh.enabled) void processMatchingRefresh();

async function shutdown() {
  clearInterval(warehouseMaintenanceTimer);
  if (notificationWorkerTimer) clearInterval(notificationWorkerTimer);
  if (matchingRefreshTimer) clearInterval(matchingRefreshTimer);
  server.close();
  await warehouseMaintenance.stop();
  await matchingRefreshWorker.stop();
  await pool.end();
}
process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
