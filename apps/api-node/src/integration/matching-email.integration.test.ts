import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { createPersistence } from "../main/persistence.js";
import { runMigrations, type MigrationPool } from "../migrations/migration-runner.js";
import { createMatchingUseCases } from "../modules/matching/application/matching.use-cases.js";
import { createNotificationEmailQueue } from "../modules/notifications/application/notification-email.queue.js";
import { createNotificationEmailWorker } from "../modules/notifications/application/notification-email.worker.js";

test("isolated matching notifications: transactional dedupe, threshold and closed-post delivery", {
  skip: process.env.LNFS_DB_INTEGRATION === "1" ? false : "Requires explicit isolated MySQL"
}, async t => {
  const host = process.env.LNFS_TEST_DB_HOST ?? "";
  if (!["127.0.0.1", "localhost", "::1"].includes(host) || !process.env.LNFS_TEST_DB_NAME?.endsWith("_test")) throw new Error("Matching email tests refuse shared databases");
  if (!process.env.LNFS_TEST_DB_USER || !process.env.LNFS_TEST_DB_PASSWORD) throw new Error("Isolated credentials required");
  const options = { host, port: Number(process.env.LNFS_TEST_DB_PORT ?? 3306), user: process.env.LNFS_TEST_DB_USER,
    password: process.env.LNFS_TEST_DB_PASSWORD, multipleStatements: true, timezone: "Z", connectionLimit: 5 };
  const admin = mysql.createPool(options);
  const name = `lnfs_match_mail_${randomUUID().replaceAll("-", "")}_test`;
  await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const pool = mysql.createPool({ ...options, database: name });
  const persistence = createPersistence(pool);
  let databaseClock = new Date();
  const emails = createNotificationEmailQueue({ repository: persistence.notificationEmailRepository, id: randomUUID,
    chatDelayMinutes: 5, digestDelayMinutes: 60, now: () => databaseClock });
  const service = createMatchingUseCases({ matchingRepository: persistence.matchingRepository, postRepository: persistence.postRepository,
    idFactory: randomUUID, delivery: { transaction: persistence.transaction, notifications: persistence.notificationRepository, emails } });
  let sends: Array<{ to: string; text: string }> = [];
  const makeWorker = (repository = persistence.notificationEmailRepository) => createNotificationEmailWorker({
    repository, emailDelivery: { send: async input => { sends.push(input); return {}; } }, id: randomUUID,
    frontendUrl: "https://lnfs.example", logger: { warn() {} }
  });
  async function fixture() {
    const owner = randomUUID(), finder = randomUUID(), lost = randomUUID(), found = randomUUID(), category = randomUUID();
    await pool.execute("INSERT INTO item_categories (id,name,name_normalized) VALUES (?,?,?)", [category, category, category]);
    for (const user of [owner, finder]) await pool.execute("INSERT INTO users (id,email,normalized_email,password_hash,full_name,email_verified_at) VALUES (?,?,?,'test-only','Fixture',UTC_TIMESTAMP())", [user, `${user}@example.invalid`, `${user}@example.invalid`]);
    for (const [post, user, type] of [[lost, owner, "LOST"], [found, finder, "FOUND"]]) await pool.execute(
      "INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized,category_id,lost_found_at) VALUES (?,?,?,'Black wallet','black wallet','Black leather pocket','black leather pocket',?,UTC_TIMESTAMP())",
      [post, user, type, category]);
    return { owner, finder, lost, found };
  }
  async function pair(lost: string, found: string) {
    const [rows] = await pool.execute<RowDataPacket[]>("SELECT id,is_notified,total_score FROM match_results WHERE lost_post_id=? AND found_post_id=?", [lost, found]);
    assert.ok(rows[0]); return rows[0];
  }
  async function seedPair(lost: string, found: string, score = 0.6) {
    const id = randomUUID();
    await pool.execute("INSERT INTO match_results (id,lost_post_id,found_post_id,total_score) VALUES (?,?,?,?)", [id, lost, found, score]);
    return id;
  }
  async function lock(postId: string) {
    return persistence.transaction(tx => persistence.matchingRepository.lockUnnotifiedMatches(postId, 0.6, tx));
  }
  try {
    await runMigrations({ directory: fileURLToPath(new URL("../migrations/", import.meta.url)), pool: pool as unknown as MigrationPool, log() {} });
    const [clock] = await pool.query<RowDataPacket[]>("SELECT UTC_TIMESTAMP() AS now");
    databaseClock = clock[0].now;
    await t.test("new FOUND notifies both owners once across recalculate and opposite-side refresh", async () => {
      const f = await fixture();
      await service.runForPost(f.found);
      assert.ok(Number((await pair(f.lost, f.found)).total_score) >= 0.6);
      await Promise.all([service.runForPost(f.found), service.runForPost(f.lost)]);
      const [notifications] = await pool.execute<RowDataPacket[]>("SELECT user_id,entity_id,type FROM notifications WHERE user_id IN (?,?)", [f.owner, f.finder]);
      assert.equal(notifications.length, 2);
      assert.ok(notifications.every(row => row.type === "MATCH_FOUND"));
      assert.deepEqual(new Set(notifications.map(row => row.entity_id)), new Set([f.lost, f.found]));
      sends = [];
      assert.equal((await makeWorker().runOnce()).sent, 2);
      assert.equal(sends.length, 2);
      assert.deepEqual(new Set(sends.map(row => row.to)), new Set([`${f.owner}@example.invalid`, `${f.finder}@example.invalid`]));
      assert.ok(sends.every(row => row.text.includes("/matches") && !row.text.includes("Black leather")));
    });
    await t.test("59.9% is excluded, exactly 60% qualifies, same-owner pairs do not notify", async () => {
      const f = await fixture(), match = await seedPair(f.lost, f.found, 0.599);
      assert.equal((await lock(f.found)).length, 0);
      await pool.execute("UPDATE match_results SET total_score=0.6 WHERE id=?", [match]);
      assert.equal((await lock(f.found)).length, 1);
      await pool.execute("UPDATE posts SET user_id=? WHERE id=?", [f.owner, f.found]);
      assert.equal((await lock(f.found)).length, 0);
      await pool.execute("UPDATE posts SET user_id=?,type='LOST' WHERE id=?", [f.finder, f.found]);
      assert.equal((await lock(f.found)).length, 0);
    });
    await t.test("closed, resolved, expired, hidden and deleted posts are ineligible at enqueue", async () => {
      const f = await fixture(); await seedPair(f.lost, f.found);
      for (const status of ["CLOSED", "RESOLVED", "EXPIRED", "HIDDEN"]) {
        await pool.execute("UPDATE posts SET status=? WHERE id=?", [status, f.lost]);
        assert.equal((await lock(f.found)).length, 0);
      }
      await pool.execute("UPDATE posts SET status='OPEN',deleted_at=UTC_TIMESTAMP() WHERE id=?", [f.lost]);
      assert.equal((await lock(f.found)).length, 0);
    });
    await t.test("enqueue failure rolls back notifications, email and marker; retry is safe", async () => {
      const f = await fixture(); let calls = 0;
      const failing = createMatchingUseCases({ matchingRepository: persistence.matchingRepository, postRepository: persistence.postRepository,
        idFactory: randomUUID, delivery: { transaction: persistence.transaction, notifications: persistence.notificationRepository,
          emails: { ...emails, enqueue: async (input, tx) => { await emails.enqueue(input, tx); if (++calls === 2) throw new Error("injected queue failure"); } } } });
      await assert.rejects(failing.runForPost(f.found), /injected queue failure/);
      assert.equal(Number((await pair(f.lost, f.found)).is_notified), 0);
      const [rows] = await pool.execute<RowDataPacket[]>("SELECT id FROM notifications WHERE user_id IN (?,?)", [f.owner, f.finder]);
      assert.equal(rows.length, 0);
      const [outbox] = await pool.execute<RowDataPacket[]>("SELECT id FROM notification_email_outbox WHERE recipient_user_id IN (?,?)", [f.owner, f.finder]);
      assert.equal(outbox.length, 0);
      await service.runForPost(f.found);
      assert.equal((await makeWorker().runOnce()).sent, 2);
    });
    await t.test("a post closed after enqueue cancels both emails without SMTP", async () => {
      const f = await fixture(); await service.runForPost(f.found);
      await pool.execute("UPDATE posts SET status='CLOSED' WHERE id=?", [f.lost]);
      sends = [];
      assert.equal((await makeWorker().runOnce()).sent, 0);
      assert.equal(sends.length, 0);
      const [outbox] = await pool.execute<RowDataPacket[]>("SELECT status FROM notification_email_outbox WHERE recipient_user_id IN (?,?)", [f.owner, f.finder]);
      assert.deepEqual(outbox.map(row => row.status), ["CANCELLED", "CANCELLED"]);
    });
    await t.test("closing during lease renewal is checked again before SMTP", async () => {
      const f = await fixture(); await service.runForPost(f.found);
      const native = persistence.notificationEmailRepository;
      let renewals = 0;
      const worker = makeWorker({ ...native, renewLease: async (token, seconds) => {
        const renewed = await native.renewLease(token, seconds);
        if (++renewals === 2) await pool.execute("UPDATE posts SET status='CLOSED' WHERE id=?", [f.found]);
        return renewed;
      } });
      sends = [];
      assert.equal((await worker.runOnce()).sent, 0);
      assert.equal(sends.length, 0);
    });
    await t.test("disabled preferences keep in-app notifications but skip that recipient's email", async () => {
      const f = await fixture();
      await persistence.notificationEmailRepository.updatePreferences(f.finder, { chatMode: "DISABLED", claimMode: "DISABLED", quietHoursStart: null, quietHoursEnd: null, timezone: "UTC" });
      await service.runForPost(f.found);
      sends = [];
      assert.equal((await makeWorker().runOnce()).sent, 1);
      assert.equal(sends[0].to, `${f.owner}@example.invalid`);
      assert.equal((await persistence.notificationRepository.listForUser(f.finder)).length, 1);
    });
    await t.test("a dismissed or newly weak pair is cancelled at send time", async () => {
      const f = await fixture(); await service.runForPost(f.found);
      const match = await pair(f.lost, f.found);
      await persistence.matchingRepository.saveDismissal({ id: randomUUID(), matchId: match.id, userId: f.owner, sourcePostId: f.lost, reason: null, correlationKey: randomUUID() });
      sends = [];
      assert.equal((await makeWorker().runOnce()).sent, 1);
      assert.equal(sends[0].to, `${f.finder}@example.invalid`);
      const weak = await fixture(); await service.runForPost(weak.found);
      await pool.execute("UPDATE match_results SET total_score=0.59 WHERE lost_post_id=? AND found_post_id=?", [weak.lost, weak.found]);
      sends = [];
      assert.equal((await makeWorker().runOnce()).sent, 0);
      assert.equal(sends.length, 0);
    });
  } finally {
    await pool.end(); await admin.query(`DROP DATABASE \`${name}\``); await admin.end();
  }
});
