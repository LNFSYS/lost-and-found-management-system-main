import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.resolve(repositoryRoot, ".env"), override: false });

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function bool(name, fallback) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["true", "1", "yes"].includes(value);
}

function sslOptions() {
  if (!bool("DB_SSL", false)) return undefined;
  const caPath = process.env.DB_SSL_CA_PATH?.trim();
  return {
    rejectUnauthorized: true,
    ca: caPath ? fs.readFileSync(path.isAbsolute(caPath) ? caPath : path.resolve(repositoryRoot, caPath), "utf8") : undefined
  };
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST?.trim() ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME?.trim() ?? "lnfs_auth",
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  ssl: sslOptions()
});

try {
  const [reports] = await connection.execute(
    `SELECT id, status, reviewed_by, reviewed_at, details
     FROM reports
     WHERE details = ?
     ORDER BY created_at DESC
     LIMIT 5`,
    ["SEEDED_BY_CODEX_MODERATION_TEST"]
  );
  const [actionType] = await connection.execute("SHOW COLUMNS FROM moderation_actions LIKE 'action_type'");
  const [targetType] = await connection.execute("SHOW COLUMNS FROM moderation_actions LIKE 'target_type'");

  console.log(JSON.stringify({
    reports: reports.map((report) => ({
      id: report.id,
      status: report.status,
      reviewedBy: report.reviewed_by,
      reviewedAt: report.reviewed_at
    })),
    moderationActionType: actionType[0]?.Type ?? null,
    moderationTargetType: targetType[0]?.Type ?? null
  }, null, 2));
} finally {
  await connection.end();
}
