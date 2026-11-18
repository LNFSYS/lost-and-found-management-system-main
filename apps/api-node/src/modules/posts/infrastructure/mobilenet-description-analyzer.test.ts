import assert from "node:assert/strict";
import test from "node:test";
import { createMobileNetDescriptionAnalyzer } from "./mobilenet-description-analyzer.js";

const image = { buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]), size: 4, mimetype: "image/png" };
const payload = {
  schema_version: "1", model_version: "mobilenetv3-small-lnfs-v1:abc123", category_name: "Bình nước",
  confidence: 0.61, top3: [
    { label: "Bình nước", confidence: 0.61 },
    { label: "Ví/bóp", confidence: 0.23 },
    { label: "Ô/dù", confidence: 0.16 }
  ], requires_confirmation: true, confidence_calibrated: false,
  score_kind: "uncalibrated_softmax", warnings: []
};

test("MobileNet keeps a closed-set prediction editable without inventing visual details", async () => {
  let key = "";
  const analyzer = createMobileNetDescriptionAnalyzer({
    url: "http://127.0.0.1:5001", key: "shared-key", timeoutMs: 1000,
    request: async (_url, init) => {
      key = new Headers(init?.headers).get("X-AI-Service-Key") || "";
      return Response.json(payload);
    }
  });
  const result = await analyzer.analyze([image], "LOST", ["Bình nước", "Ví/bóp"]);
  assert.equal(key, "shared-key");
  assert.equal(result.categoryName, "Bình nước");
  assert.deepEqual(result.categoryCandidates?.map(item => item.name), ["Bình nước", "Ví/bóp"]);
  assert.match(result.title, /Bình nước/);
  assert.deepEqual(result.visibleText, []);
  assert.deepEqual(result.visualAttributes, []);
});

test("MobileNet maps spaced catalog labels but leaves an unsupported catalog choice empty", async () => {
  const analyzer = createMobileNetDescriptionAnalyzer({
    url: "http://127.0.0.1:5001", key: "key", timeoutMs: 1000,
    request: async () => Response.json({
      ...payload, category_name: "Chuột/bàn phím", confidence: 0.61,
      top3: [{ label: "Chuột/bàn phím", confidence: 0.61 }, ...payload.top3.slice(1)]
    })
  });
  const mapped = await analyzer.analyze([image], "LOST", ["Chuột / bàn phím"]);
  assert.equal(mapped.categoryName, "Chuột / bàn phím");
  const unsupported = await analyzer.analyze([image], "LOST", ["Máy ảnh"]);
  assert.equal(unsupported.categoryName, "");
  assert.deepEqual(unsupported.categoryCandidates, []);
});

test("MobileNet rejects unavailable and malformed upstream results safely", async () => {
  for (const request of [
    async () => { throw new Error("secret"); },
    async () => Response.json({ ...payload, confidence_calibrated: true })
  ]) {
    const analyzer = createMobileNetDescriptionAnalyzer({ url: "http://127.0.0.1:5001", key: "key", timeoutMs: 1000, request });
    await assert.rejects(() => analyzer.analyze([image], "FOUND", ["Bình nước"]), error => {
      assert.doesNotMatch(String(error), /secret/);
      return true;
    });
  }
});

test("MobileNet only sends images to the private loopback service and enforces its size limit", async () => {
  assert.throws(() => createMobileNetDescriptionAnalyzer({
    url: "https://example.com", key: "key", timeoutMs: 1000
  }));
  const analyzer = createMobileNetDescriptionAnalyzer({
    url: "http://127.0.0.1:5001", key: "key", timeoutMs: 1000,
    request: async () => { throw new Error("must not call"); }
  });
  await assert.rejects(() => analyzer.analyze([{ ...image, size: 9 * 1024 * 1024 }], "LOST", []));
});
