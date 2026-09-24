import { env } from "../shared/infrastructure/config/env.js";
import { createApp } from "./app.js";
import { pool } from "./database.js";
import { services } from "./runtime.js";

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

async function shutdown() {
  if (notificationWorkerTimer) clearInterval(notificationWorkerTimer);
  server.close();
  await pool.end();
}
process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
