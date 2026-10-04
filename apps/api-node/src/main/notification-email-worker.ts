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

const shutdown = createShutdownHandler(async () => {
  if (timer) clearInterval(timer);
  const drained = await Promise.allSettled([emailTask.stop(), services.notificationEmailWorker.stop()]);
  await pool.end();
  if (drained.some(result => result.status === "rejected")) throw new Error("Email drain failed");
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
if (env.notificationEmail.workerEnabled) void emailTask.tick();
else void shutdown();
