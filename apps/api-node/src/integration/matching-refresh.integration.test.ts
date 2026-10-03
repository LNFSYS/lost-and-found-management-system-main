import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { createPersistence } from "../main/persistence.js";
import { preflightMigrations } from "../migrations/migration-preflight.js";
import { runMigrations, type MigrationPool } from "../migrations/migration-runner.js";
import { readMigrationFiles } from "../migrations/migration-state.js";

const directory = fileURLToPath(new URL("../migrations/", import.meta.url));
const original = "054_matching_feedback_periodic_refresh.sql";

test("isolated matching: upgrade paths, fenced leases and bounded retries", {
  skip: process.env.LNFS_DB_INTEGRATION === "1" ? false : "Requires explicit isolated MySQL"
}, async t => {
  const host = process.env.LNFS_TEST_DB_HOST ?? "";
  if (!["127.0.0.1", "localhost", "::1"].includes(host) || !process.env.LNFS_TEST_DB_NAME?.endsWith("_test")) throw new Error("Matching tests refuse shared databases");
  if (!process.env.LNFS_TEST_DB_USER || !process.env.LNFS_TEST_DB_PASSWORD) throw new Error("Isolated credentials required");
  const options = { host, port: Number(process.env.LNFS_TEST_DB_PORT ?? 3306), user: process.env.LNFS_TEST_DB_USER, password: process.env.LNFS_TEST_DB_PASSWORD, multipleStatements: true, timezone: "Z", connectionLimit: 5 };
  const admin = mysql.createPool(options);
  const files = await readMigrationFiles(directory);
  const migrate = (pool: Pool, source = directory) => runMigrations({ directory: source, pool: pool as unknown as MigrationPool, log() {} });
  async function isolated(run: (pool: Pool) => Promise<void>) {
    const name = `lnfs_matching_${randomUUID().replaceAll("-", "")}_test`;
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    const pool = mysql.createPool({ ...options, database: name });
    try { await run(pool); }
    finally { await pool.end(); await admin.query(`DROP DATABASE \`${name}\``); }
  }
  async function subset(run: (directory: string) => Promise<void>, predicate: (version: string) => boolean) {
    const dir = await mkdtemp(path.join(os.tmpdir(), "lnfs-matching-migrations-"));
    try {
      for (const file of files.filter(file => predicate(file.version))) await writeFile(path.join(dir, file.version), file.sql);
      await run(dir);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
  async function seed(pool: Pool) {
    const user = randomUUID(), lost = randomUUID(), found = randomUUID(), match = randomUUID();
    await pool.execute("INSERT INTO users (id,email,normalized_email,password_hash,full_name,email_verified_at) VALUES (?,?,?,'test-only','Fixture',UTC_TIMESTAMP())", [user, `${user}@example.invalid`, `${user}@example.invalid`]);
    for (const [id, type] of [[lost, "LOST"], [found, "FOUND"]]) await pool.execute("INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized) VALUES (?,?,?,'Fixture','fixture','Fixture','fixture')", [id, user, type]);
    await pool.execute("INSERT INTO match_results (id,lost_post_id,found_post_id,total_score) VALUES (?,?,?,0.8)", [match, lost, found]);
    return { user, lost, found, match };
  }
  try {
    await t.test("fresh schema applies original 054 and additive contracts once", () => isolated(async pool => {
      await migrate(pool); await migrate(pool);
      const [ledger] = await pool.query<RowDataPacket[]>("SELECT version FROM schema_migrations");
      assert.equal(ledger.length, files.length);
      assert.ok(ledger.some(row => row.version === original));
      assert.deepEqual((await preflightMigrations({ directory, pool: pool as unknown as MigrationPool })).pending, []);
    }));
    await t.test("dev recovery supersedes original without fake history or rewriting legacy feedback", () => isolated(async pool => {
      await subset(dir => migrate(pool, dir), version => version !== original && !version.startsWith("060_"));
      const fixture = await seed(pool);
      await pool.execute("INSERT INTO match_feedback (id,match_id,user_id,label) VALUES (?,?,?,'TRUE_MATCH')", [randomUUID(), fixture.match, fixture.user]);
      const [before] = await pool.query<RowDataPacket[]>("SELECT * FROM schema_migrations ORDER BY version");
      const plan = await preflightMigrations({ directory, pool: pool as unknown as MigrationPool });
      assert.deepEqual(plan.superseded, [{ version: original, supersededBy: "057_matching_feedback_recovery_contract.sql" }]);
      assert.ok(!plan.pending.includes(original));
      await migrate(pool); await migrate(pool);
      const [after] = await pool.query<RowDataPacket[]>("SELECT * FROM schema_migrations WHERE version NOT LIKE '060_%' ORDER BY version");
      assert.deepEqual(after, before);
      const [feedback] = await pool.query<RowDataPacket[]>("SELECT label FROM match_feedback");
      assert.equal(feedback[0].label, "TRUE_MATCH");
      const [attempts] = await pool.execute<RowDataPacket[]>("SELECT version FROM schema_migration_attempts WHERE version=?", [original]);
      assert.equal(attempts.length, 0);
      await pool.query("ALTER TABLE match_suggestion_dismissals DROP FOREIGN KEY fk_match_dismissal_user");
      await assert.rejects(migrate(pool), /Matching recovery baseline mismatch/);
    }));
    await t.test("original 054 history is skipped with original checksum and applied_at unchanged", () => isolated(async pool => {
      await subset(dir => migrate(pool, dir), version => Number(version.slice(0, 3)) <= 54);
      const [before] = await pool.execute<RowDataPacket[]>("SELECT * FROM schema_migrations WHERE version=?", [original]);
      await migrate(pool); await migrate(pool);
      const [after] = await pool.execute<RowDataPacket[]>("SELECT * FROM schema_migrations WHERE version=?", [original]);
      assert.deepEqual(after, before);
    }));
    await t.test("two connections fence stale workers, cancel ineligible jobs and exhaust retries", () => isolated(async pool => {
      await migrate(pool);
      const data = await seed(pool);
      const repo = createPersistence(pool).matchingRepository;
      const addJob = async (post: string) => pool.execute("INSERT INTO matching_jobs (post_id,available_at) VALUES (?,UTC_TIMESTAMP())", [post]);
      await addJob(data.found);
      const [a, concurrent] = await Promise.all([repo.claimRefreshJobs(1, 15), repo.claimRefreshJobs(1, 15)]);
      assert.equal(a.length + concurrent.length, 1);
      const first = (a[0] ?? concurrent[0]);
      await pool.execute("UPDATE matching_jobs SET lease_expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE post_id=?", [data.found]);
      const [second] = await repo.claimRefreshJobs(1, 15);
      assert.ok(second && first.leaseToken !== second.leaseToken);
      assert.equal(await repo.completeRefreshJob(first), false);
      assert.equal(await repo.failRefreshJob(first, "STALE"), false);
      assert.equal(await repo.renewRefreshJob(first, 15), false);
      const candidate = await repo.findCandidate(data.found);
      assert.ok(candidate);
      assert.equal(await repo.persistForSource(candidate, [], first), false);
      assert.equal(await repo.renewRefreshJob(second, 15), true);
      assert.equal(await repo.completeRefreshJob(second), true);
      await addJob(data.lost);
      await pool.execute("UPDATE posts SET status='CLOSED' WHERE id=?", [data.lost]);
      assert.equal((await repo.claimRefreshJobs(1, 15)).length, 0);
      const [closed] = await pool.execute<RowDataPacket[]>("SELECT status,last_error FROM matching_jobs WHERE post_id=?", [data.lost]);
      assert.equal(closed[0].status, "FAILED");
      assert.equal(closed[0].last_error, "POST_INELIGIBLE");
      await pool.execute("UPDATE matching_jobs SET status='PENDING',attempts=0,available_at=UTC_TIMESTAMP() WHERE post_id=?", [data.found]);
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const [job] = await repo.claimRefreshJobs(1, 15);
        assert.ok(job);
        assert.equal(await repo.failRefreshJob(job, "TRANSIENT"), true);
        await pool.execute("UPDATE matching_jobs SET available_at=UTC_TIMESTAMP() WHERE post_id=?", [data.found]);
      }
      assert.equal((await repo.claimRefreshJobs(1, 15)).length, 0);
      const [exhausted] = await pool.execute<RowDataPacket[]>("SELECT status,attempts FROM matching_jobs WHERE post_id=?", [data.found]);
      assert.equal(exhausted[0].status, "FAILED");
      assert.equal(Number(exhausted[0].attempts), 5);
    }));
  } finally { await admin.end(); }
});
