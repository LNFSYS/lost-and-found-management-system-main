import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after } from "node:test";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { pool as defaultPool } from "../main/database.js";
import { createPersistence } from "../main/persistence.js";
import { createServices } from "../main/services.js";
import { runMigrations } from "../migrations/migration-runner.js";
import type { MigrationPool } from "../migrations/migration-state.js";
import { createClaimUseCases } from "../modules/claims/application/claim.use-cases.js";
import { createContactPhotoUseCases } from "../modules/claims/application/contact-photo.use-cases.js";
import { createAuthSecurity } from "../modules/auth/infrastructure/auth-security.js";
import { env } from "../shared/infrastructure/config/env.js";
import { createPrivateMediaStorage } from "../shared/infrastructure/private-media-storage.js";

after(async () => { await defaultPool.end(); });
export const isolatedJourney = { skip: process.env.LNFS_DB_INTEGRATION !== "1" };

async function fixture(pool: Pool, uploadDir: string) {
  const p = createPersistence(pool);
  const services = createServices(p, { ...env, uploadDir, cloudinary: { cloudName: null, apiKey: null, apiSecret: null } });
  const ids = { finder: randomUUID(), owner: randomUUID(), outsider: randomUUID(), staff: randomUUID(), admin: randomUUID(), found: randomUUID(), lost: randomUUID() };
  for (const user of [ids.finder, ids.owner, ids.outsider, ids.staff, ids.admin]) {
    const email = `${user}@example.invalid`;
    await pool.execute("INSERT INTO users (id,email,normalized_email,password_hash,full_name,email_verified_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP())", [user,email,email,"test-only","Fixture"]);
    await pool.execute("INSERT INTO user_roles (user_id,role_code) VALUES (?,?)", [user,user === ids.staff ? "STAFF" : user === ids.admin ? "ADMIN" : "STUDENT"]);
  }
  const [points] = await pool.query<RowDataPacket[]>("SELECT id FROM handover_points WHERE is_active = TRUE LIMIT 1");
  const point = String(points[0]!.id);
  const categoryId = randomUUID();
  await pool.execute("INSERT INTO item_categories (id,name,name_normalized) VALUES (?,'Journey keys','journey keys')", [categoryId]);
  for (const [post,user,type] of [[ids.found,ids.finder,"FOUND"],[ids.lost,ids.owner,"LOST"]]) {
    await pool.execute("INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized,category_id) VALUES (?,?,?,'Keys','keys','Fixture','fixture',?)", [post,user,type,categoryId]);
  }
  const mediaStorage = createPrivateMediaStorage({ uploadDir, namespace: "claim-evidence", invalidPathMessage: "Invalid", notFoundMessage: "Missing" });
  const contactPhotos = createContactPhotoUseCases({ repository: p.contactPhotoRepository, claims: p.claimRepository, matching: p.matchingRepository,
    authorizeTarget: postId => services.postService.getPost(postId), transaction: p.transaction, id: randomUUID, mediaStorage,
    imageAnalysis: { analyzePostImages: async () => ({ title: "Keys", description: "Fixture", suggestedCategory: { id: categoryId, name: "Journey keys", parentId: null },
      visualAttributes: [], visibleText: [], confidence: .95, model: "isolated-fixture", assistedBy: "fixture", warnings: [], imageCount: 1 }) } });
  const claims = createClaimUseCases({ claimRepository: p.claimRepository, matchingRepository: p.matchingRepository, notificationRepository: p.notificationRepository,
    warehouseRepository: p.warehouseRepository, custodyRequestRepository: p.custodyRequestRepository, contactPhotos, withTransaction: p.transaction, id: randomUUID,
    hashIdempotencyPayload: createAuthSecurity(env).hashToken, mediaStorage, logger: { warn() {} } });
  const image = { buffer: Buffer.from([0xff,0xd8,0xff,0xe0]), size: 4, mimetype: "image/jpeg" };
  async function evidence(custodyRequestId?: string) {
    const intakeKey = randomUUID();
    const upload = await services.warehouseService.uploadIntakeImage({ intakeKey, ...(custodyRequestId ? { custodyRequestId } : {}) }, image, ids.staff);
    return { intakeKey, intakeImageIds: [upload.id], receivedQuantity: 1, accessories: "None", physicalReviewConfirmed: true as const, conditionNotes: "Good" };
  }
  return { pool, p, ids, point, categoryId, services: { ...services, claimService: claims }, claims, contactPhotos, image, evidence };
}

export async function withActorJourney(run: (context: Awaited<ReturnType<typeof fixture>>) => Promise<void>) {
  if (process.env.LNFS_DB_INTEGRATION !== "1" || process.env.LNFS_TEST_DB_HOST !== "127.0.0.1" || !process.env.LNFS_TEST_DB_NAME?.endsWith("_test")) {
    throw new Error("Explicit isolated loopback *_test database required");
  }
  const config = { host: "127.0.0.1", port: Number(process.env.LNFS_TEST_DB_PORT), user: process.env.LNFS_TEST_DB_USER,
    password: process.env.LNFS_TEST_DB_PASSWORD, multipleStatements: true, timezone: "Z", connectionLimit: 8 };
  const name = `lnfs_journey_${randomUUID().replaceAll("-", "")}_test`;
  const admin = mysql.createPool(config);
  const pool = mysql.createPool({ ...config, database: name });
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), "lnfs-actor-journey-"));
  try {
    await admin.query(`CREATE DATABASE \`${name}\``);
    await runMigrations({ directory: fileURLToPath(new URL("../migrations/", import.meta.url)), pool: pool as unknown as MigrationPool, log: () => {} });
    await run(await fixture(pool, uploadDir));
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
    await rm(uploadDir, { recursive: true, force: true });
  }
}
