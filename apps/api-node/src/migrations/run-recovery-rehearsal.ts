import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import mysql from "mysql2/promise";
import { captureRecoveryBackup, decryptBackup, restoreRecoveryBackup, verifyRecoveryForeignKeys } from "./database-recovery-backup.js";
import { runMigrations } from "./migration-runner.js";
import { preflightMigrations } from "./migration-preflight.js";
import { recoverCustodyLinks } from "./custody-link-recovery.js";
import { checkWarehouseMaintenanceSchema } from "../main/warehouse-maintenance-schema.js";
import type { MigrationPool } from "./migration-state.js";

const { values } = parseArgs({ options: { backup: { type: "string" }, key: { type: "string" }, "reviewed-dangling-warehouse-count": { type: "string" }, "reviewed-storage-orphan-count": { type: "string" } } });
async function run() {
  if (!values.backup || !values.key) throw new Error("Encrypted backup and separate key paths required");
  const backup = decryptBackup(await readFile(values.backup), await readFile(values.key));
  const options = { host: process.env.LNFS_TEST_DB_HOST ?? "", port: Number(process.env.LNFS_TEST_DB_PORT), user: process.env.LNFS_TEST_DB_USER,
    password: process.env.LNFS_TEST_DB_PASSWORD, multipleStatements: true, timezone: "Z" };
  if (!["127.0.0.1", "localhost", "::1"].includes(options.host) || !options.user || !options.password) throw new Error("Explicit loopback test credentials required; shared Aiven is forbidden");
  const admin = mysql.createPool(options), name = `lnfs_recovery_${randomUUID().replaceAll("-", "")}_test`;
  const pool = mysql.createPool({ ...options, database: name }), migrationPool = pool as unknown as MigrationPool;
  let created = false;
  try {
    await admin.query("CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", [name]); created = true;
    const count = Number(values["reviewed-dangling-warehouse-count"] ?? 0);
    const storageCount = Number(values["reviewed-storage-orphan-count"] ?? 0);
    if ([count, storageCount].some(value => !Number.isInteger(value) || value < 0)) throw new Error("Invalid reviewed orphan count");
    await restoreRecoveryBackup(pool, backup, [
      ...(count ? [{ table: "custody_requests", constraint: "fk_custody_req_warehouse", count }] : []),
      ...(storageCount ? [{ table: "storage_logs", constraint: "fk_storage_logs_warehouse_item", count: storageCount }] : [])
    ]);
    const restored = await captureRecoveryBackup(pool);
    const ordered = (rows: unknown[][]) => rows.map(row => JSON.stringify(row)).sort();
    for (const table of backup.tables) assert.deepEqual(ordered(restored.tables.find(row => row.name === table.name)!.rows), ordered(table.rows), `Initial restore differs: ${table.name}`);
    console.info(`Restored ${backup.tables.length} tables / ${backup.tables.reduce((sum, table) => sum + table.rows.length, 0)} rows`);
    const directory = fileURLToPath(new URL("./", import.meta.url));
    await runMigrations({ directory, pool: migrationPool });
    await runMigrations({ directory, pool: migrationPool });
    const result = await recoverCustodyLinks({ pool: migrationPool, apply: true, expectedDatabase: name, operationRef: "isolated-Aiven-rehearsal" });
    const repeat = await recoverCustodyLinks({ pool: migrationPool, apply: true, expectedDatabase: name, operationRef: "isolated-Aiven-rehearsal-repeat" });
    assert.equal(repeat.newlyRecorded, 0); assert.equal(repeat.newlyHeld, 0);
    const after = await captureRecoveryBackup(pool);
    const reviews = after.tables.find(table => table.name === "custody_link_recovery_reviews")!;
    const originals = reviews.rows.map(row => JSON.parse(row[reviews.columns.indexOf("original_links")] as string));
    const dangling = originals.filter(row => row.warehouse_item_id && !backup.tables.find(table => table.name === "warehouse_items")!.rows.some(item => item[0] === row.warehouse_item_id));
    assert.equal(dangling.length, count);
    const storageEvidence = after.tables.find(table => table.name === "warehouse_link_recovery_evidence");
    const storageOriginals = storageEvidence?.rows.map(row => JSON.parse(row[storageEvidence.columns.indexOf("original_links")] as string)) ?? [];
    assert.equal(storageOriginals.length, storageCount);
    for (const before of backup.tables) {
      const actual = after.tables.find(table => table.name === before.name)!;
      if (["schema_migrations", "schema_migration_attempts"].includes(before.name)) {
        for (const row of before.rows) {
          const version = row[before.columns.indexOf("version")];
          assert.deepEqual(actual.rows.find(candidate => candidate[actual.columns.indexOf("version")] === version), row, "Original ledger/attempt changed");
        }
        continue;
      }
      const projected = actual.rows.map(row => before.columns.map(column => row[actual.columns.indexOf(column)]));
      for (const row of projected) {
        const original = before.rows.find(candidate => candidate[0] === row[0])!;
        if (before.name === "custody_requests" && dangling.some(link => link.id === row[0])) {
          assert.equal(row[before.columns.indexOf("warehouse_item_id")], null);
          row[before.columns.indexOf("warehouse_item_id")] = original[before.columns.indexOf("warehouse_item_id")];
          row[before.columns.indexOf("updated_at")] = original[before.columns.indexOf("updated_at")];
        }
        if (before.name === "warehouse_items" && result.unresolved.some(link => link.warehouseItemId === row[0])) row[before.columns.indexOf("updated_at")] = original[before.columns.indexOf("updated_at")];
        if (before.name === "storage_logs" && storageOriginals.some(log => log.id === row[0])) {
          assert.equal(row[before.columns.indexOf("warehouse_item_id")], null);
          row[before.columns.indexOf("warehouse_item_id")] = original[before.columns.indexOf("warehouse_item_id")];
        }
      }
      assert.deepEqual(ordered(projected), ordered(before.rows), `Unexpected business data change: ${before.name}`);
    }
    const preflight = await preflightMigrations({ directory, pool: migrationPool }); assert.deepEqual(preflight.pending, []);
    const schema = await checkWarehouseMaintenanceSchema(pool); assert.equal(schema.ready, true);
    const connection = await pool.getConnection();
    try { await verifyRecoveryForeignKeys(connection); } finally { connection.release(); }
    console.info(JSON.stringify({ verified: true, restoredForeignKeys: "rechecked after migration", preflight, schema, quarantine: result,
      historicalSql: "unavailable; not reconstructed", localMysql: (await admin.query("SELECT VERSION() AS version"))[0] }, null, 2));
  } finally {
    await pool.end();
    if (created && /^lnfs_recovery_[a-f0-9]{32}_test$/.test(name)) await admin.query("DROP DATABASE ??", [name]);
    await admin.end();
  }
}
run().catch((error: unknown) => {
  const code = (error as { code?: unknown }).code;
  console.error("Recovery rehearsal failed", typeof code === "string" ? code : error instanceof Error ? error.message : "unknown");
  process.exitCode = 1;
});
