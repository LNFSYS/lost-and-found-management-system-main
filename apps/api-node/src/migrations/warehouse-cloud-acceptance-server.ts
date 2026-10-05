import { env } from "../shared/infrastructure/config/env.js";

if (process.env.LNFS_DB_INTEGRATION !== "1" || env.db.host !== "127.0.0.1" || !/^lnfs_journey_[a-f0-9]{32}_test$/.test(env.db.name)) {
  throw new Error("Acceptance server requires a generated isolated loopback database");
}
const [{ createApp }, { pool }, { services }] = await Promise.all([
  import("../main/app.js"), import("../main/database.js"), import("../main/runtime.js")
]);
const server = createApp().listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address === "object") console.info(JSON.stringify({ port: address.port }));
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  services.realtimeService.stop();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
}
process.on("SIGTERM", () => { void stop(); });
process.on("SIGINT", () => { void stop(); });
