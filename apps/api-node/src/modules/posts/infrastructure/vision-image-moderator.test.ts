import test from "node:test";
import assert from "node:assert/strict";
import { createVisionImageModerator } from "./vision-image-moderator.js";
import { createImageAnalysisUseCases } from "../application/image-analysis.use-cases.js";
import { AppError } from "../../../shared/domain/app-error.js";

const file = { buffer: Buffer.from([255, 216, 255, 224]), size: 4, mimetype: "image/jpeg" };
const options = { apiKey: "test-key", baseUrl: "https://api.vilao.ai/v1", model: "test", timeoutMs: 1000 };
const response = (decision: string, reason: string) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ decision, reason }) } }] });

for (const reason of ["graphic_violence", "sexual_content", "self_harm", "hate", "unrelated", "personal_data", "financial_credentials", "dangerous_item", "restricted_product"]) {
  test(`reject ${reason} without descriptions`, async () => {
    const moderator = createVisionImageModerator({ ...options, request: async () => response("block", reason) });
    await assert.rejects(moderator.assertAllowed([file]), { code: "invalid_input" });
  });
}
test("safe item accepted; every image inspected independently", async () => {
  let calls = 0;
  const moderator = createVisionImageModerator({ ...options, request: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.messages[1].content.filter((part: { type: string }) => part.type === "image_url").length, 1);
    calls++;
    return calls === 2 ? response("block", "unrelated") : response("allow", "safe_item");
  } });
  await moderator.assertAllowed([file]);
  await assert.rejects(moderator.assertAllowed([file, file]), { code: "invalid_input" });
  assert.equal(calls, 2);
});

for (const reason of ["redacted_document", "redacted_bank_card"]) test(`${reason} yields a generic draft without sending to any description provider`, async () => {
  const analyzer = { model: "test", analyze: async () => { assert.fail("No document OCR or description call"); } };
  const service = createImageAnalysisUseCases({ analyzer, analyzers: { gemini: analyzer, qwen: analyzer, deepseek: analyzer },
    postRepository: { getFormCatalog: async () => { assert.fail("No catalog required for privacy draft"); } },
    moderator: createVisionImageModerator({ ...options, request: async () => response("allow", reason) })
  });
  for (const provider of ["gemini", "qwen", "deepseek"] as const) {
    const result = await service.analyzePostImages([file], "FOUND", provider);
    assert.equal(result.title, "Giấy tờ cá nhân đã che thông tin");
    assert.deepEqual(result.visibleText, []);
    assert.equal(result.imageEmbedding, null);
  }
});

test("a redacted bank card does not allow an exposed card in the same batch", async () => {
  let calls = 0;
  const moderator = createVisionImageModerator({ ...options, request: async () =>
    ++calls === 1 ? response("allow", "redacted_bank_card") : response("block", "financial_credentials") });
  await assert.rejects(moderator.assertAllowed([file, file]), { code: "invalid_input" });
  assert.equal(calls, 2);
});

test("a redacted document cannot mask an exposed document later in the batch", async () => {
  let calls = 0;
  const moderator = createVisionImageModerator({ ...options, request: async () =>
    ++calls === 1 ? response("allow", "redacted_document") : response("block", "personal_data") });
  await assert.rejects(moderator.assertAllowed([file, file]), { code: "invalid_input" });
  assert.equal(calls, 2);
});

test("restricted product in a mixed batch blocks the entire request without echoing model content", async () => {
  let calls = 0;
  const moderator = createVisionImageModerator({ ...options, request: async () =>
    ++calls === 1 ? response("allow", "safe_item") : response("allow", "restricted_product") });
  await assert.rejects(moderator.assertAllowed([file, file]), {
    code: "invalid_input",
    message: "Loại vật phẩm này không được hỗ trợ tạo mô tả bằng AI. Vui lòng chọn ảnh vật phẩm khác."
  });
  assert.equal(calls, 2);
});

test("unknown, malformed, truncated, outage and missing key fail closed", async () => {
  for (const request of [
    async () => response("uncertain", "unclear"),
    async () => response("allow", "graphic_violence"),
    async () => Response.json({ choices: [{ finish_reason: "length", message: { content: "{}" } }] }),
    async () => Response.json({ choices: [{ finish_reason: "stop", message: { content: "not JSON" } }] }),
    async () => new Response("secret upstream", { status: 503 })
  ]) await assert.rejects(createVisionImageModerator({ ...options, request }).assertAllowed([file]));
  await assert.rejects(createVisionImageModerator({ ...options, apiKey: null }).assertAllowed([file]), { code: "unavailable" });
});
test("all providers are gated before any description or catalog request", async () => {
  const analyzer = { model: "test", analyze: async () => { throw new Error("Description must not run"); } };
  const service = createImageAnalysisUseCases({ analyzer, analyzers: { gemini: analyzer, qwen: analyzer, deepseek: analyzer },
    postRepository: { getFormCatalog: async () => { throw new Error("Catalog must not run"); } },
    moderator: { assertAllowed: async () => { throw new AppError("invalid_input", "Blocked"); } }
  });
  for (const provider of ["gemini", "qwen", "deepseek"] as const) await assert.rejects(service.analyzePostImages([file], "FOUND", provider), { code: "invalid_input", message: "Blocked" });
});
