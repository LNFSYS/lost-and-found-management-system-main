import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import mysql, { type Pool, type PoolOptions, type RowDataPacket } from "mysql2/promise";
import { createApp } from "../app.js";
import { runInTransaction } from "../config/db.js";
import { runMigrations, type MigrationPool } from "../migrations/migration-runner.js";
import { createAdminUserRepository } from "../repositories/admin-user.repository.js";
import { matchingRepository } from "../repositories/matching.repository.js";
import { postRepository } from "../repositories/post.repository.js";
import { createAdminUserService } from "../services/admin-user.service.js";

const integrationEnabled = process.env.LNFS_DB_INTEGRATION === "1";
const skipReason = integrationEnabled
  ? false
  : "Set LNFS_DB_INTEGRATION=1 and LNFS_TEST_DB_* for a dedicated local MySQL database.";

function requiredTestValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for database integration tests`);
  return value;
}

function isolatedPoolOptions(multipleStatements: boolean): PoolOptions {
  const host = requiredTestValue("LNFS_TEST_DB_HOST").toLowerCase();
  const database = requiredTestValue("LNFS_TEST_DB_NAME");
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error("Database integration tests refuse non-local hosts, including shared Aiven databases");
  }
  if (!database.toLowerCase().endsWith("_test")) {
    throw new Error("LNFS_TEST_DB_NAME must end with _test");
  }
  return {
    host,
    port: Number(process.env.LNFS_TEST_DB_PORT ?? "3306"),
    database,
    user: requiredTestValue("LNFS_TEST_DB_USER"),
    password: requiredTestValue("LNFS_TEST_DB_PASSWORD"),
    waitForConnections: true,
    connectionLimit: 4,
    timezone: "Z",
    multipleStatements
  };
}

async function withServer(checkReadiness: () => Promise<void>, run: (baseUrl: string) => Promise<void>) {
  const server = createApp({ checkReadiness }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function removeFixture(pool: Pool, postIds: string[], categoryId: string, userId: string) {
  if (postIds.length) {
    const placeholders = postIds.map(() => "?").join(", ");
    await pool.execute(`DELETE FROM ai_tags WHERE post_id IN (${placeholders})`, postIds);
    await pool.execute(`DELETE FROM post_media WHERE post_id IN (${placeholders})`, postIds);
    await pool.execute(`DELETE FROM posts WHERE id IN (${placeholders})`, postIds);
  }
  await pool.execute("DELETE FROM item_categories WHERE id = ?", [categoryId]);
  await pool.execute("DELETE FROM users WHERE id = ?", [userId]);
}

test("isolated MySQL integration: migrations, auth errors, and post/media integrity", { skip: skipReason }, async (context) => {
  const migrationPool = mysql.createPool(isolatedPoolOptions(true));
  const applicationPool = mysql.createPool(isolatedPoolOptions(false));
  const migrationsDirectory = path.dirname(fileURLToPath(new URL("../migrations/run-migrations.ts", import.meta.url)));

  try {
    await migrationPool.query("SELECT 1");
    await runMigrations({
      directory: migrationsDirectory,
      pool: migrationPool as unknown as MigrationPool,
      log: () => undefined
    });

    await context.test("executes a migration once and records its checksum only after success", async () => {
      const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
      const version = `999900_${suffix}.sql`;
      const probeTable = `lnfs_migration_probe_${suffix}`;
      const directory = await mkdtemp(path.join(os.tmpdir(), "lnfs-db-migration-"));
      await writeFile(path.join(directory, version), `CREATE TABLE ${probeTable} (id INT PRIMARY KEY); INSERT INTO ${probeTable} (id) VALUES (1);`, "utf8");
      try {
        await runMigrations({ directory, pool: migrationPool as unknown as MigrationPool, log: () => undefined });
        await runMigrations({ directory, pool: migrationPool as unknown as MigrationPool, log: () => undefined });
        const [rows] = await applicationPool.execute<RowDataPacket[]>(
          "SELECT COUNT(*) AS total FROM schema_migrations WHERE version = ?",
          [version]
        );
        assert.equal(Number(rows[0]?.total), 1);
      } finally {
        await migrationPool.query(`DROP TABLE IF EXISTS ${probeTable}`);
        await migrationPool.execute("DELETE FROM schema_migrations WHERE version = ?", [version]);
        await migrationPool.execute("DELETE FROM schema_migration_attempts WHERE version = ?", [version]);
        await rm(directory, { recursive: true, force: true });
      }
    });

    await context.test("keeps auth route errors JSON while readiness checks the isolated database", async () => {
      await withServer(async () => { await applicationPool.query("SELECT 1"); }, async (baseUrl) => {
        const malformed = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{"
        });
        assert.equal(malformed.status, 400);
        assert.match(malformed.headers.get("content-type") ?? "", /application\/json/);

        const readiness = await fetch(`${baseUrl}/api/ready`);
        assert.equal(readiness.status, 200);
      });
    });

    await context.test("serializes concurrent removal of the last active admin", async () => {
      const actorId = randomUUID();
      const firstAdminId = randomUUID();
      const secondAdminId = randomUUID();
      const fixtureUsers = [
        [actorId, `${actorId}@example.invalid`, "Admin concurrency actor"],
        [firstAdminId, `${firstAdminId}@example.invalid`, "First concurrency admin"],
        [secondAdminId, `${secondAdminId}@example.invalid`, "Second concurrency admin"]
      ] as const;
      const repository = createAdminUserRepository(applicationPool);
      const service = createAdminUserService({
        repository,
        auditRepository: { async record() {} },
        transaction: async (work) => {
          const connection = await applicationPool.getConnection();
          try {
            return await runInTransaction(connection, work);
          } finally {
            connection.release();
          }
        }
      });

      for (const [userId, email, fullName] of fixtureUsers) {
        await applicationPool.execute(
          `INSERT INTO users (id, email, normalized_email, password_hash, full_name, email_verified_at)
           VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
          [userId, email, email, "integration-test-hash", fullName]
        );
      }
      await applicationPool.execute(
        `INSERT INTO user_roles (user_id, role_code) VALUES
         (?, 'USER'), (?, 'ADMIN'), (?, 'USER'), (?, 'ADMIN'), (?, 'USER')`,
        [actorId, firstAdminId, firstAdminId, secondAdminId, secondAdminId]
      );

      try {
        const outcomes = await Promise.allSettled([
          service.changeStatus(actorId, firstAdminId, { status: "DISABLED" }),
          service.changeStatus(actorId, secondAdminId, { status: "DISABLED" })
        ]);
        const successful = outcomes.filter((outcome) => outcome.status === "fulfilled");
        const rejected = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
        assert.equal(successful.length, 1);
        assert.equal(rejected.length, 1);
        assert.equal((rejected[0]?.reason as { status?: number }).status, 409);

        const [rows] = await applicationPool.execute<RowDataPacket[]>(
          `SELECT COUNT(DISTINCT u.id) AS total
           FROM users u
           INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.role_code = 'ADMIN'
           WHERE u.status = 'ACTIVE'`
        );
        assert.equal(Number(rows[0]?.total), 1);
      } finally {
        await applicationPool.execute("DELETE FROM users WHERE id IN (?, ?, ?)", [actorId, firstAdminId, secondAdminId]);
      }
    });

    await context.test("rolls post tags back atomically and serializes competing media slots", async () => {
      const userId = randomUUID();
      const categoryId = randomUUID();
      const rolledBackPostId = randomUUID();
      const persistedPostId = randomUUID();
      const now = new Date();
      await applicationPool.execute(
        `INSERT INTO users (id, email, normalized_email, password_hash, full_name, email_verified_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [userId, `${userId}@example.invalid`, `${userId}@example.invalid`, "integration-test-hash", "Integration Test"]
      );
      await applicationPool.execute(
        "INSERT INTO item_categories (id, name, name_normalized) VALUES (?, ?, ?)",
        [categoryId, `Integration ${categoryId}`, `integration-${categoryId}`]
      );

      const postInput = (postId: string) => ({
        id: postId,
        userId,
        type: "LOST" as const,
        visibilityMode: "PUBLIC" as const,
        title: "Integration test item",
        titleNormalized: "integration test item",
        description: "Database transaction fixture",
        descriptionNormalized: "database transaction fixture",
        categoryId,
        contactInfo: "integration@example.invalid",
        lostFoundAt: new Date(now.getTime() - 60_000),
        expiresAt: new Date(now.getTime() + 86_400_000)
      });

      try {
        const rollbackConnection = await applicationPool.getConnection();
        try {
          await assert.rejects(runInTransaction(rollbackConnection, async (transaction) => {
            await postRepository.createPost(postInput(rolledBackPostId), transaction);
            await matchingRepository.replaceAnalysisTags(rolledBackPostId, {
              visualAttributes: ["black wallet"],
              visibleText: ["SE123456"],
              confidence: 0.9
            }, transaction);
            throw new Error("simulated tag persistence failure");
          }), /simulated tag persistence failure/);
        } finally {
          rollbackConnection.release();
        }

        const [rolledBackPosts] = await applicationPool.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM posts WHERE id = ?", [rolledBackPostId]);
        const [rolledBackTags] = await applicationPool.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM ai_tags WHERE post_id = ?", [rolledBackPostId]);
        assert.equal(Number(rolledBackPosts[0]?.total), 0);
        assert.equal(Number(rolledBackTags[0]?.total), 0);

        const createConnection = await applicationPool.getConnection();
        try {
          await runInTransaction(createConnection, (transaction) => postRepository.createPost(postInput(persistedPostId), transaction));
        } finally {
          createConnection.release();
        }

        const first = await applicationPool.getConnection();
        const second = await applicationPool.getConnection();
        try {
          await first.beginTransaction();
          assert.ok(await postRepository.lockOwnedPostForMedia(persistedPostId, userId, first));

          let competingTransactionSettled = false;
          const competingUpload = (async () => {
            await second.beginTransaction();
            try {
              assert.ok(await postRepository.lockOwnedPostForMedia(persistedPostId, userId, second));
              const count = await postRepository.countMedia(persistedPostId, second);
              if (count < 5) {
                await postRepository.createMedia({
                  id: randomUUID(), postId: persistedPostId, secureUrl: "unused",
                  publicId: "competing", mediaKind: "ITEM", format: "jpg", bytes: 1, sortOrder: count
                }, second);
              }
              await second.commit();
              return count;
            } catch (error) {
              await second.rollback();
              throw error;
            } finally {
              competingTransactionSettled = true;
            }
          })();

          await new Promise((resolve) => setTimeout(resolve, 75));
          assert.equal(competingTransactionSettled, false);
          for (let index = 0; index < 5; index += 1) {
            await postRepository.createMedia({
              id: randomUUID(), postId: persistedPostId, secureUrl: "unused",
              publicId: `primary-${index}`, mediaKind: "ITEM", format: "jpg", bytes: 1, sortOrder: index
            }, first);
          }
          await first.commit();

          assert.equal(await competingUpload, 5);
          assert.equal(await postRepository.countMedia(persistedPostId, applicationPool), 5);
        } finally {
          first.release();
          second.release();
        }
      } finally {
        await removeFixture(applicationPool, [rolledBackPostId, persistedPostId], categoryId, userId);
      }
    });
  } finally {
    await applicationPool.end();
    await migrationPool.end();
  }
});
