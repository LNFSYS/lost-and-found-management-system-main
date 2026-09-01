import { createHash } from "node:crypto";
import fs from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

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

const apply = process.argv.includes("--apply");
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

  if (!mismatches.length) {
    console.log("Migration checksums already match the current files.");
    process.exitCode = 0;
  } else if (!apply) {
    console.log(`Found ${mismatches.length} checksum mismatch(es) in ${options.host}:${options.port}/${options.database}.`);
    console.log("Dry run only. Review the rows below, then run npm.cmd run migrate:repair-checksums if this is your local/dev DB.");
    for (const item of mismatches) {
      console.log(`${item.version}`);
      console.log(`  db:   ${item.oldChecksum}`);
      console.log(`  file: ${item.newChecksum}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Repairing ${mismatches.length} checksum mismatch(es) in ${options.host}:${options.port}/${options.database}.`);
    for (const item of mismatches) {
      await pool.execute("UPDATE schema_migrations SET checksum = ? WHERE version = ?", [item.newChecksum, item.version]);
      console.log(`Updated ${item.version}`);
    }
    console.log("Checksum metadata repaired. Run npm.cmd run migrate next.");
  }
} catch (error) {
  console.error("Migration checksum repair failed", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
} finally {
  await pool.end();
}
