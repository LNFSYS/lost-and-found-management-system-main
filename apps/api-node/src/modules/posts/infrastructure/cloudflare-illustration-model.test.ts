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
    if (target.endsWith("@cf/meta/llama-3.3-70b-instruct-fp8-fast")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.messages[1].content.includes("Black wallet"), true);
      assert.equal(body.response_format.type, "json_schema");
      return Response.json({ success: true, result: { response: { allowed: true, ...spec } } });
    }
    if (target.endsWith("@cf/black-forest-labs/flux-1-schnell")) {
      assert.equal(JSON.parse(String(init?.body)).steps, 4);
      return Response.json({ success: true, result: { image: generated } });
    }
    assert.match(target, /@cf\/moondream\/moondream3\.1-9B-A2B$/);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.task, "query");
    assert.equal(body.stream, false);
    assert.equal(body.reasoning, false);
    assert.match(body.image, /^data:image\/jpeg;base64,/);
    return Response.json({ success: true, result: { result: { answer: "YES", finish_reason: "stop" }, usage: { total_tokens: 758 } } });
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
  const f = fixture(async url => String(url).endsWith("llama-3.3-70b-instruct-fp8-fast")
    ? textResponse(JSON.stringify({ allowed: false, ...spec }))
    : Response.json({ success: true, result: { answer: "uncertain" } }));
  assert.equal(await f.model.describe(input, context), null);
  await assert.rejects(f.model.verify({ buffer: Buffer.from("x"), size: 1, mimetype: "image/jpeg" }, spec, context), { code: "upstream_failure" });
});

test("Vietnamese input is translated once by Llama; only English attributes reach FLUX and vision", async () => {
  const vietnameseInput = { ...input, title: "Ví Camelia màu đen", description: "Ví vải màu đen, nhỏ gọn, logo Camelia màu trắng ở góc phải." };
  const vietnameseContext = { ...context, category: "Ví / bóp", reference: "Vật phẩm: ví. Đặc điểm: màu, chất liệu, hình dáng." };
  const translated = { item: "wallet", color: "black", material: "fabric", shape: "small and compact",
    details: ["white Camelia logo in the right corner"] };
  for (const serialized of [false, true]) {
    let textCalls = 0;
    const original = JSON.stringify(vietnameseInput);
    const f = fixture(async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (String(url).includes("llama")) {
        textCalls++;
        assert.match(body.messages[0].content, /Translate all accepted visible attributes into concise English/);
        assert.equal(body.stream, false);
        assert.match(body.response_format.json_schema.properties.details.description, /English/);
        const data = JSON.parse(body.messages[1].content);
        assert.equal(data.description, vietnameseInput.description);
        assert.deepEqual(data.reference, { id: vietnameseContext.id, category: vietnameseContext.category });
        assert.ok(!body.messages[1].content.includes(vietnameseContext.reference));
        const response = { allowed: true, ...translated };
        return Response.json({ success: true, result: { response: serialized ? JSON.stringify(response) : response } });
      }
      if (String(url).includes("flux")) {
        assert.ok(body.prompt.includes(JSON.stringify({ object: translated })));
        assert.ok(!body.prompt.includes(vietnameseContext.category));
        assert.ok(!body.prompt.includes(vietnameseContext.reference));
        assert.ok(!body.prompt.includes(vietnameseInput.description));
        return Response.json({ success: true, result: { image: generated } });
      }
      assert.match(body.question, /small and compact black fabric wallet/);
      assert.ok(!body.question.includes(vietnameseContext.category));
      return Response.json({ success: true, result: { result: { answer: "YES", finish_reason: "stop" } } });
    });
    const described = await f.model.describe(vietnameseInput, vietnameseContext);
    assert.deepEqual(described, translated);
    const image = await f.model.generate(described!, vietnameseContext);
    assert.equal(await f.model.verify(image, described!, vietnameseContext), true);
    assert.equal(textCalls, 1);
    assert.equal(JSON.stringify(vietnameseInput), original);
  }
});

test("vision verification supports direct and nested complete decisions", async () => {
  const image = { buffer: Buffer.from("image"), size: 5, mimetype: "image/jpeg" };
  for (const nested of [false, true]) {
    for (const answer of ["YES", " yes. ", "NO", "No!"]) {
      const payload = { answer, finish_reason: "stop" };
      const f = fixture(async () => Response.json({ success: true, result: nested ? { result: payload } : payload }));
      assert.equal(await f.model.verify(image, spec, context), answer.trim().toUpperCase().startsWith("YES"));
    }
  }
});

test("empty streaming results, uncertain, contradictory and truncated answers are errors, not content rejection", async () => {
  const image = { buffer: Buffer.from("image"), size: 5, mimetype: "image/jpeg" };
  for (const result of [{}, { result: {} }, { result: { answer: null } }, { answer: "UNKNOWN" },
    { answer: "Yes, but the object does not match." }, { answer: "relevant: false" },
    { result: { answer: "YES", finish_reason: "length" } }]) {
    const f = fixture(async () => Response.json({ success: true, result }));
    await assert.rejects(f.model.verify(image, spec, context), { code: "upstream_failure" });
  }
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
