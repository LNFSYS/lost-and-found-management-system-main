import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./config/db.js";

const app = createApp();
const server = app.listen(env.port, () => console.info(`LNFS auth API listening on http://localhost:${env.port}`));

async function shutdown() {
  server.close();
  await pool.end();
}
process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
