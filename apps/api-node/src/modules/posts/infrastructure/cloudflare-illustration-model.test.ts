import assert from "node:assert/strict";
import test from "node:test";
import type { IllustrationModel } from "../application/illustration.port.js";
import { createCloudflareIllustrationModel } from "./cloudflare-illustration-model.js";

const spec = { item: "wallet", color: "black", material: "leather", shape: "rectangular", details: [] };
const context = { id: "wallet", category: "wallet", reference: "One wallet" };
const input = { title: "Black wallet", description: "A small black leather wallet", categoryId: "category", requestId: "request" };
const guard: IllustrationModel = { available: true, describe: async () => spec, generate: async () => { throw new Error("Gemini image must not run"); }, verify: async () => false };
const imageResponse = (data = Buffer.from([255, 216, 255, 0]).toString("base64")) => Response.json({ success: true, result: { image: data } });
function fixture(request: typeof fetch) {
  let now = 1000;
  const model = createCloudflareIllustrationModel({ token: "test-token", accountId: "a".repeat(32), steps: 4, timeoutMs: 1000, guard, request, now: () => now });
  return { model, advance: () => { now += 61_000; } };
}
test("Cloudflare generates validated bytes and retains independent relevance review", async () => {
  const f = fixture(async (url, init) => {
    assert.match(String(url), /accounts\/a{32}\/ai\/run\/@cf\/black-forest-labs\/flux-1-schnell$/);
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-token");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.steps, 4);
    assert.match(body.prompt, /black/);
    assert.ok(init?.signal instanceof AbortSignal);
    return imageResponse();
  });
  assert.deepEqual(await f.model.describe(input, context), spec);
  const image = await f.model.generate(spec, context);
  assert.equal(image.size, 4);
  assert.equal(await f.model.verify(image, spec, context), false);
});
test("provider failures are sanitized and cooldown prevents repeated calls before reservation", async () => {
  for (const [status, code] of [[402, "unavailable"], [403, "unavailable"], [429, "rate_limited"], [500, "upstream_failure"]]) {
    let calls = 0;
    const f = fixture(async () => { calls++; return new Response("secret-token-private-prompt", { status: Number(status) }); });
    await assert.rejects(f.model.generate(spec, context), (error: unknown) => error instanceof Error && "code" in error && error.code === code && !error.message.includes("secret"));
    await assert.rejects(f.model.describe(input, context), { code: "rate_limited" });
    assert.equal(calls, 1);
    f.advance();
    assert.deepEqual(await f.model.describe(input, context), spec);
  }
});
test("invalid signatures, malformed envelopes and base64 cannot become selectable images", async () => {
  await assert.rejects(fixture(async () => imageResponse(Buffer.from("html").toString("base64"))).model.generate(spec, context), { code: "unsupported_media" });
  for (const response of [imageResponse("!!!="), Response.json({ success: false }), new Response("invalid json")]) {
    await assert.rejects(fixture(async () => response).model.generate(spec, context), { code: "upstream_failure" });
  }
});
test("oversized responses are cancelled before decoding", async () => {
  let cancelled = false;
  const f = fixture(async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { cancelled = true; }
  })));
  await assert.rejects(f.model.generate(spec, context), { code: "payload_too_large" });
  assert.equal(cancelled, true);
});
test("timeouts pause retry; missing account or guard disables generation", async () => {
  const f = fixture(async () => { throw new DOMException("private", "TimeoutError"); });
  await assert.rejects(f.model.generate(spec, context), { code: "upstream_timeout" });
  assert.ok(f.model.cooldown);
  for (const options of [{ accountId: null, guard }, { accountId: "a".repeat(32), guard: { ...guard, available: false } }]) {
    const model = createCloudflareIllustrationModel({ ...options, token: "test", steps: 4, timeoutMs: 1000 });
    assert.equal(model.available, false);
    await assert.rejects(model.generate(spec, context), { code: "unavailable" });
  }
});
