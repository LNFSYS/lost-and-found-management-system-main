import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

type Cell = string | number | null | { base64: string };
export interface RecoveryBackup {
  format: "lnfs-recovery-v1";
  database: string;
  capturedAt: string;
  tables: { name: string; ddl: string; columns: string[]; rows: Cell[][] }[];
}

export function encryptBackup(backup: RecoveryBackup, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const bytes = Buffer.concat([cipher.update(gzipSync(JSON.stringify(backup))), cipher.final()]);
  return Buffer.concat([Buffer.from("LNFSBK01"), iv, cipher.getAuthTag(), bytes]);
}

export function decryptBackup(bytes: Buffer, key: Buffer): RecoveryBackup {
  if (bytes.subarray(0, 8).toString() !== "LNFSBK01") throw new Error("Unsupported recovery backup");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(8, 20));
  decipher.setAuthTag(bytes.subarray(20, 36));
  const data = Buffer.concat([decipher.update(bytes.subarray(36)), decipher.final()]);
  const backup = JSON.parse(gunzipSync(data).toString()) as RecoveryBackup;
  if (backup.format !== "lnfs-recovery-v1" || !Array.isArray(backup.tables)) throw new Error("Invalid recovery backup");
  return backup;
}

export async function captureRecoveryBackup(pool: Pool): Promise<RecoveryBackup> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    const [database] = await connection.query<RowDataPacket[]>("SELECT DATABASE() AS name");
    const [objects] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME AS name, TABLE_TYPE AS type, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME");
    const [triggers] = await connection.query<RowDataPacket[]>("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()");
    const [routines] = await connection.query<RowDataPacket[]>("SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE()");
    const [events] = await connection.query<RowDataPacket[]>("SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()");
    if (objects.some(row => row.type !== "BASE TABLE" || row.engine !== "InnoDB") || triggers.length || routines.length || events.length) {
      throw new Error("Recovery backup supports InnoDB base tables only; use a full provider backup for views/triggers/routines/events");
    }
    const backup: RecoveryBackup = { format: "lnfs-recovery-v1", database: database[0].name, capturedAt: new Date().toISOString(), tables: [] };
    for (const table of objects) {
      const [definition] = await connection.query<RowDataPacket[]>("SHOW CREATE TABLE ??", [table.name]);
      const [metadata] = await connection.query<RowDataPacket[]>("SELECT COLUMN_NAME AS name, DATA_TYPE AS type, GENERATION_EXPRESSION AS expression FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION", [table.name]);
      const columns = metadata.filter(row => !row.expression);
      const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM ??", [table.name]);
      backup.tables.push({ name: table.name, ddl: definition[0]["Create Table"], columns: columns.map(row => row.name), rows: rows.map(row => columns.map(column => {
        const value = row[column.name];
        if (value === null) return null;
        if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
        if (Buffer.isBuffer(value)) return { base64: value.toString("base64") };
        if (column.type === "json") return typeof value === "string" ? value : JSON.stringify(value);
        if (typeof value === "number" || typeof value === "string") return value;
        throw new Error(`Unsupported backup type: ${table.name}.${column.name}`);
      })) });
    }
    return backup;
  } finally {
    await connection.query("ROLLBACK").catch(() => undefined);
    connection.release();
  }
}

export async function writeRecoveryBackup(backup: RecoveryBackup, directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const name = `lnfs-${new Date().toISOString().replace(/[^0-9]/g, "")}`;
  const file = path.join(directory, `${name}.aes`), keyFile = path.join(directory, `${name}.key`);
  const key = randomBytes(32);
  await writeFile(keyFile, key, { flag: "wx", mode: 0o600 });
  await writeFile(file, encryptBackup(backup, key), { flag: "wx", mode: 0o600 });
  const restored = decryptBackup(await readFile(file), await readFile(keyFile));
  if (JSON.stringify(restored) !== JSON.stringify(backup)) throw new Error("Backup round-trip verification failed");
  return { file, keyFile, tables: backup.tables.length, rows: backup.tables.reduce((sum, table) => sum + table.rows.length, 0) };
}

// Never restore to a shared host or an existing database, even with CLI overrides.
export async function restoreRecoveryBackup(pool: Pool, backup: RecoveryBackup, reviewedOrphans: { table: string; constraint: string; count: number }[] = []) {
  const connection = await pool.getConnection();
  try {
    if (!["127.0.0.1", "localhost", "::1"].includes(connection.config.host ?? "")) throw new Error("Recovery rehearsal must use loopback MySQL");
    const [database] = await connection.query<RowDataPacket[]>("SELECT DATABASE() AS name");
    if (!/^lnfs_recovery_[a-f0-9]{32}_test$/.test(database[0]?.name ?? "")) throw new Error("Recovery rehearsal requires a dedicated generated *_test database");
    const [tables] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()");
    if (tables.length) throw new Error("Refusing to overwrite an existing rehearsal database");
    await connection.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',ANSI_QUOTES')");
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of backup.tables) await connection.query(table.ddl);
    for (const table of backup.tables) {
      for (const row of table.rows) {
        await connection.query(`INSERT INTO ?? (${table.columns.map(() => "??").join(",")}) VALUES (${row.map(() => "?").join(",")})`,
          [table.name, ...table.columns, ...row.map(cell => typeof cell === "object" && cell !== null ? Buffer.from(cell.base64, "base64") : cell)]);
      }
      const [count] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM ??", [table.name]);
      if (Number(count[0].total) !== table.rows.length) throw new Error(`Rehearsal row-count mismatch: ${table.name}`);
    }
    await verifyRecoveryForeignKeys(connection, reviewedOrphans);
  } finally {
    await connection.query("SET FOREIGN_KEY_CHECKS=1").catch(() => undefined);
    connection.release();
  }
}

// Enabling FK checks does not validate pre-existing rows; check every FK explicitly.
export async function verifyRecoveryForeignKeys(connection: PoolConnection, reviewedOrphans: { table: string; constraint: string; count: number }[] = []) {
  const [foreignKeys] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME AS child, CONSTRAINT_NAME AS name, COLUMN_NAME AS col, REFERENCED_TABLE_NAME AS parent, REFERENCED_COLUMN_NAME AS ref, ORDINAL_POSITION AS pos FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION");
  const groups = new Map<string, RowDataPacket[]>();
  for (const row of foreignKeys) { const key = `${row.child}:${row.name}`; groups.set(key, [...(groups.get(key) ?? []), row]); }
  const quote = (value: string) => `\`${value.replaceAll("`", "``")}\``;
  for (const group of groups.values()) {
    const [first] = group;
    const [invalid] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM ${quote(first.child)} c LEFT JOIN ${quote(first.parent)} p ON ${group.map(row => `c.${quote(row.col)}=p.${quote(row.ref)}`).join(" AND ")} WHERE ${group.map(row => `c.${quote(row.col)} IS NOT NULL`).join(" AND ")} AND p.${quote(first.ref)} IS NULL`);
    const count = Number(invalid[0].total);
    if (count && !reviewedOrphans.some(orphan => orphan.table === first.child && orphan.constraint === first.name && orphan.count === count)) throw new Error(`Rehearsal orphan FK: ${first.child}.${first.name}`);
  }
}
