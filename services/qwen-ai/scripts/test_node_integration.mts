// Manual, opt-in real HTTP test; never invoked by the unit test suite.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { parse } from "dotenv";
import { createQwenImageAnalyzer } from "../../../apps/api-node/src/modules/posts/infrastructure/qwen-image-analyzer.ts";

const config = parse(readFileSync(fileURLToPath(new URL("../.env", import.meta.url))));
const buffer = readFileSync(fileURLToPath(new URL("../../../apps/web/tests/fixtures/appointment-item.png", import.meta.url)));
const adapter = createQwenImageAnalyzer({ serviceUrl: "http://127.0.0.1:8000", apiKey: config.AI_API_KEY });
const started = performance.now();
const result = await adapter.analyze([{ buffer, size: buffer.length, mimetype: "image/png" }], "FOUND", ["bottle"]);
assert.equal(result.imageEmbedding, null);
assert.equal(result.confidence, null);
assert.equal(result.confidence_source, "unavailable");
assert.ok(Array.isArray(result.visualAttributes));
assert.ok(result.description.length > 0);
assert.ok(result.description.length < 1500);
console.log(JSON.stringify({ status: "passed", elapsed_seconds: (performance.now() - started) / 1000,
  model: adapter.model, titlePresent: Boolean(result.title), warningCount: result.warnings.length }));
