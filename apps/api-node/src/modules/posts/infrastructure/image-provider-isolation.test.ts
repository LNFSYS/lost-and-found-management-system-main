import test from "node:test";
import assert from "node:assert/strict";
import { createGeminiImageAnalyzer } from "./gemini-image-analyzer.js";
import { createQwenImageAnalyzer } from "./qwen-image-analyzer.js";
import { createDeepSeekImageAnalyzer } from "./deepseek-image-analyzer.js";

const file = { buffer: Buffer.from([255, 216, 255]), size: 3, mimetype: "image/jpeg" };
const result = { title: "Vật phẩm riêng", description: "Mô tả dành riêng cho vật phẩm.", categoryName: "", visualAttributes: [], visibleText: [], confidence: 0.8, warnings: [] };
const factories = {
  gemini: (request: typeof fetch) => createGeminiImageAnalyzer({ apiKey: "gemini-key", model: "gemini-test", timeoutMs: 1000, request }),
  deepseek: (request: typeof fetch) => createDeepSeekImageAnalyzer({ apiKey: "deepseek-key", model: "spd/deepseek-test", baseUrl: "https://api.vilao.ai/v1", timeoutMs: 1000, request }),
  qwen: (request: typeof fetch) => createQwenImageAnalyzer({ apiKey: "qwen-key-012345678901234567890123456789", serviceUrl: "http://localhost:8000", timeoutMs: 1000, request })
};
const responses = {
  gemini: () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }),
  deepseek: () => Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] }),
  qwen: () => Response.json({ status: "success", model: "Qwen", data: { category: null, object_name: "Vật phẩm riêng", colors: [], material: null, brand: null, visible_text: [], distinctive_features: [], caption: result.description } })
};

for (const name of ["gemini", "qwen", "deepseek"] as const) {
  test(`${name}: cancelling one request does not cancel another or poison next request`, async () => {
    let count = 0;
    const signals: AbortSignal[] = [];
    const analyzer = factories[name](async (_url, init) => {
      count++;
      const signal = init!.signal!;
      signals.push(signal);
      if (count !== 1) return responses[name]();
      return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    });
    const controller = new AbortController();
    const pending = analyzer.analyze([file, file], "FOUND", [], { signal: controller.signal });
    const rejection = assert.rejects(pending, { name: "AbortError" });
    const other = await analyzer.analyze([file], "LOST", []);
    controller.abort();
    await rejection;
    assert.equal(signals[0].aborted, true);
    assert.equal(signals[1].aborted, false);
    assert.ok(other.title);
    await analyzer.analyze([file], "FOUND", []);
    assert.equal(count, 3, "cancelled Qwen batch must not send its second image");
  });
  test(`${name}: already cancelled request sends no image`, async () => {
    const analyzer = factories[name](async () => { assert.fail("Must not call provider"); });
    await assert.rejects(analyzer.analyze([file], "FOUND", [], { signal: AbortSignal.abort() }), { name: "AbortError" });
  });
}
