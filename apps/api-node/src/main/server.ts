import { env } from "../shared/infrastructure/config/env.js";
import { createApp } from "./app.js";
import { pool } from "./database.js";
import { services } from "./runtime.js";
import { createMatchingRefreshWorker } from "../modules/matching/application/matching-refresh.worker.js";

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

const matchingRefreshWorker = createMatchingRefreshWorker(services.matchingService, env.matchingRefresh);
async function processMatchingRefresh() {
  try {
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
  if (notificationWorkerTimer) clearInterval(notificationWorkerTimer);
  if (matchingRefreshTimer) clearInterval(matchingRefreshTimer);
  server.close();
  await pool.end();
}
process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
