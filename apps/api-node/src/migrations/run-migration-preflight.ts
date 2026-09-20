import { fileURLToPath } from "node:url";
import path from "node:path";
import { createDatabasePool } from "../shared/infrastructure/config/db.js";
import { preflightMigrations } from "./migration-preflight.js";
import type { MigrationPool } from "./migration-state.js";

async function run() {
  const pool = createDatabasePool();
  try {
    const result = await preflightMigrations({
      directory: path.dirname(fileURLToPath(import.meta.url)),
      pool: pool as unknown as MigrationPool
    });
    console.info(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  const databaseError = error as { code?: unknown };
  console.error("Migration preflight failed",
    typeof databaseError.code === "string" ? databaseError.code : error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
