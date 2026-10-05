import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import mysql from "mysql2/promise";
import { z } from "zod";
import { env } from "../shared/infrastructure/config/env.js";
import { databasePoolOptions } from "../shared/infrastructure/config/db.js";
import { createCloudinaryPrivateMediaStorage } from "../shared/infrastructure/cloudinary-private-media-storage.js";
import { createPrivateMediaStorage } from "../shared/infrastructure/private-media-storage.js";
import { captureRecoveryBackup, decryptBackup, restoreRecoveryBackup, writeRecoveryBackup, type RecoveryBackup } from "./database-recovery-backup.js";
import { createWarehouseMediaRolloutRepository, decryptMediaArchive, digest, legacyMediaPath, migrateWarehouseMedia, writeMediaArchive, type LegacyWarehouseMedia, type MediaRolloutEntry } from "./warehouse-media-rollout.js";

const identifier = z.string().regex(/^[0-9a-f-]{36}$/i);
const rowSchema = z.object({ table: z.enum(["warehouse_intake_images", "warehouse_private_proofs"]), id: identifier, ownerId: identifier,
  storageRef: z.string(), format: z.enum(["jpg", "png", "webp"]), bytes: z.number().int().positive(), intakeId: identifier.nullable() });
const archiveSchema = z.object({ format: z.literal("lnfs-warehouse-volume-v1"), database: z.string(), endpoint: z.string(),
  databaseFile: z.string().regex(/^lnfs-[0-9]+\.aes$/), databaseKey: z.string().regex(/^lnfs-[0-9]+\.key$/),
  files: z.array(z.object({ path: z.string(), body: z.string(), sha256: z.string().regex(/^[0-9a-f]{64}$/) })), rows: z.array(rowSchema) });
const reportSchema = z.object({ status: z.literal("VERIFIED"), timezone: z.literal("+00:00"), databaseSha256: z.string(), volumeSha256: z.string(), database: z.string(), tables: z.number(), rows: z.number(), files: z.number(), mysqlVersion: z.string() });
const entrySchema = z.object({ row: rowSchema, newRef: z.string(), sourceSha256: z.string(), deliverySha256: z.string().optional(),
  state: z.enum(["PLANNED", "VERIFIED", "COMMITTED", "CONFLICT", "REVIEW_REQUIRED"]), reason: z.string().optional() });
const { values } = parseArgs({ options: { prepare: { type: "boolean" }, verify: { type: "boolean" }, apply: { type: "boolean" }, check: { type: "boolean" },
  "backup-dir": { type: "string" }, "confirm-database": { type: "string" }, "confirm-endpoint": { type: "string" }, "operation-ref": { type: "string" } } });

function assertVolumePath(relative: string) {
  legacyMediaPath(`private://warehouse-proof/${relative}`);
  return relative;
}

async function captureVolume(root: string, relative = ""): Promise<{ path: string; body: string; sha256: string }[]> {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true }).catch(error => {
    if (error.code === "ENOENT" && !relative) return [];
    throw error;
  });
  const files = [];
  for (const entry of entries) {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error("Symlink in warehouse volume requires review");
    if (entry.isDirectory() && !relative && /^[0-9a-f-]{36}$/i.test(entry.name)) files.push(...await captureVolume(root, next));
    else if (entry.isFile()) {
      assertVolumePath(next);
      const body = await readFile(path.join(root, next));
      files.push({ path: next, body: body.toString("base64"), sha256: digest(body) });
    } else throw new Error("Unexpected warehouse volume entry requires review");
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function backupRows(backup: RecoveryBackup): LegacyWarehouseMedia[] {
  return backup.tables.filter(table => ["warehouse_intake_images", "warehouse_private_proofs"].includes(table.name)).flatMap(table => table.rows.flatMap(cells => {
    const row = Object.fromEntries(table.columns.map((column, i) => [column, cells[i]]));
    if (typeof row.storage_ref !== "string" || !row.storage_ref.startsWith("private://warehouse-proof/")) return [];
    return [rowSchema.parse({ table: table.name, id: row.id, ownerId: row.uploaded_by, storageRef: row.storage_ref, format: row.format, bytes: row.byte_size, intakeId: row.intake_id ?? null })];
  }));
}

function fingerprints(backup: RecoveryBackup) {
  return backup.tables.map(table => ({ name: table.name, columns: table.columns, rows: table.rows.map(row => JSON.stringify(row)).sort() }));
}

async function run() {
  if ([values.prepare, values.verify, values.apply, values.check].filter(Boolean).length > 1) throw new Error("Choose one rollout phase");
  const pool = mysql.createPool({ ...databasePoolOptions(false), dateStrings: true });
  try {
    const repository = createWarehouseMediaRolloutRepository(pool);
    if (!values.prepare && !values.verify && !values.apply && !values.check) {
      const rows = await repository.inventory();
      console.info(JSON.stringify({ mode: "READ_ONLY", intake: rows.filter(r => r.table === "warehouse_intake_images").length, returnProof: rows.filter(r => r.table === "warehouse_private_proofs").length }));
      return;
    }
    if (!values["backup-dir"]) throw new Error("Backup directory required");
    const directory = path.resolve(values["backup-dir"]);
    const repo = path.resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const resolved = await realpath(directory);
    if (resolved === repo || resolved.startsWith(`${repo}${path.sep}`)) throw new Error("Backup must be outside the repository");
    if (values.prepare) {
      if ((await readdir(directory)).length) throw new Error("Prepare requires an empty protected directory");
      const backup = await captureRecoveryBackup(pool);
      const files = await captureVolume(path.join(env.uploadDir, "warehouse-proof"));
      const rows = backupRows(backup);
      for (const row of rows) {
        const file = files.find(file => file.path === legacyMediaPath(row.storageRef));
        if (!file || Buffer.from(file.body, "base64").length !== row.bytes) throw new Error("Missing/changed source image; no database writes performed");
      }
      const stored = await writeRecoveryBackup(backup, directory);
      const key = randomBytes(32);
      await writeFile(path.join(directory, "media.key"), key, { flag: "wx", mode: 0o600 });
      await writeMediaArchive(path.join(directory, "volume.aes"), { format: "lnfs-warehouse-volume-v1", database: backup.database, endpoint: `${env.db.host}:${env.db.port}`,
        databaseFile: path.basename(stored.file), databaseKey: path.basename(stored.keyFile), files, rows }, key);
      console.info(JSON.stringify({ status: "BACKUP_PREPARED", tables: stored.tables, rows: stored.rows, files: files.length, localReferences: rows.length }));
      return;
    }
    const key = await readFile(path.join(directory, "media.key"));
    const volumeBytes = await readFile(path.join(directory, "volume.aes"));
    const archive = archiveSchema.parse(decryptMediaArchive(volumeBytes, key));
    const databaseBytes = await readFile(path.join(directory, archive.databaseFile));
    const backup = decryptBackup(databaseBytes, await readFile(path.join(directory, archive.databaseKey)));
    for (const file of archive.files) {
      assertVolumePath(file.path);
      if (digest(Buffer.from(file.body, "base64")) !== file.sha256) throw new Error("Volume checksum mismatch");
    }
    if (values.verify) {
      if (process.env.LNFS_TEST_DB_HOST !== "127.0.0.1" || !process.env.LNFS_TEST_DB_NAME?.endsWith("_test") || !process.env.LNFS_TEST_DB_PASSWORD || !process.env.LNFS_TEST_DB_PORT) throw new Error("Explicit isolated loopback *_test configuration required");
      const config = { host: "127.0.0.1", port: Number(process.env.LNFS_TEST_DB_PORT), user: process.env.LNFS_TEST_DB_USER, password: process.env.LNFS_TEST_DB_PASSWORD,
        multipleStatements: true, dateStrings: true, timezone: "Z" };
      const name = `lnfs_recovery_${randomUUID().replaceAll("-", "")}_test`;
      const admin = mysql.createPool(config);
      const clone = mysql.createPool({ ...config, database: name });
      const restoredVolume = await mkdtemp(path.join(os.tmpdir(), "lnfs-media-restore-"));
      try {
        await admin.query("CREATE DATABASE ??", [name]);
        await restoreRecoveryBackup(clone, backup);
        const restored = await captureRecoveryBackup(clone);
        if (JSON.stringify(fingerprints(backup)) !== JSON.stringify(fingerprints(restored))) throw new Error("Restored database row fingerprints differ");
        for (const file of archive.files) {
          const target = path.resolve(restoredVolume, "warehouse-proof", file.path);
          if (!target.startsWith(`${path.resolve(restoredVolume)}${path.sep}`)) throw new Error("Invalid restore path");
          await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
          await writeFile(target, Buffer.from(file.body, "base64"), { flag: "wx", mode: 0o600 });
          if (digest(await readFile(target)) !== file.sha256) throw new Error("Restored volume mismatch");
        }
        const local = createPrivateMediaStorage({ uploadDir: restoredVolume, namespace: "warehouse-proof", invalidPathMessage: "Invalid", notFoundMessage: "Missing" });
        for (const row of archive.rows) if ((await local.resolve(row.storageRef, row.format)).body.length !== row.bytes) throw new Error("Restored reference mismatch");
        const [version] = await clone.query<mysql.RowDataPacket[]>("SELECT VERSION() AS version");
        const report = { status: "VERIFIED", timezone: "+00:00", databaseSha256: digest(databaseBytes), volumeSha256: digest(volumeBytes), database: backup.database,
          tables: backup.tables.length, rows: backup.tables.reduce((sum, t) => sum + t.rows.length, 0), files: archive.files.length, mysqlVersion: String(version[0].version) };
        await writeFile(path.join(directory, "restore-check-utc.json"), JSON.stringify(report), { flag: "wx", mode: 0o600 });
        console.info(JSON.stringify(report));
      } finally {
        await clone.end();
        await admin.query("DROP DATABASE IF EXISTS ??", [name]);
        await admin.end();
        if (!path.resolve(restoredVolume).startsWith(`${path.resolve(os.tmpdir())}${path.sep}lnfs-media-restore-`)) throw new Error("Unsafe temporary restore cleanup");
        await rm(restoredVolume, { recursive: true, force: true });
      }
      return;
    }
    const report = reportSchema.parse(JSON.parse(await readFile(path.join(directory, "restore-check-utc.json"), "utf8")));
    if (report.databaseSha256 !== digest(databaseBytes) || report.volumeSha256 !== digest(volumeBytes) || report.database !== env.db.name
      || archive.database !== env.db.name || archive.endpoint !== `${env.db.host}:${env.db.port}`
      || (!values.check && (values["confirm-database"] !== env.db.name || values["confirm-endpoint"] !== archive.endpoint || !values["operation-ref"]))) throw new Error("Apply requires matching verified backup, exact endpoint/database and operation reference");
    if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) throw new Error("Durable provider configuration required");
    const journalFiles = (await readdir(directory)).filter(file => /^journal-[0-9]+\.aes$/.test(file)).sort();
    const previous = new Map<string, MediaRolloutEntry>();
    for (const file of journalFiles) {
      const entry = entrySchema.parse(decryptMediaArchive(await readFile(path.join(directory, file)), key));
      previous.set(`${entry.row.table}:${entry.row.id}`, entry);
    }
    if ([...previous.values()].some(entry => ["PLANNED", "VERIFIED", "REVIEW_REQUIRED"].includes(entry.state))) throw new Error("Incomplete prior operation requires explicit reference reconciliation before retry");
    if (values.check) {
      const current = await captureRecoveryBackup(pool);
      const committed = [...previous.values()].filter(entry => entry.state === "COMMITTED");
      if (committed.length !== archive.rows.length) throw new Error("Historical rows are not all committed; manual reconciliation required");
      const cloud = createCloudinaryPrivateMediaStorage({ config: env.cloudinary, namespace: "warehouse-proof", allowLocalWrites: false,
        fetcher: url => fetch(url, { signal: AbortSignal.timeout(20_000) }) });
      for (const entry of committed) {
        const before = backup.tables.find(table => table.name === entry.row.table)!;
        const after = current.tables.find(table => table.name === entry.row.table)!;
        if (JSON.stringify(before.columns) !== JSON.stringify(after.columns)) throw new Error("Warehouse schema changed; review required");
        const idIndex = before.columns.indexOf("id"), refIndex = before.columns.indexOf("storage_ref");
        const oldRow = before.rows.find(row => row[idIndex] === entry.row.id);
        const newRow = after.rows.find(row => row[idIndex] === entry.row.id);
        if (!oldRow || !newRow || newRow[refIndex] !== entry.newRef
          || JSON.stringify(newRow.map((cell, i) => i === refIndex ? oldRow[i] : cell)) !== JSON.stringify(oldRow)) throw new Error("Warehouse non-reference metadata changed; review required");
        const source = await readFile(path.join(env.uploadDir, "warehouse-proof", legacyMediaPath(entry.row.storageRef)));
        if (digest(source) !== entry.sourceSha256 || digest((await cloud.resolve(entry.newRef, entry.row.format)).body) !== entry.deliverySha256) throw new Error("Source/delivery checksum changed");
      }
      for (const name of ["schema_migrations", "schema_migration_attempts"]) {
        const before = fingerprints(backup).find(table => table.name === name);
        const after = fingerprints(current).find(table => table.name === name);
        if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Migration history changed since backup");
      }
      const receipt = { status: "POST_CHECK_VERIFIED", checked: committed.length, remainingLocal: (await repository.inventory()).length,
        nonReferenceMetadataUnchanged: true, ledgerUnchanged: true, originalsRetained: true, sourceAndDeliveryChecksumsVerified: true };
      if (receipt.remainingLocal) throw new Error("Local references remain");
      await writeMediaArchive(path.join(directory, `post-check-${randomUUID()}.aes`), receipt, key);
      console.info(JSON.stringify(receipt));
      return;
    }
    const lock = await pool.getConnection();
    try {
      const [acquired] = await lock.query<mysql.RowDataPacket[]>("SELECT GET_LOCK('lnfs:warehouse-media-rollout',0) AS acquired");
      if (Number(acquired[0].acquired) !== 1) throw new Error("Warehouse rollout already running");
      const rows = await repository.inventory();
      for (const row of rows) if (!archive.rows.some(saved => JSON.stringify(saved) === JSON.stringify(row))) throw new Error("Local inventory changed since backup; prepare a fresh backup");
      const local = createPrivateMediaStorage({ uploadDir: env.uploadDir, namespace: "warehouse-proof", invalidPathMessage: "Invalid", notFoundMessage: "Missing" });
      const makeCloud = () => createCloudinaryPrivateMediaStorage({ config: env.cloudinary, namespace: "warehouse-proof", allowLocalWrites: false,
        fetcher: url => fetch(url, { signal: AbortSignal.timeout(20_000) }) });
      let sequence = journalFiles.length;
      const entries = await migrateWarehouseMedia({ rows, repository, storage: makeCloud(), independentStorage: makeCloud(), source: async row => {
        const file = archive.files.find(file => file.path === legacyMediaPath(row.storageRef));
        const current = await local.resolve(row.storageRef, row.format);
        if (!file || digest(current.body) !== file.sha256) throw new Error("Source changed after verified backup");
        return current.body;
      }, journal: entry => writeMediaArchive(path.join(directory, `journal-${String(++sequence).padStart(6, "0")}.aes`), entry, key) });
      const remaining = await repository.inventory();
      const receipt = { operationRef: values["operation-ref"], migrated: entries.filter(e => e.state === "COMMITTED").length,
        conflicts: entries.filter(e => e.state === "CONFLICT").length, reviewRequired: entries.filter(e => e.state === "REVIEW_REQUIRED").length, remainingLocal: remaining.length, originalsRetained: true };
      await writeMediaArchive(path.join(directory, `receipt-${randomUUID()}.aes`), receipt, key);
      console.info(JSON.stringify(receipt));
      if (receipt.remainingLocal || receipt.reviewRequired) process.exitCode = 1;
    } finally { await lock.query("SELECT RELEASE_LOCK('lnfs:warehouse-media-rollout')").catch(() => undefined); lock.release(); }
  } finally { await pool.end(); }
}

run().catch(error => {
  console.error("warehouse_media_rollout_failed", { causeCode: typeof error?.code === "string" ? error.code : "ROLLOUT_CHECK_FAILED" });
  process.exitCode = 1;
});
