import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import type { RowDataPacket } from "mysql2";
import { withActorJourney, isolatedJourney } from "../test/actor-journey-fixture.js";
import { createIllustrationUseCases } from "../modules/posts/application/illustration.use-cases.js";
import { createPostUseCases } from "../modules/posts/application/post.use-cases.js";
import type { IllustrationModel } from "../modules/posts/application/illustration.port.js";

test("isolated MySQL illustrations: cross-process quota/replay, private ownership and atomic LOST publication", isolatedJourney, async () => {
  await withActorJourney(async f => {
    const parentId = randomUUID(), categoryId = randomUUID();
    await f.pool.execute("INSERT INTO item_categories (id,name,name_normalized) VALUES (?,'Túi ví','tui vi')", [parentId]);
    await f.pool.execute("INSERT INTO item_categories (id,parent_id,name,name_normalized) VALUES (?,?,'Ví / bóp','vi bop')", [categoryId,parentId]);
    let generated = 0;
    let release: (() => void) | undefined;
    let entered: (() => void) | undefined;
    const start = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const model: IllustrationModel = { available: true,
      describe: async () => ({ item: "wallet", color: "black", material: "leather", shape: "rectangular", details: [] }),
      generate: async () => { generated++; if (generated === 1) { entered!(); await gate; } return f.image; }, verify: async () => true };
    const storage = { save: async (_owner: string, id: string) => ({ secureUrl: `private://${id}`, publicId: id }),
      resolve: async () => ({ body: f.image.buffer, contentType: "image/jpeg" }), remove: async () => {} };
    const dependencies = { repository: f.p.illustrationRepository, posts: f.p.postRepository, model, storage, transaction: f.p.transaction,
      id: randomUUID, hash: (value: string) => createHash("sha256").update(value).digest("hex") };
    const a = createIllustrationUseCases(dependencies), b = createIllustrationUseCases(dependencies);
    const input = { categoryId, title: "Ví da màu đen", description: "Ví da màu đen hình chữ nhật có khóa bạc", requestId: randomUUID() };
    const first = a.generate(f.ids.owner, input);
    await start;
    try {
      const replay = await b.generate(f.ids.owner, input);
      assert.equal(replay.attempt.status, "PENDING");
      await assert.rejects(b.generate(f.ids.owner, { ...input, requestId: randomUUID() }), { code: "conflict" });
    } finally { release!(); }
    const firstResult = await first;
    assert.equal((await b.generate(f.ids.owner, input)).attempt.id, firstResult.attempt.id);
    for (let i = 0; i < 4; i++) await a.generate(f.ids.owner, { ...input, requestId: randomUUID() });
    await assert.rejects(b.generate(f.ids.owner, { ...input, requestId: randomUUID() }), { code: "conflict" });
    assert.equal((await b.state(f.ids.owner)).used, 5); assert.equal(generated, 5);
    await assert.rejects(b.image(f.ids.outsider, firstResult.attempt.id), { code: "not_found" });
    const posts = createPostUseCases({ postRepository: f.p.postRepository, matchingRepository: f.p.matchingRepository,
      matchingService: f.services.matchingService, mediaStorage: storage, withTransaction: f.p.transaction, id: randomUUID,
      logger: { warn() {} }, illustrations: b });
    const viewer = { sub: f.ids.owner, email: "qa@example.invalid", roles: ["USER" as const], sessionVersion: 0 };
    const postInput = { ...input, type: "LOST" as const, illustrationId: firstResult.attempt.id, customLocation: "Campus",
      contactInfo: "qa@example.invalid", lostFoundAt: new Date(), analysisSignals: { visualAttributes: ["fake-image-tag"], visibleText: [], confidence: 1 } };
    await assert.rejects(posts.createPost(f.ids.owner, { ...postInput, title: "Changed item title" }, viewer), { code: "invalid_input" });
    const published = await posts.createPost(f.ids.owner, postInput, viewer);
    assert.equal(published.media.length, 1); assert.equal(published.media[0].isAiGenerated, true);
    assert.equal((await posts.createPost(f.ids.owner, postInput, viewer)).id, published.id);
    const [tags] = await f.pool.execute<RowDataPacket[]>("SELECT COUNT(*) total FROM ai_tags WHERE post_id=?", [published.id]);
    assert.equal(Number(tags[0].total), 0);
    assert.equal((await b.state(f.ids.owner)).used, 0);
  });
});
