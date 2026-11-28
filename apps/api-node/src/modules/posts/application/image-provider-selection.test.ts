import test from "node:test";
import assert from "node:assert/strict";
import { createImageAnalysisUseCases } from "./image-analysis.use-cases.js";
import type { ImageAnalyzer } from "./image-analyzer.port.js";
import { analyzePostImageSchema } from "../interfaces/http/post.validator.js";

const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), size: 4, mimetype: "image/jpeg" };
const postRepository = { getFormCatalog: async () => ({ categories: [
  { id: "bags", name: "Túi", parentId: null }, { id: "backpack", name: "Balo", parentId: "bags" }
], areas: [], buildings: [], handoverPoints: [] }) };

test("explicit buttons route to their provider even when default is Qwen", async () => {
  const calls: string[] = [];
  const provider = (model: string): ImageAnalyzer => ({ model, analyze: async () => {
    calls.push(model);
    return { title: model, description: "Balo", categoryName: "Balo", visualAttributes: [], visibleText: [], confidence: null, warnings: [] };
  } });
  const gemini = provider("Gemini"), qwen = provider("Qwen"), deepseek = provider("spd/deepseek-v4-flash-vision-exp");
  const service = createImageAnalysisUseCases({ postRepository, analyzer: qwen, analyzers: { gemini, qwen, deepseek } });
  assert.equal((await service.analyzePostImages([file], "LOST", "gemini")).model, "Gemini");
  assert.equal((await service.analyzePostImages([file], "FOUND", "qwen")).model, "Qwen");
  assert.equal((await service.analyzePostImages([file], "FOUND")).model, "Qwen");
  const result = await service.analyzePostImages([file], "FOUND", "deepseek");
  assert.equal(result.assistedBy, "DeepSeek image understanding (Vilao)");
  assert.equal(result.suggestedCategory?.id, "backpack");
  assert.equal(result.suggestedCategory?.parentId, "bags");
  assert.deepEqual(calls, ["Gemini", "Qwen", "Qwen", "spd/deepseek-v4-flash-vision-exp"]);
  assert.equal(analyzePostImageSchema.safeParse({ type: "FOUND", provider: "deepseek" }).success, true);
});

test("unconfigured provider never silently falls back; unknown provider is rejected", async () => {
  const analyzer: ImageAnalyzer = { model: "Gemini", analyze: async () => { throw new Error("Must not call fallback"); } };
  const service = createImageAnalysisUseCases({ postRepository, analyzer, analyzers: { gemini: analyzer } });
  await assert.rejects(service.analyzePostImages([file], "FOUND", "qwen"), { code: "unavailable" });
  await assert.rejects(service.analyzePostImages([file], "FOUND", "deepseek"), { code: "unavailable" });
  assert.equal(analyzePostImageSchema.safeParse({ type: "LOST", provider: "anything" }).success, false);
  assert.equal(analyzePostImageSchema.safeParse({ type: "LOST" }).success, true);
});

test("out-of-order providers and concurrent users never share analysis results", async () => {
  const releases: Array<() => void> = [];
  const provider = (model: string): ImageAnalyzer => ({ model, analyze: async (files) => {
    const marker = files[0].buffer.toString("hex");
    await new Promise<void>(resolve => releases.push(resolve));
    return { title: `${model} ${marker}`, description: `Only ${marker}`, categoryName: "Balo", visualAttributes: [marker], visibleText: [], confidence: null, warnings: [] };
  } });
  const gemini = provider("Gemini"), qwen = provider("Qwen"), deepseek = provider("DeepSeek");
  const service = createImageAnalysisUseCases({ postRepository, analyzer: gemini, analyzers: { gemini, qwen, deepseek } });
  const names = ["gemini", "qwen", "deepseek", "deepseek"] as const;
  const files = names.map((_, i) => ({ ...file, buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, i]), size: 5 }));
  const requests = names.map((name, i) => service.analyzePostImages([files[i]], "FOUND", name));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(releases.length, 4);
  releases.reverse().forEach(release => release());
  const results = await Promise.all(requests);
  results.forEach((result, i) => {
    assert.deepEqual(result.visualAttributes, [files[i].buffer.toString("hex")]);
    assert.equal(result.model.toLowerCase(), names[i]);
  });
});
