import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
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
  const [existing] = await connection.execute(
    "SELECT id, entity_id FROM reports WHERE status = 'PENDING' AND details = ? LIMIT 1",
    ["SEEDED_BY_CODEX_MODERATION_TEST"]
  );

  if (existing.length) {
    console.log(`Report test already exists: ${existing[0].id} for post ${existing[0].entity_id}`);
    process.exit(0);
  }

  const [users] = await connection.execute(
    "SELECT id, email FROM users WHERE status = 'ACTIVE' ORDER BY created_at DESC, id DESC LIMIT 1"
  );
  const [posts] = await connection.execute(
    "SELECT id, title FROM posts WHERE deleted_at IS NULL AND status <> 'HIDDEN' ORDER BY created_at DESC, id DESC LIMIT 1"
  );

  if (!users.length) throw new Error("No ACTIVE user found to use as reporter");
  if (!posts.length) throw new Error("No visible post found to report");

  const reportId = randomUUID();
  await connection.execute(
    `INSERT INTO reports (id, reporter_id, entity_type, entity_id, reason, details, status)
     VALUES (?, ?, 'POST', ?, ?, ?, 'PENDING')`,
    [
      reportId,
      users[0].id,
      posts[0].id,
      "Test moderation report",
      "SEEDED_BY_CODEX_MODERATION_TEST"
    ]
  );

  console.log(`Created report test: ${reportId}`);
  console.log(`Target post: ${posts[0].title} (${posts[0].id})`);
  console.log(`Reporter: ${users[0].email}`);
} finally {
  await connection.end();
}
