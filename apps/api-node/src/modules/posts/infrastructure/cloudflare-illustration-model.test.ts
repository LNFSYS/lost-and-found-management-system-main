import assert from "node:assert/strict";
import test from "node:test";
import { createCloudflareIllustrationModel } from "./cloudflare-illustration-model.js";

const spec = { item: "wallet", color: "black", material: "leather", shape: "rectangular", details: ["small"] };
const context = { id: "wallet", category: "wallet", reference: "wallet reference" };
const input = { title: "Black wallet", description: "A small black leather wallet", categoryId: "category", requestId: "request" };
const generated = Buffer.from([255, 216, 255, 0]).toString("base64");
const options = { token: "test-token", accountId: "a".repeat(32), steps: 4, timeoutMs: 1000, enabled: true };

function fixture(request: typeof fetch) {
  let now = 1000;
  const model = createCloudflareIllustrationModel({ ...options, request, now: () => now });
  return { model, advance: () => { now += 61_000; } };
}
function textResponse(response: string) { return Response.json({ success: true, result: { response } }); }

test("Cloudflare text, image and vision models complete illustration without Gemini", async () => {
  const calls: string[] = [];
  const f = fixture(async (url, init) => {
    const target = String(url);
    calls.push(target);
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-token");
    if (target.endsWith("@cf/meta/llama-3.2-3b-instruct")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.messages[1].content.includes("Black wallet"), true);
      return textResponse(JSON.stringify({ allowed: true, ...spec }));
    }
    if (target.endsWith("@cf/black-forest-labs/flux-1-schnell")) {
      assert.equal(JSON.parse(String(init?.body)).steps, 4);
      return Response.json({ success: true, result: { image: generated } });
    }
    assert.match(target, /@cf\/moondream\/moondream3\.1-9B-A2B$/);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.task, "query");
    assert.match(body.image, /^data:image\/jpeg;base64,/);
    return Response.json({ success: true, result: { answer: '{"relevant":true}' } });
  });
  assert.equal(f.model.available, true);
  const described = await f.model.describe(input, context);
  assert.deepEqual(described, spec);
  const image = await f.model.generate(described!, context);
  assert.equal(image.size, 4);
  assert.equal(await f.model.verify(image, described!, context), true);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(url => url.startsWith("https://api.cloudflare.com/")));
});

test("unrelated descriptions are rejected and malformed vision answers fail closed", async () => {
  const f = fixture(async url => String(url).endsWith("llama-3.2-3b-instruct")
    ? textResponse(JSON.stringify({ allowed: false, ...spec }))
    : Response.json({ success: true, result: { answer: "uncertain" } }));
  assert.equal(await f.model.describe(input, context), null);
  assert.equal(await f.model.verify({ buffer: Buffer.from("x"), size: 1, mimetype: "image/jpeg" }, spec, context), false);
});

test("provider errors are sanitized and cooldown blocks subsequent model calls", async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; return new Response("private token", { status: 429 }); });
  await assert.rejects(f.model.describe(input, context), (error: unknown) => error instanceof Error
    && "code" in error && error.code === "rate_limited" && !error.message.includes("private"));
  await assert.rejects(f.model.generate(spec, context), { code: "rate_limited" });
  assert.equal(calls, 1);
  f.advance();
  assert.equal(f.model.available, true);
});

test("image output is validated and disabled or missing Cloudflare configuration is unavailable", async () => {
  const invalid = fixture(async () => Response.json({ success: true, result: { image: Buffer.from("html").toString("base64") } }));
  await assert.rejects(invalid.model.generate(spec, context), { code: "unsupported_media" });
  for (const change of [{ enabled: false }, { token: null }, { accountId: "invalid" }]) {
    const model = createCloudflareIllustrationModel({ ...options, ...change });
    assert.equal(model.available, false);
    await assert.rejects(model.describe(input, context), { code: "unavailable" });
  }
});
