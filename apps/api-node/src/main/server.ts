import { env } from "../shared/infrastructure/config/env.js";
import { id } from "../shared/infrastructure/security.js";
import { createApp } from "./app.js";
import { pool } from "./database.js";
import { persistence, services } from "./runtime.js";
import { createRetentionAlertScheduler } from "../modules/warehouse/infrastructure/retention-alert.scheduler.js";

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

const retentionAlerts = createRetentionAlertScheduler({ db: pool, notificationRepository: persistence.notificationRepository, id });
let retentionScanRunning = false;
async function scanRetentionAlerts() {
  if (retentionScanRunning) return;
  retentionScanRunning = true;
  try {
    await retentionAlerts.scanAndAlertOverdue();
  } catch (error) {
    console.warn("retention_alert_scan_failed", error);
  } finally {
    retentionScanRunning = false;
  }
}
const retentionTimer = setInterval(() => { void scanRetentionAlerts(); }, 24 * 60 * 60 * 1_000);
void scanRetentionAlerts();

async function shutdown() {
  if (notificationWorkerTimer) clearInterval(notificationWorkerTimer);
  clearInterval(retentionTimer);
  server.close();
  await pool.end();
}
process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
