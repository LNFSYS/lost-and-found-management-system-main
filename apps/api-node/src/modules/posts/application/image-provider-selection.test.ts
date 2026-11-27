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
  const gemini = provider("Gemini"), qwen = provider("Qwen");
  const service = createImageAnalysisUseCases({ postRepository, analyzer: qwen, analyzers: { gemini, qwen } });
  assert.equal((await service.analyzePostImages([file], "LOST", "gemini")).model, "Gemini");
  assert.equal((await service.analyzePostImages([file], "FOUND", "qwen")).model, "Qwen");
  assert.equal((await service.analyzePostImages([file], "FOUND")).model, "Qwen");
  assert.deepEqual(calls, ["Gemini", "Qwen", "Qwen"]);
});

test("unconfigured provider never silently falls back; unknown provider is rejected", async () => {
  const analyzer: ImageAnalyzer = { model: "Gemini", analyze: async () => { throw new Error("Must not call fallback"); } };
  const service = createImageAnalysisUseCases({ postRepository, analyzer, analyzers: { gemini: analyzer } });
  await assert.rejects(service.analyzePostImages([file], "FOUND", "qwen"), { code: "unavailable" });
  assert.equal(analyzePostImageSchema.safeParse({ type: "LOST", provider: "anything" }).success, false);
  assert.equal(analyzePostImageSchema.safeParse({ type: "LOST" }).success, true);
});
