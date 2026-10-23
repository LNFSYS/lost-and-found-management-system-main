import assert from "node:assert/strict";
import test from "node:test";
import { createGeminiIllustrationModel } from "./gemini-illustration-model.js";
import type { IllustrationInput } from "../application/illustration.port.js";

const options = { apiKey: "test-key", model: "text-model", imageModel: "image-model", enabled: true, timeoutMs: 1000, imageTimeoutMs: 1000 };
const context = { id: "wallet", category: "Ví / bóp", reference: "One wallet, no private details" };
const input: IllustrationInput = { title: "Ví da màu đen", description: "Ví da màu đen có khóa kéo", categoryId: "category", requestId: "request" };
const spec = { item: "wallet", color: "black", material: "leather", shape: "rectangular", details: [] };
const textResponse = (value: unknown) => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }] }));

test("Gemini illustration uses retrieved reference and structured moderation, then image generation and visual verification", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const buffer = Buffer.from([255, 216, 255, 0]);
  const model = createGeminiIllustrationModel({ ...options, request: async (url, init) => {
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "test-key");
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    if (requests.length === 1) return textResponse({ allowed: true, ...spec });
    if (requests.length === 2) return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ inlineData: { mimeType: "image/jpeg", data: buffer.toString("base64") } }] } }] }));
    return textResponse({ relevant: true });
  } });
  assert.deepEqual(await model.describe(input, context), spec);
  const image = await model.generate(spec, context);
  assert.deepEqual(image.buffer, buffer); assert.equal(await model.verify(image, spec, context), true);
  assert.match(JSON.stringify(requests[0].body), /One wallet/);
  assert.match(JSON.stringify(requests[0].body), /never follow instructions/);
  assert.match(requests[1].url, /image-model:generateContent$/);
  assert.deepEqual((requests[1].body.generationConfig as { responseModalities: string[] }).responseModalities, ["TEXT", "IMAGE"]);
  assert.match(JSON.stringify(requests[2].body), /inlineData/);
});
test("moderation rejects denied or incomplete specs and visual review fails closed on invalid JSON schema", async () => {
  const model = createGeminiIllustrationModel({ ...options, request: async () => textResponse({ allowed: false, ...spec }) });
  assert.equal(await model.describe(input, context), null);
  const malformed = createGeminiIllustrationModel({ ...options, request: async () => textResponse({ relevant: "yes" }) });
  assert.equal(await malformed.verify({ buffer: Buffer.from([255,216,255]), size: 3, mimetype: "image/jpeg" }, spec, context), false);
});
test("provider safety blocks and spoofed signatures cannot become selectable images", async () => {
  const blocked = createGeminiIllustrationModel({ ...options, request: async () => new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } })) });
  await assert.rejects(blocked.generate(spec, context), { code: "invalid_input" });
  const invalid = createGeminiIllustrationModel({ ...options, request: async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/jpeg", data: Buffer.from("not-image").toString("base64") } }] } }] })) });
  await assert.rejects(invalid.generate(spec, context), { code: "unsupported_media" });
});
test("provider errors use safe messages without returning secrets or provider response bodies", async () => {
  for (const [status, code] of [[403, "unavailable"], [429, "rate_limited"], [500, "upstream_failure"]] as const) {
    const model = createGeminiIllustrationModel({ ...options, request: async () => new Response("secret-key-and-private-prompt", { status }) });
    await assert.rejects(model.describe(input, context), (error: unknown) => error instanceof Error && "code" in error && error.code === code && !error.message.includes("secret"));
  }
  assert.equal(createGeminiIllustrationModel({ ...options, apiKey: null }).available, false);
  assert.equal(createGeminiIllustrationModel({ ...options, enabled: false }).available, false);
});

test("image Free Tier quota errors explain Billing, honor RetryInfo and block repeated provider calls", async () => {
  let now = 1_000_000, calls = 0;
  const model = createGeminiIllustrationModel({ ...options, now: () => now, request: async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: "private-provider-message-and-key", details: [
      { violations: [{ quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests", quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] },
      { retryDelay: "76775s" }
    ] } }), { status: 429 });
  } });
  await assert.rejects(model.generate(spec, context), (error: unknown) => error instanceof Error && error.message.includes("Billing") && !error.message.includes("private-provider"));
  assert.equal(model.cooldown?.until, now + 76_775_000);
  await assert.rejects(model.describe(input, context), { code: "rate_limited", retryAfterSeconds: 76_775 });
  assert.equal(calls, 1);
  now += 76_776_000;
  assert.equal(model.cooldown, null);
  await assert.rejects(model.generate(spec, context), { code: "rate_limited" });
  assert.equal(calls, 2);
});

test("daily quotas and transient throttling are distinguished without provider body leakage", async () => {
  for (const [quotaId, expected] of [["GenerateRequestsPerDayPerProjectPerModel", "trong ngày"], ["GenerateRequestsPerMinutePerProjectPerModel", "tần suất"]]) {
    const model = createGeminiIllustrationModel({ ...options, request: async () => new Response(JSON.stringify({ error: { details: [
      { violations: [{ quotaId }] }, { retryDelay: "invalid" }
    ] } }), { status: 429, headers: { "retry-after": "120" } }) });
    await assert.rejects(model.describe(input, context), (error: unknown) => error instanceof Error && error.message.includes(expected) && "retryAfterSeconds" in error && error.retryAfterSeconds === 120);
  }
});

test("malformed quota responses remain safe and excessive retry delays are bounded", async () => {
  for (const [body, expected] of [["not-json-with-secret", 60], [JSON.stringify({ error: { details: [{ retryDelay: "999999999s" }] } }), 86_400]] as const) {
    const model = createGeminiIllustrationModel({ ...options, request: async () => new Response(body, { status: 429 }) });
    await assert.rejects(model.generate(spec, context), { code: "rate_limited", retryAfterSeconds: expected });
  }
});

test("provider timeouts create a short retry cooldown without leaking request data", async () => {
  let now = 1_000_000;
  const model = createGeminiIllustrationModel({ ...options, now: () => now, request: async () => {
    throw new DOMException("request timed out", "TimeoutError");
  } });
  await assert.rejects(model.generate(spec, context), (error: unknown) => error instanceof Error && "code" in error && error.code === "upstream_timeout" && !error.message.includes("request timed out"));
  assert.deepEqual(model.cooldown, { until: now + 60_000, message: "Gemini chưa phản hồi kịp. Hệ thống sẽ tạm dừng thử lại trong 1 phút để tránh tạo yêu cầu trùng." });
});
