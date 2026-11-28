import test from "node:test";
import assert from "node:assert/strict";
import { createDeepSeekImageAnalyzer } from "./deepseek-image-analyzer.js";

const file = { buffer: Buffer.from([255, 216, 255]), size: 3, mimetype: "image/jpeg" };
const analysis = { title: "Chuột màu đen", description: "Chuột màu đen có con lăn và logo.", categoryName: "Chuột / bàn phím", visualAttributes: ["Đen"], visibleText: ["RAZER"], confidence: 0.8, warnings: [] };
const options = { apiKey: "test-key", baseUrl: "https://api.vilao.ai/v1/", model: "spd/deepseek-v4-flash-vision-exp", timeoutMs: 1000 };

test("DeepSeek sends all views with backend auth and parses fenced JSON", async () => {
  const analyzer = createDeepSeekImageAnalyzer({ ...options, request: async (url, init) => {
    assert.equal(url, "https://api.vilao.ai/v1/chat/completions");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-key");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, options.model);
    assert.equal(body.stream, false);
    assert.equal(body.messages[0].content.filter((x: { type: string }) => x.type === "image_url").length, 2);
    assert.match(body.messages[0].content[0].text, /Chuột \/ bàn phím/);
    assert.match(body.messages[0].content[1].image_url.url, /^data:image\/jpeg;base64,/);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: "```json\n" + JSON.stringify(analysis) + "\n```" } }] });
  } });
  assert.deepEqual(await analyzer.analyze([file, file], "FOUND", [analysis.categoryName]), analysis);
});

for (const [status, code] of [[401, "unavailable"], [402, "unavailable"], [403, "unavailable"], [404, "unavailable"], [429, "rate_limited"], [500, "upstream_failure"]] as const) {
  test(`DeepSeek maps HTTP ${status} without exposing upstream body`, async () => {
    const analyzer = createDeepSeekImageAnalyzer({ ...options, request: async () => new Response("secret upstream details", { status }) });
    await assert.rejects(analyzer.analyze([file], "LOST", []), (error: Error & { code?: string }) => error.code === code && !error.message.includes("secret"));
  });
}

test("DeepSeek rejects malformed and truncated responses", async () => {
  for (const choice of [{ message: { content: "not JSON" } }, { message: { content: "{}" } }, { finish_reason: "length", message: { content: JSON.stringify(analysis) } }]) {
    const analyzer = createDeepSeekImageAnalyzer({ ...options, request: async () => Response.json({ choices: [choice] }) });
    await assert.rejects(analyzer.analyze([file], "FOUND", []), { code: "upstream_failure" });
  }
});

test("extra provider warnings do not discard valid image analysis", async () => {
  const result = { ...analysis, warnings: Array.from({ length: 7 }, (_, i) => `Cảnh báo ${i}`) };
  const analyzer = createDeepSeekImageAnalyzer({ ...options, request: async () => Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] }) });
  const parsed = await analyzer.analyze([file], "FOUND", []);
  assert.equal(parsed.title, analysis.title);
  assert.equal(parsed.warnings.length, 6);
});

test("DeepSeek aborts a stalled provider", async () => {
  const analyzer = createDeepSeekImageAnalyzer({ ...options, timeoutMs: 5, request: async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }) });
  await assert.rejects(analyzer.analyze([file], "LOST", []), { code: "upstream_timeout" });
});

test("missing key does not send images", async () => {
  const analyzer = createDeepSeekImageAnalyzer({ ...options, apiKey: null, request: async () => { throw new Error("Unexpected request"); } });
  await assert.rejects(analyzer.analyze([file], "FOUND", []), { code: "unavailable" });
});
