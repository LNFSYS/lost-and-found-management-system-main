import { parseArgs } from "node:util";
import { env } from "../shared/infrastructure/config/env.js";
import { createDatabasePool } from "../shared/infrastructure/config/db.js";
import { recoverCustodyLinks } from "./custody-link-recovery.js";
import type { MigrationPool } from "./migration-state.js";

const { values } = parseArgs({ options: {
  apply: { type: "boolean", default: false },
  "confirm-database": { type: "string" }, "confirm-endpoint": { type: "string" }, "operation-ref": { type: "string" }
} });

async function run() {
  if (values.apply && (values["confirm-database"] !== env.db.name || values["confirm-endpoint"] !== `${env.db.host}:${env.db.port}` || !values["operation-ref"])) {
    throw new Error("Apply requires exact endpoint/database confirmation and an operation reference; preview makes no writes");
  }
  const pool = createDatabasePool();
  try {
    console.info(JSON.stringify(await recoverCustodyLinks({ pool: pool as unknown as MigrationPool, apply: values.apply,
      expectedDatabase: values["confirm-database"], operationRef: values["operation-ref"] }), null, 2));
  } finally { await pool.end(); }
}
run().catch((error: unknown) => {
  const code = (error as { code?: unknown }).code;
  console.error("Custody linkage recovery failed", typeof code === "string" ? code : error instanceof Error ? error.message : "unknown");
  process.exitCode = 1;
});
