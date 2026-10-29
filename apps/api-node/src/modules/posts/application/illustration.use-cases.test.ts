import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import test from "node:test";
import type { IllustrationAttempt, IllustrationDraft, IllustrationInput, IllustrationModel, IllustrationRepository } from "./illustration.port.js";
import { createIllustrationUseCases } from "./illustration.use-cases.js";
import { createTestPostUseCases, fakeTransaction } from "../../../test/use-case-fixtures.js";
import { unexpectedPort } from "../../../test/unexpected-port.js";
import type { PostRecord, PostRepository } from "./post.repository.port.js";
import { AppError } from "../../../shared/domain/app-error.js";

const input: IllustrationInput = { title: "Ví da màu đen", description: "Ví da màu đen hình chữ nhật với khóa kéo bạc", categoryId: "category", requestId: "request-1" };
function fixture(modelOverrides: Partial<IllustrationModel> = {}, categoryName = "Ví / bóp") {
  let draft: IllustrationDraft | null = null;
  let calls = 0, reservations = 0;
  let chain: Promise<unknown> = Promise.resolve();
  const requests = new Map<string, IllustrationAttempt>();
  const model: IllustrationModel = {
    available: true, describe: async () => ({ item: "wallet", color: "black", material: "leather", shape: "rectangular", details: [] }),
    generate: async () => { calls++; const buffer = Buffer.from([255, 216, 255, 0]); return { buffer, size: buffer.length, mimetype: "image/jpeg" }; },
    verify: async () => true, ...modelOverrides
  };
  const repository: IllustrationRepository = {
    draft: async () => draft,
    findRequest: async (user, request) => requests.get(`${user}:${request}`) ?? null,
    findAttempt: async (user, id) => [...requests.entries()].find(([key, value]) => key.startsWith(`${user}:`) && value.id === id)?.[1] ?? null,
    reserve: async (user, value, inputHash, ids) => {
      const existing = requests.get(`${user}:${value.requestId}`);
      if (existing) return { fresh: false, attempt: existing };
      if ((draft?.used ?? 0) >= 5) throw new AppError("conflict", "quota");
      if (draft?.attempts.some(a => a.status === "PENDING")) throw new AppError("conflict", "busy");
      draft ??= { id: ids.draft, used: 0, attempts: [] };
      const attempt: IllustrationAttempt = { id: ids.attempt, draftId: draft.id, number: ++draft.used, status: "PENDING", inputHash,
        categoryId: value.categoryId, title: value.title, description: value.description, storageRef: null, publicId: null,
        format: null, bytes: null, postId: null, selectedAttemptId: null };
      draft.attempts.push(attempt); requests.set(`${user}:${value.requestId}`, attempt); reservations++;
      return { fresh: true, attempt };
    },
    finish: async (id, status, asset) => {
      const attempt = [...requests.values()].find(a => a.id === id)!;
      if (attempt.status !== "PENDING") return false;
      Object.assign(attempt, { status }, asset); return true;
    },
    consume: async (user, id, postId, inputHash) => {
      const attempt = await repository.findAttempt(user, id);
      if (!attempt || attempt.inputHash !== inputHash || attempt.postId || attempt.status !== "READY") throw new AppError("invalid_input", "invalid attachment");
      attempt.postId = postId; attempt.selectedAttemptId = attempt.id; draft = null; return attempt;
    },
    closeDraft: async (_user, id) => { assert.equal(draft?.id, id); draft = null; },
    clearDraft: async (_user) => { draft = null; }
  };
  const media: Array<Parameters<PostRepository["createMedia"]>[0]> = [];
  const posts = { getFormCatalog: async () => ({ categories: [{ id: "parent", name: "Túi ví", parentId: null }, { id: "category", name: categoryName, parentId: "parent" }], areas: [], buildings: [], handoverPoints: [] }),
    createMedia: async (row: Parameters<PostRepository["createMedia"]>[0]) => { media.push(row); } };
  const storage = { save: async (_owner: string, id: string) => ({ secureUrl: `private://${id}`, publicId: id }),
    resolve: async () => ({ body: Buffer.from("private bytes"), contentType: "image/jpeg" }), remove: async () => { throw new Error("No compensating deletion permitted"); } };
  const transaction: typeof fakeTransaction = work => {
    const next = chain.then(() => fakeTransaction(work));
    chain = next.catch(() => undefined); return next;
  };
  const service = createIllustrationUseCases({ repository, posts, model, storage, transaction, id: randomUUID, hash: v => createHash("sha256").update(v).digest("hex") });
  return { service, repository, model, media, calls: () => calls, reservations: () => reservations };
}

test("one initial image plus four regenerations survives service reads and refuses the sixth provider call", async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) {
    const result = await f.service.generate("owner", { ...input, requestId: `request-${i}` });
    assert.equal(result.attempt.number, i + 1); assert.equal(result.draft.remaining, 4 - i);
    assert.equal((await f.service.state("owner")).used, i + 1);
  }
  await assert.rejects(f.service.generate("owner", { ...input, requestId: "request-6" }), { code: "conflict" });
  assert.equal(f.calls(), 5);
});
test("clearDraft resets active draft state", async () => {
  const f = fixture();
  await f.service.generate("owner", input);
  assert.equal((await f.service.state("owner")).used, 1);
  await f.service.clearDraft("owner");
  assert.equal((await f.service.state("owner")).used, 0);
});
test("duplicate and concurrent request replay returns the same image without spending another attempt", async () => {
  const f = fixture();
  const replies = await Promise.all([f.service.generate("owner", input), f.service.generate("owner", input)]);
  assert.equal(replies[0].attempt.id, replies[1].attempt.id);
  assert.equal(f.calls(), 1); assert.equal(f.reservations(), 1);
  assert.equal((await f.service.generate("owner", input)).attempt.id, replies[0].attempt.id);
  await assert.rejects(f.service.generate("owner", { ...input, description: "Ví khác màu đỏ hình tròn" }), { code: "conflict" });
});
test("unrelated descriptions, unsupported categories and semantic rejection never invoke image generation", async () => {
  const f = fixture();
  await assert.rejects(f.service.generate("owner", { ...input, description: "Vẽ lâu đài trên bầu trời" }), { code: "invalid_input" });
  await assert.rejects(f.service.generate("owner", { ...input, categoryId: "forged" }), { code: "invalid_input" });
  f.model.describe = async () => null;
  await assert.rejects(f.service.generate("owner", input), { code: "invalid_input" });
  assert.equal(f.calls(), 0); assert.equal(f.reservations(), 0);
});
test("other-items bottle requests retain semantic validation, replay protection and the original description", async () => {
  const bottleInput = { ...input, title: "Bình nước LocknLock",
    description: "BÌnh nước thương hiệu LocknLock, màu trắng kem, có nắp màu đen, 500ml, dài cỡ 20cm" };
  const f = fixture({ describe: async (value, context) => {
    assert.equal(value.description, bottleInput.description);
    assert.equal(context.id, "bottle");
    assert.equal(context.category, "Vật dụng khác");
    return { item: "water bottle", color: "cream white", material: "", shape: "",
      details: ["LocknLock", "black lid", "500 ml", "about 20 cm tall"] };
  } }, "Vật dụng khác");
  const first = await f.service.generate("owner", bottleInput);
  assert.equal(first.attempt.status, "READY");
  assert.equal(first.attempt.description, bottleInput.description);
  assert.equal((await f.service.generate("owner", bottleInput)).attempt.id, first.attempt.id);
  assert.equal(f.calls(), 1);
  assert.equal(f.reservations(), 1);
  f.model.describe = async () => null;
  await assert.rejects(f.service.generate("owner", { ...bottleInput, requestId: "semantic-rejection" }), { code: "invalid_input" });
  await assert.rejects(f.service.generate("owner", { ...bottleInput, requestId: "scene", description: "Vẽ lâu đài trên trời" }), { code: "invalid_input" });
  assert.equal(f.calls(), 1);
  assert.equal(f.reservations(), 1);
});

test("an irrelevant generated image is rejected, not stored or selectable, and consumes its provider attempt", async () => {
  const f = fixture(); f.model.verify = async () => false;
  const result = await f.service.generate("owner", input);
  assert.equal(result.attempt.status, "REJECTED"); assert.equal(result.attempt.url, null);
  assert.equal(result.draft.used, 1);
  await assert.rejects(f.service.image("owner", result.attempt.id), { code: "not_found" });
});
test("provider failure counts once; retry with the same request does not call the provider again", async () => {
  const f = fixture(); f.model.generate = async () => { throw new AppError("upstream_timeout", "timeout"); };
  await assert.rejects(f.service.generate("owner", input), { code: "upstream_timeout" });
  assert.equal((await f.service.generate("owner", input)).attempt.status, "FAILED");
  assert.equal(f.reservations(), 1);
});

test("verification protocol failure marks FAILED, not REJECTED, and replay cannot spend another attempt", async () => {
  const f = fixture({ verify: async () => { throw new AppError("upstream_failure", "Invalid verification response"); } });
  await assert.rejects(f.service.generate("owner", input), { code: "upstream_failure" });
  const replay = await f.service.generate("owner", input);
  assert.equal(replay.attempt.status, "FAILED");
  assert.equal(replay.attempt.url, null);
  assert.equal(replay.draft.used, 1);
  assert.equal(f.calls(), 1);
  assert.equal(f.reservations(), 1);
  assert.equal((await f.repository.findAttempt("owner", replay.attempt.id))?.storageRef, null);
});

test("a provider cooldown is visible to restored drafts and rejects new work before spending quota", async () => {
  const cooldown = { until: Date.now() + 60_000, message: "Gemini quota unavailable" };
  const f = fixture({ cooldown, describe: async () => { throw new AppError("rate_limited", cooldown.message, 60); } });
  assert.deepEqual((await f.service.state("owner")).cooldown, cooldown);
  await assert.rejects(f.service.generate("owner", input), { code: "rate_limited" });
  assert.equal(f.reservations(), 0); assert.equal(f.calls(), 0);
});
test("drafts expose only protected API image paths and other users cannot read or attach them", async () => {
  const f = fixture(); const result = await f.service.generate("owner", input);
  assert.ok(!JSON.stringify(result).includes("private://"));
  assert.match(result.attempt.url!, /^\/api\/posts\/illustrations\//);
  await assert.rejects(f.service.image("outsider", result.attempt.id), { code: "not_found" });
  await assert.rejects(fakeTransaction(db => f.service.attach("outsider", result.attempt.id, "post", input, db)), { code: "invalid_input" });
});
test("only a verified unchanged description can attach; attachment records AI provenance and supports publication replay", async () => {
  const f = fixture(); const result = await f.service.generate("owner", input);
  await assert.rejects(fakeTransaction(db => f.service.attach("owner", result.attempt.id, "post", { ...input, categoryId: "other" }, db)), { code: "invalid_input" });
  await fakeTransaction(db => f.service.attach("owner", result.attempt.id, "post", input, db));
  assert.equal(f.media.length, 1); assert.equal(f.media[0].isAiGenerated, true);
  assert.equal(await f.service.publishedPost("owner", result.attempt.id, input), "post");
  assert.equal((await f.service.state("owner")).used, 0);
});
test("posting with real photos can close a generated draft without attaching an AI image", async () => {
  const f = fixture(); const result = await f.service.generate("owner", input);
  await fakeTransaction(db => f.service.closeDraft("owner", result.draft.id!, "post", db));
  assert.equal((await f.service.state("owner")).used, 0); assert.equal(f.media.length, 0);
});
test("LOST post attachment is atomic and generated illustrations cannot inject image matching tags", async () => {
  let attached = false;
  const repository = Object.assign(unexpectedPort<PostRepository>("posts"), {
    findActiveCategory: async () => "category", findActiveArea: async () => "area", createPost: async () => {},
    findOwnedById: async () => ({ id: "post", userId: "owner", media: [] } as unknown as PostRecord)
  });
  const service = createTestPostUseCases({ postRepository: repository, illustrations: {
    attach: async () => { attached = true; }, publishedPost: async () => null, closeDraft: async () => {}
  } });
  const data = { ...input, type: "LOST" as const, lostFoundAt: new Date(), contactInfo: "owner@example.invalid", areaId: "area", illustrationId: "image",
    analysisSignals: { visualAttributes: ["forged-tag"], visibleText: [], confidence: 1 } };
  await service.createPost("owner", data, { sub: "owner", roles: ["USER"], sessionVersion: 0, email: "" });
  assert.equal(attached, true);
  await assert.rejects(service.createPost("owner", { ...data, type: "FOUND" }, { sub: "owner", roles: ["USER"], sessionVersion: 0, email: "" }), { code: "invalid_input" });
});
