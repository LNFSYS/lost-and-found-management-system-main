import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createDatabasePool } from "../config/db.js";
import { env } from "../config/env.js";
import { reconcileClaimMigration } from "./reconcile-claim-migration.js";

async function run() {
  const { values } = parseArgs({ options: {
    apply: { type: "boolean", default: false }, "confirm-database": { type: "string" }, "confirm-endpoint": { type: "string" }
  }, allowPositionals: false });
  if (values.apply && (!values["confirm-database"] || values["confirm-endpoint"] !== `${env.db.host}:${env.db.port}`)) {
    throw new Error("Apply requires matching --confirm-endpoint host:port and --confirm-database after backup, restore rehearsal and operator approval");
  }
  const pool = createDatabasePool();
  try {
    console.info(JSON.stringify(await reconcileClaimMigration({
      directory: path.dirname(fileURLToPath(import.meta.url)), pool,
      apply: values.apply, expectedDatabase: values["confirm-database"]
    })));
  } finally { await pool.end(); }
}
run().catch((error: unknown) => {
  const databaseError = error as { code?: unknown };
  console.error("Reconciliation failed", typeof databaseError.code === "string" ? databaseError.code : error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
