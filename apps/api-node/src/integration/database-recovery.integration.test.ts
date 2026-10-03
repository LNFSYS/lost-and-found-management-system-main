import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runMigrations } from "../migrations/migration-runner.js";
import { legacyMigrationCompatibility } from "../migrations/legacy-migration-compatibility.js";
import { verifyMatchingFeedbackRecoveryBaseline } from "../migrations/legacy-schema-verification.js";
import { captureRecoveryBackup, restoreRecoveryBackup } from "../migrations/database-recovery-backup.js";
import { recoverCustodyLinks } from "../migrations/custody-link-recovery.js";
import { readMigrationFiles, type MigrationPool } from "../migrations/migration-state.js";

test("isolated recovery: preserved history/labels, full restore and conservative linkage quarantine", {
  skip: process.env.LNFS_DB_INTEGRATION === "1" ? false : "Requires explicit isolated MySQL"
}, async t => {
  const host = process.env.LNFS_TEST_DB_HOST ?? "";
  if (!["127.0.0.1", "localhost", "::1"].includes(host) || !process.env.LNFS_TEST_DB_NAME?.endsWith("_test")) throw new Error("Shared database tests are forbidden");
  const options = { host, port: Number(process.env.LNFS_TEST_DB_PORT), user: process.env.LNFS_TEST_DB_USER,
    password: process.env.LNFS_TEST_DB_PASSWORD, multipleStatements: true, timezone: "Z", connectionLimit: 5 };
  const admin = mysql.createPool(options);
  const pools: Pool[] = [], names: string[] = [];
  const migrationPool = (pool: Pool) => pool as unknown as MigrationPool;
  const directory = fileURLToPath(new URL("../migrations/", import.meta.url));
  async function create() {
    const name = `lnfs_recovery_${randomUUID().replaceAll("-", "")}_test`;
    assert.match(name, /^lnfs_recovery_[a-f0-9]{32}_test$/);
    await admin.query("CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", [name]); names.push(name);
    const pool = mysql.createPool({ ...options, database: name }); pools.push(pool);
    return { pool, name };
  }
  try {
    await t.test("forward migration archives and clears dangling pointers without changing lifecycle", async () => {
      const { pool: legacy } = await create();
      const temp = await mkdtemp(path.join(os.tmpdir(), "lnfs-recovery-fixture-"));
      try {
        for (const file of (await readMigrationFiles(directory)).filter(file => Number(file.version.slice(0, 3)) <= 53)) await writeFile(path.join(temp, file.version), file.sql);
        await runMigrations({ directory: temp, pool: migrationPool(legacy), log: () => undefined });
        const user = randomUUID(), requestId = randomUUID(), missingItem = randomUUID(), logId = randomUUID();
        await legacy.execute("INSERT INTO users(id,email,normalized_email,password_hash,full_name,email_verified_at) VALUES(?,?,?,'fixture','Fixture',UTC_TIMESTAMP())", [user, `${user}@example.invalid`, `${user}@example.invalid`]);
        const [points] = await legacy.query<RowDataPacket[]>("SELECT id FROM handover_points LIMIT 1");
        const connection = await legacy.getConnection();
        try {
          await connection.query("SET FOREIGN_KEY_CHECKS=0");
          await connection.execute("INSERT INTO custody_requests(id,requester_id,warehouse_item_id,status) VALUES(?,?,?,'PENDING')", [requestId, user, missingItem]);
          await connection.execute("INSERT INTO storage_logs(id,warehouse_item_id,handover_point_id,actor_id,action,note) VALUES(?,?,?,?,'RECEIVED','Preserve audit text')", [logId, missingItem, points[0].id, user]);
        } finally { await connection.query("SET FOREIGN_KEY_CHECKS=1"); connection.release(); }
        await runMigrations({ directory, pool: migrationPool(legacy), log: () => undefined });
        const [rows] = await legacy.query<RowDataPacket[]>("SELECT cr.status,cr.warehouse_item_id,review.original_links FROM custody_requests cr JOIN custody_link_recovery_reviews review ON review.custody_request_id=cr.id WHERE cr.id=?", [requestId]);
        assert.equal(rows[0].status, "PENDING"); assert.equal(rows[0].warehouse_item_id, null);
        assert.equal(rows[0].original_links.warehouse_item_id, missingItem);
        const [logs] = await legacy.query<RowDataPacket[]>("SELECT sl.warehouse_item_id,sl.note,e.original_links FROM storage_logs sl JOIN warehouse_link_recovery_evidence e ON e.source_id=sl.id AND e.source_table='storage_logs' WHERE sl.id=?", [logId]);
        assert.equal(logs[0].warehouse_item_id, null); assert.equal(logs[0].note, "Preserve audit text");
        assert.equal(logs[0].original_links.warehouse_item_id, missingItem);
        await runMigrations({ directory, pool: migrationPool(legacy), log: () => undefined });
      } finally { await rm(temp, { recursive: true, force: true }); }
    });
    const { pool, name } = await create();
    await runMigrations({ directory, pool: migrationPool(pool), log: () => undefined });
    const finder = randomUUID(), owner = randomUUID(), found = randomUUID(), lost = randomUUID(), request = randomUUID(), item = randomUUID(), match = randomUUID();
    for (const id of [finder, owner]) await pool.execute("INSERT INTO users(id,email,normalized_email,password_hash,full_name,email_verified_at) VALUES(?,?,?,'fixture','Fixture',UTC_TIMESTAMP())", [id, `${id}@example.invalid`, `${id}@example.invalid`]);
    for (const [id, user, type] of [[found, finder, "FOUND"], [lost, owner, "LOST"]]) await pool.execute("INSERT INTO posts(id,user_id,type,title,title_normalized,description,description_normalized) VALUES(?,?,?,'Fixture','fixture','Fixture','fixture')", [id, user, type]);
    await pool.execute("INSERT INTO match_results(id,lost_post_id,found_post_id,total_score,text_score,category_score,location_score,time_score) VALUES(?,?,?,70,70,70,70,70)", [match, lost, found]);
    await pool.execute("INSERT INTO match_feedback(id,match_id,user_id,label) VALUES(?,?,?,'USEFUL')", [randomUUID(), match, owner]);
    await pool.execute("INSERT INTO warehouse_items(id,post_id,item_name,finder_user_id,created_by) VALUES(?,?,'Fixture',?,?)", [item, lost, owner, finder]);
    await pool.execute("INSERT INTO custody_requests(id,post_id,requester_id,status,warehouse_item_id) VALUES(?, ?,?,'INTAKED',?)", [request, lost, finder, item]);

    await t.test("exact unavailable-history records require real schema; labels and ledger remain unchanged", async () => {
      for (const entry of legacyMigrationCompatibility.filter(entry => entry.version.startsWith("054_") || entry.version.startsWith("055_"))) {
        const [existing] = await pool.execute<RowDataPacket[]>("SELECT version FROM schema_migrations WHERE version=?", [entry.version]);
        if (existing.length) continue;
        await pool.execute("INSERT INTO schema_migrations(version,checksum) VALUES(?,?)", [entry.version, entry.checksum]);
        await pool.execute("INSERT INTO schema_migration_attempts(version,checksum,status) VALUES(?,?,'APPLIED')", [entry.version, entry.checksum]);
      }
      const [before] = await pool.query("SELECT * FROM schema_migrations ORDER BY version");
      await runMigrations({ directory, pool: migrationPool(pool), log: () => undefined });
      const [after] = await pool.query("SELECT * FROM schema_migrations ORDER BY version"); assert.deepEqual(after, before);
      const [feedback] = await pool.query<RowDataPacket[]>("SELECT label FROM match_feedback"); assert.equal(feedback[0].label, "USEFUL");
      await pool.query("ALTER TABLE match_feedback DROP FOREIGN KEY fk_match_feedback_source_post");
      await assert.rejects(runMigrations({ directory, pool: migrationPool(pool) }), /Matching recovery baseline mismatch/);
      await pool.query("ALTER TABLE match_feedback ADD CONSTRAINT fk_match_feedback_source_post FOREIGN KEY(source_post_id) REFERENCES posts(id)");
      const connection = await pool.getConnection();
      try { await verifyMatchingFeedbackRecoveryBaseline(connection); } finally { connection.release(); }
      await pool.query("ALTER TABLE custody_requests ADD COLUMN proposed_time DATETIME NULL");
      await assert.rejects(runMigrations({ directory, pool: migrationPool(pool) }), /proposed_time still exists/);
      await pool.query("ALTER TABLE custody_requests DROP COLUMN proposed_time");
    });

    await t.test("read-only preview, exact target, idempotent quarantine, unchanged post/claim/request states", async () => {
      const before = await recoverCustodyLinks({ pool: migrationPool(pool) }); assert.equal(before.invalidRequests, 1);
      const [empty] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM custody_link_recovery_reviews"); assert.equal(Number(empty[0].total), 0);
      await assert.rejects(recoverCustodyLinks({ pool: migrationPool(pool), apply: true, expectedDatabase: "wrong", operationRef: "fixture" }), /exact database/);
      const result = await recoverCustodyLinks({ pool: migrationPool(pool), apply: true, expectedDatabase: name, operationRef: "fixture-recovery" });
      assert.equal(result.newlyRecorded, 1); assert.equal(result.newlyHeld, 1);
      const again = await recoverCustodyLinks({ pool: migrationPool(pool), apply: true, expectedDatabase: name, operationRef: "fixture-retry" });
      assert.equal(again.newlyRecorded, 0); assert.equal(again.newlyHeld, 0);
      const [row] = await pool.query<RowDataPacket[]>("SELECT wi.legal_hold, wi.post_id, cr.status FROM warehouse_items wi JOIN custody_requests cr ON cr.warehouse_item_id=wi.id WHERE wi.id=?", [item]);
      assert.equal(Number(row[0].legal_hold), 1); assert.equal(row[0].post_id, lost); assert.equal(row[0].status, "INTAKED");
    });

    await t.test("backup restores every table and row on loopback; refuses nonempty targets", async () => {
      const backup = await captureRecoveryBackup(pool);
      const { pool: clone } = await create();
      await restoreRecoveryBackup(clone, backup);
      const restored = await captureRecoveryBackup(clone);
      for (const table of backup.tables) {
        const actual = restored.tables.find(candidate => candidate.name === table.name)!;
        assert.deepEqual(actual.columns, table.columns);
        assert.deepEqual(actual.rows.map(row => JSON.stringify(row)).sort(), table.rows.map(row => JSON.stringify(row)).sort(), table.name);
      }
      await runMigrations({ directory, pool: migrationPool(clone), log: () => undefined });
      await assert.rejects(restoreRecoveryBackup(clone, backup), /overwrite/);
    });
  } finally {
    for (const pool of pools) await pool.end();
    for (const name of names) { assert.match(name, /^lnfs_recovery_[a-f0-9]{32}_test$/); await admin.query("DROP DATABASE ??", [name]); }
    await admin.end();
  }
});
