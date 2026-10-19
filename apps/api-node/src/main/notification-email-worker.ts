import { env } from "../shared/infrastructure/config/env.js";
import { services } from "./runtime.js";
import { notificationEmailWorkerError } from "./notification-email-worker-error.js";
import { pool } from "./database.js";
import { createBackgroundTask, createShutdownHandler } from "./background-task.js";

const emailTask = createBackgroundTask(
  () => services.notificationEmailWorker.runOnce(),
  error => {
    // The application worker must never reveal SMTP/provider payloads in logs.
    console.warn("notification_email_worker_tick_failed", notificationEmailWorkerError(error));
  }
);
const timer = env.notificationEmail.workerEnabled
  ? setInterval(() => { void emailTask.tick(); }, env.notificationEmail.workerPollSeconds * 1_000)
  : null;
const pushTask = services.notificationPushWorker ? createBackgroundTask(
  () => services.notificationPushWorker!.runOnce(),
  error => console.warn("notification_push_worker_tick_failed", notificationEmailWorkerError(error))
) : null;
const pushTimer = env.notificationEmail.workerEnabled && pushTask
  ? setInterval(() => { void pushTask.tick(); }, env.notificationEmail.workerPollSeconds * 1_000)
  : null;

const shutdown = createShutdownHandler(async () => {
  if (timer) clearInterval(timer);
  if (pushTimer) clearInterval(pushTimer);
  const drained = await Promise.allSettled([
    emailTask.stop(), services.notificationEmailWorker.stop(),
    ...(pushTask && services.notificationPushWorker ? [pushTask.stop(), services.notificationPushWorker.stop()] : [])
  ]);
  await pool.end();
  if (drained.some(result => result.status === "rejected")) throw new Error("Email drain failed");
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
if (env.notificationEmail.workerEnabled) {
  void emailTask.tick();
  if (pushTask) void pushTask.tick();
} else void shutdown();
