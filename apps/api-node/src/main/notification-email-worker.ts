import { env } from "../shared/infrastructure/config/env.js";
import { services } from "./runtime.js";

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    await services.notificationEmailWorker.runOnce();
  } catch {
    // The application worker must never reveal SMTP/provider payloads in logs.
    console.warn("notification_email_worker_tick_failed", { errorCode: "WORKER_TICK_FAILED" });
  } finally {
    running = false;
  }
}

if (!env.notificationEmail.workerEnabled) process.exitCode = 0;
else {
  void tick();
}
const timer = env.notificationEmail.workerEnabled
  ? setInterval(() => { void tick(); }, env.notificationEmail.workerPollSeconds * 1_000)
  : null;

async function shutdown() {
  if (timer) clearInterval(timer);
  const { pool } = await import("./database.js");
  await pool.end();
}
process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
