import { env } from "../shared/infrastructure/config/env.js";
import { createApp } from "./app.js";
import { pool } from "./database.js";
import { services } from "./runtime.js";
import { checkWarehouseMaintenanceSchema } from "./warehouse-maintenance-schema.js";
import { createWarehouseMaintenanceTask } from "./warehouse-maintenance.js";

const app = createApp();
const server = app.listen(env.port, () => console.info(`LNFS auth API listening on http://localhost:${env.port}`));
let notificationWorkerRunning = false;
async function processNotificationEmailQueue() {
  if (notificationWorkerRunning) return;
  notificationWorkerRunning = true;
  try {
    await services.notificationEmailWorker.runOnce();
  } catch {
    console.warn("notification_email_worker_tick_failed", { errorCode: "WORKER_TICK_FAILED" });
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

async function shutdown() {
  clearInterval(warehouseMaintenanceTimer);
  if (notificationWorkerTimer) clearInterval(notificationWorkerTimer);
  server.close();
  await warehouseMaintenance.stop();
  await pool.end();
}
process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
