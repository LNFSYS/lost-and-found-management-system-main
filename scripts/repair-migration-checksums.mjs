import { createHash } from "node:crypto";
import fs from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

if (process.argv.includes("--apply")) {
  console.error("Bulk checksum rewriting is disabled. Diagnose schema drift; use migrate:reconcile-claim only for the verified claim alias.");
  process.exit(1);
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const envPath of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(repositoryRoot, ".env"),
  path.resolve(repositoryRoot, "apps/api-node/.env")
]) {
  dotenv.config({ path: envPath, override: false });
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function number(name, fallback) {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
}

function migrationChecksums(sql) {
  return {
    raw: createHash("sha256").update(sql).digest("hex"),
    normalized: createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex")
  };
}

function bool(name, fallback) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (["true", "1", "yes"].includes(value)) return true;
  if (["false", "0", "no"].includes(value)) return false;
  throw new Error(`${name} must be true or false`);
}

async function currentMigrationChecksums() {
  const migrationsDir = path.resolve(repositoryRoot, "apps/api-node/src/migrations");
  const files = (await readdir(migrationsDir)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  const checksums = new Map();
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    checksums.set(file, migrationChecksums(sql));
  }
  return checksums;
}

function poolOptions() {
  const sslCaPath = process.env.DB_SSL_CA_PATH?.trim();
  const sslCa = sslCaPath
    ? fs.readFileSync(path.isAbsolute(sslCaPath) ? sslCaPath : path.resolve(repositoryRoot, sslCaPath), "utf8")
    : undefined;
  return {
    host: process.env.DB_HOST?.trim() ?? "localhost",
    port: number("DB_PORT", 3306),
    database: process.env.DB_NAME?.trim() ?? "lnfs_auth",
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    waitForConnections: true,
    connectionLimit: 1,
    timezone: "Z",
    multipleStatements: false,
    ssl: bool("DB_SSL", false) ? { rejectUnauthorized: true, ca: sslCa } : undefined
  };
}

const options = poolOptions();
const pool = mysql.createPool(options);

try {
  const checksums = await currentMigrationChecksums();
  const [rows] = await pool.query("SELECT version, checksum FROM schema_migrations ORDER BY version");
  const mismatches = rows
    .filter((row) => {
      const current = checksums.get(row.version);
      return current && row.checksum !== current.raw && row.checksum !== current.normalized;
    })
    .map((row) => ({ version: row.version, oldChecksum: row.checksum, newChecksum: checksums.get(row.version).raw }));

  const unknown = rows.filter((row) => !checksums.has(row.version));
  if (unknown.length) {
    console.error(`Unknown migration versions: ${unknown.map((row) => row.version).join(", ")}. Reconcile before migrating.`);
    process.exitCode = 1;
  }
  if (!mismatches.length && !unknown.length) {
    console.log("Migration checksums already match the current files.");
    process.exitCode = 0;
  } else if (mismatches.length) {
    console.log(`Found ${mismatches.length} checksum mismatch(es) in ${options.host}:${options.port}/${options.database}.`);
    console.log("Read-only diagnosis. Compare schema and Git history; do not overwrite recorded checksums.");
    for (const item of mismatches) {
      console.log(`${item.version}`);
      console.log(`  db:   ${item.oldChecksum}`);
      console.log(`  file: ${item.newChecksum}`);
    }
    process.exitCode = 1;
  }
} catch (error) {
  console.error("Migration checksum diagnosis failed", typeof error?.code === "string" ? error.code : "unknown error");
  process.exitCode = 1;
} finally {
  await pool.end();
}
