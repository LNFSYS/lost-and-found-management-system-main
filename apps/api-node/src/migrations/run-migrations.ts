import { fileURLToPath } from "node:url";
import path from "node:path";
import { createMigrationPool } from "../config/db.js";
import { runMigrations, type MigrationPool } from "./migration-runner.js";

async function run() {
  const migrationsDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationPool = createMigrationPool();
  try {
    await runMigrations({ directory: migrationsDir, pool: migrationPool as unknown as MigrationPool });
  } finally {
    await migrationPool.end();
  }
}

run().catch((error) => {
  console.error("Migration failed", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
