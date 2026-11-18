import assert from "node:assert/strict";
import test from "node:test";
import { createFlorenceImageAnalyzer } from "./florence-image-analyzer.js";

const image = { buffer: Buffer.from("image"), size: 5, mimetype: "image/jpeg" };

test("Florence sends one image with a server-side bearer key and returns advisory fields", async () => {
  let calls = 0;
  const analyzer = createFlorenceImageAnalyzer({ url: "http://127.0.0.1:8000", key: "private-key", request: async (url, init) => {
    calls++;
    assert.equal(String(url), "http://127.0.0.1:8000/analyze?caption_mode=lora&include_dense=true");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer private-key");
    assert.equal((init?.body as FormData).getAll("file").length, 1);
    return Response.json({ caption: "A bottle.", more_detailed_caption: "A white bottle.",
      objects: { labels: ["bottle"] }, dense_regions: { labels: ["white bottle"] } });
  } });
  const result = await analyzer.analyze([image], "LOST", ["Bình nước"]);
  assert.equal(calls, 1);
  assert.equal(result.title, "");
  assert.equal(result.categoryName, "");
  assert.deepEqual(result.visibleText, []);
  assert.match(result.description, /A white bottle/);
  assert.equal(result.confidence, 0);
});

test("Florence rejects multiple images and unsafe upstream URLs", async () => {
  for (const url of ["https://example.com", "http://192.168.1.2:8000", "http://127.0.0.1:8000/other"]) {
    assert.throws(() => createFlorenceImageAnalyzer({ url, key: "secret" }));
  }
  const analyzer = createFlorenceImageAnalyzer({ url: "http://localhost:8000", key: "secret" });
  await assert.rejects(() => analyzer.analyze([image, image], "FOUND", []));
});

test("Florence upstream failures do not trigger another provider", async () => {
  const analyzer = createFlorenceImageAnalyzer({ url: "http://localhost:8000", key: "secret",
    request: async () => { throw new Error("private upstream detail"); } });
  await assert.rejects(() => analyzer.analyze([image], "LOST", []), error => {
    assert.ok(error instanceof Error);
    assert.doesNotMatch(error.message, /private upstream detail/);
    return true;
  });
});
