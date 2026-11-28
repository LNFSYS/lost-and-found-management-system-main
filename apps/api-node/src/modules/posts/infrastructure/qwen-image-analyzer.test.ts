import test from "node:test";
import assert from "node:assert/strict";
import { createQwenImageAnalyzer } from "./qwen-image-analyzer.js";
import { createImageAnalysisUseCases } from "../application/image-analysis.use-cases.js";

const file = { buffer: Buffer.from("image"), size: 5, mimetype: "image/png" };
const apiKey = "test-key-not-real-01234567890123456789";
const payload = { status: "success", model: "Qwen/Qwen3-VL-2B-Instruct", data: {
  category: "wallet", object_name: "black wallet", colors: ["black"], material: null,
  brand: null, visible_text: [], distinctive_features: ["zipper"], caption: "A black wallet."
} };

test("held mouse uses agreeing object views instead of the first hand observation", async () => {
  let call = 0;
  const views = [
    { ...payload.data, category: "hand", object_name: "Bàn tay cầm", caption: "Bàn tay cầm màu đen.", distinctive_features: ["ngón tay"] },
    { ...payload.data, category: "computer mouse", object_name: "Chuột máy tính", caption: "Chuột màu đen có con lăn.", distinctive_features: ["con lăn"] },
    { ...payload.data, category: "wireless mouse", object_name: "Chuột máy tính", caption: "Mặt dưới có cảm biến.", distinctive_features: ["cảm biến"] }
  ];
  const analyzer = createQwenImageAnalyzer({ serviceUrl: "http://localhost:8000", apiKey,
    request: async () => Response.json({ ...payload, data: views[call++] }) });
  const category = { id: "mouse-keyboard", name: "Chuột / bàn phím", parentId: "electronics" };
  const service = createImageAnalysisUseCases({ analyzer, postRepository: { getFormCatalog: async () => ({ categories: [category] }) } as any });
  const upload = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), size: 4, mimetype: "image/jpeg" };
  const result = await service.analyzePostImages([upload, upload, upload], "LOST");
  assert.equal(result.title, "Chuột máy tính");
  assert.deepEqual(result.suggestedCategory, category);
  assert.ok(!result.description.includes("Bàn tay"));
  assert.ok(!result.visualAttributes.includes("ngón tay"));
});

test("hand-only observations never invent a mouse or carry hand details into the draft", async () => {
  const analyzer = createQwenImageAnalyzer({ serviceUrl: "http://localhost:8000", apiKey,
    request: async () => Response.json({ ...payload, data: { ...payload.data, category: "hand", object_name: "Bàn tay cầm" } }) });
  const result = await analyzer.analyze([file], "FOUND", ["Chuột / bàn phím"]);
  assert.equal(result.title, "Vật phẩm cần kiểm tra");
  assert.equal(result.description, "");
  assert.equal(result.categoryName, "");
  assert.deepEqual(result.visualAttributes, []);
});

test("three thermos views populate an existing category and parent even with one unknown view", async () => {
  let call = 0;
  const analyzer = createQwenImageAnalyzer({ serviceUrl: "http://localhost:8000", apiKey,
    request: async () => Response.json({ ...payload, data: { ...payload.data,
      category: ["thermos", "water bottle", null][call],
      object_name: ["bình giữ nhiệt", "bình nước màu xám", "vật phẩm"][call++] } }) });
  const category = { id: "catalog-bottle-id", name: "Bình nước", parentId: "catalog-study-id" };
  const service = createImageAnalysisUseCases({ analyzer, postRepository: { getFormCatalog: async () => ({
    categories: [{ id: category.parentId, name: "Đồ học tập", parentId: null }, category],
    areas: [], buildings: [], handoverPoints: []
  }) } });
  const upload = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), size: 4, mimetype: "image/jpeg" };
  const result = await service.analyzePostImages([upload, upload, upload], "LOST");
  assert.deepEqual(result.suggestedCategory, category);
  assert.ok(!result.warnings.some(warning => warning.includes("chọn thủ công")));
});

test("conflicting recognized views do not autofill a category", async () => {
  let call = 0;
  const analyzer = createQwenImageAnalyzer({ serviceUrl: "http://localhost:8000", apiKey,
    request: async () => Response.json({ ...payload, data: { ...payload.data,
      category: ["thermos", "water bottle", "backpack"][call++], object_name: null } }) });
  const result = await analyzer.analyze([file, file, file], "FOUND", ["Bình nước", "Balo"]);
  assert.equal(result.categoryName, "");
  assert.equal(result.title, "Vật phẩm cần kiểm tra");
  assert.equal(result.description, "");
  assert.deepEqual(result.visualAttributes, []);
  assert.ok(result.warnings.some(warning => warning.includes("khác nhau")));
});

test("phone analysis returns catalog IDs for both dependent dropdowns", async () => {
  const analyzer = createQwenImageAnalyzer({ serviceUrl: "http://localhost:8000", apiKey,
    request: async () => Response.json({ ...payload, data: { ...payload.data,
      category: "phone", object_name: "Điện thoại màu đỏ", colors: ["đỏ"], caption: "Điện thoại màu đỏ có màn hình đen." } }) });
  const category = { id: "catalog-phone-id", name: "Điện thoại", parentId: "catalog-electronics-id" };
  const service = createImageAnalysisUseCases({ analyzer, postRepository: { getFormCatalog: async () => ({
    categories: [{ id: category.parentId, name: "Thiết bị điện tử", parentId: null }, category],
    areas: [], buildings: [], handoverPoints: []
  }) } });
  const upload = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), size: 4, mimetype: "image/jpeg" };
  const result = await service.analyzePostImages([upload], "LOST");
  assert.equal(result.title, "Điện thoại màu đỏ");
  assert.deepEqual(result.suggestedCategory, category);
  assert.ok(!result.warnings.some(warning => warning.includes("chọn thủ công")));
});

test("Qwen sends authenticated multipart and maps each image without inventing embeddings", async () => {
  let active = 0, calls = 0;
  const analyzer = createQwenImageAnalyzer({ serviceUrl: "http://127.0.0.1:8000", apiKey,
    request: async (url, options) => {
      assert.equal(String(url), "http://127.0.0.1:8000/ai/analyze");
      assert.equal(new Headers(options?.headers).get("Authorization"), `Bearer ${apiKey}`);
      assert.equal(options?.redirect, "error");
      const body = options?.body as FormData;
      assert.equal(body.get("type"), "FOUND");
      assert.equal(body.get("user_description"), "context");
      assert.ok(body.get("image") instanceof Blob);
      assert.equal(++active, 1);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--; calls++;
      return Response.json(payload);
    }
  });
  const result = await analyzer.analyze([file, file], "FOUND", ["wallet"], { description: "context" });
  assert.equal(calls, 2);
  assert.equal(result.categoryName, "wallet");
  assert.equal(result.imageEmbedding, null);
  assert.equal(result.confidence, null);
  assert.equal(result.confidence_source, "unavailable");
  assert.equal(result.description, "A black wallet.");
  assert.deepEqual(result.visualAttributes, ["black", "zipper"]);
});

test("backpack regression maps catalog, deduplicates captions and keeps new visible attributes", async () => {
  const data = { ...payload.data, category: "backpack", object_name: "Balo", colors: ["xanh đậm", "đen", "trắng"],
    primary_color: "xanh đậm", secondary_colors: ["đen", "trắng"], shape: "đỉnh bo tròn", pattern: "ba sọc trắng",
    brand: null, distinctive_features: ["quai đen", "túi khóa kéo phía trước"],
    caption: "Balo xanh đậm có ba sọc trắng. Balo xanh đậm có ba sọc trắng." };
  const analyzer = createQwenImageAnalyzer({ serviceUrl: "http://localhost:8000", apiKey,
    request: async () => Response.json({ ...payload, data }) });
  const result = await analyzer.analyze([file, file], "LOST", ["Balo", "Túi xách"]);
  assert.equal(result.categoryName, "Balo");
  assert.equal(result.description, "Balo xanh đậm có ba sọc trắng.");
  assert.equal(result.confidence, null);
  assert.ok(result.visualAttributes.includes("đỉnh bo tròn"));
  assert.ok(result.visualAttributes.includes("xanh đậm"));
});

for (const [status, code] of [[429, "rate_limited"], [401, "unavailable"], [503, "unavailable"]] as const) {
  test(`Qwen HTTP ${status} is handled without leaking upstream secrets`, async () => {
    const analyzer = createQwenImageAnalyzer({ serviceUrl: "http://localhost:8000", apiKey,
      request: async () => new Response(apiKey, { status }) });
    await assert.rejects(analyzer.analyze([file], "LOST", []), (error: any) => {
      assert.equal(error.code, code); assert.ok(!error.message.includes(apiKey)); return true;
    });
  });
}

test("invalid Qwen output is rejected", async () => {
  const analyzer = createQwenImageAnalyzer({ serviceUrl: "http://localhost:8000", apiKey,
    request: async () => Response.json({ ...payload, data: { ...payload.data, colors: "black" } }) });
  await assert.rejects(analyzer.analyze([file], "FOUND", []), { code: "upstream_failure" });
});

test("Qwen request timeout aborts fetch", async () => {
  const analyzer = createQwenImageAnalyzer({ serviceUrl: "http://localhost:8000", apiKey, timeoutMs: 10,
    request: async (_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }) });
  await assert.rejects(analyzer.analyze([file], "FOUND", []), { code: "upstream_timeout" });
});

test("Qwen rejects invalid configuration and empty images", async () => {
  assert.throws(() => createQwenImageAnalyzer({ serviceUrl: "http://localhost", apiKey: "" }));
  assert.throws(() => createQwenImageAnalyzer({ serviceUrl: "file:///secret", apiKey }));
  const analyzer = createQwenImageAnalyzer({ serviceUrl: "http://localhost:8000", apiKey });
  await assert.rejects(analyzer.analyze([], "FOUND", []), { code: "bad_request" });
});
