import assert from "node:assert/strict";
import test from "node:test";

process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-at-least-for-unit-tests";
process.env.SMTP_HOST ||= "localhost";
process.env.SMTP_USER ||= "test@example.com";
process.env.SMTP_PASS ||= "test";
process.env.SMTP_FROM ||= "test@example.com";
process.env.GEMINI_API_KEY ||= "test-gemini-key";

test("matchSuggestedCategory ưu tiên danh mục con trùng tên sau khi chuẩn hóa tiếng Việt", async () => {
  const { matchSuggestedCategory } = await import("./gemini-image.service.js");
  const categories = [
    { id: "parent", name: "Thiết bị điện tử", parentId: null },
    { id: "phone", name: "Điện thoại", parentId: "parent" },
    { id: "headphone", name: "Tai nghe", parentId: "parent" }
  ];

  assert.deepEqual(
    matchSuggestedCategory("tai nghe", categories),
    categories[2]
  );
});

test("matchSuggestedCategory không ép danh mục khi Gemini trả về nhãn mơ hồ", async () => {
  const { matchSuggestedCategory } = await import("./gemini-image.service.js");
  const categories = [
    { id: "parent", name: "Đồ học tập", parentId: null },
    { id: "book", name: "Sách", parentId: "parent" },
    { id: "pen", name: "Bút", parentId: "parent" }
  ];

  assert.equal(matchSuggestedCategory("vật dụng cá nhân không rõ", categories), null);
});

test("analyzePostImages combines multiple views and maps a real leaf category", async () => {
  const [{ geminiImageService }, { postRepository }] = await Promise.all([
    import("./gemini-image.service.js"),
    import("../repositories/post.repository.js")
  ]);
  const originalCatalog = postRepository.getFormCatalog;
  const originalFetch = globalThis.fetch;
  let apiKeyHeader = "";
  let requestUrl = "";
  let requestPrompt = "";
  let inlineImageCount = 0;

  postRepository.getFormCatalog = async () => ({
    categories: [
      { id: "parent", name: "Thiết bị điện tử", parentId: null },
      { id: "headphone", name: "Tai nghe", parentId: "parent" }
    ],
    areas: [],
    buildings: [],
    handoverPoints: []
  });
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    apiKeyHeader = new Headers(init?.headers).get("x-goog-api-key") ?? "";
    const requestBody = JSON.parse(String(init?.body)) as {
      contents?: Array<{ parts?: Array<{ text?: string; inlineData?: unknown }> }>;
    };
    inlineImageCount = requestBody.contents?.[0]?.parts
      ?.filter((part) => part.inlineData).length ?? 0;
    requestPrompt = requestBody.contents?.[0]?.parts
      ?.map((part) => part.text ?? "")
      .join("\n") ?? "";
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              title: "Tai nghe không dây màu trắng",
              description: "Tai nghe không dây màu trắng, có hộp sạc và một vết xước nhỏ ở mặt trước.",
              categoryName: "Tai nghe",
              visualAttributes: ["màu trắng", "hộp sạc"],
              confidence: 0.88,
              warnings: ["Cần người dùng kiểm tra lại thương hiệu."]
            })
          }]
        }
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const file = {
      fieldname: "file",
      originalname: "item.png",
      encoding: "7bit",
      mimetype: "image/png",
      size: 8,
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    } as Express.Multer.File;
    const secondFile = { ...file, originalname: "item-side.png" } as Express.Multer.File;
    const result = await geminiImageService.analyzePostImages([file, secondFile], "FOUND");
    assert.equal(result.suggestedCategory?.id, "headphone");
    assert.equal(result.confidence, 0.88);
    assert.equal(result.imageCount, 2);
    assert.equal(inlineImageCount, 2);
    assert.equal(apiKeyHeader, "test-gemini-key");
    assert.match(requestUrl, /models\/gemini-[^/]+:generateContent$/);
    assert.match(requestPrompt, /hãng\/logo/);
    assert.match(requestPrompt, /dòng sản phẩm, model, phiên bản/);
    assert.match(requestPrompt, /ốp lưng, dây đeo, móc khóa/);
    assert.match(requestPrompt, /không công khai toàn bộ serial/);
    assert.match(requestPrompt, /Bạn nhận được 2 ảnh/);
  } finally {
    postRepository.getFormCatalog = originalCatalog;
    globalThis.fetch = originalFetch;
  }
});

test("analyzePostImages rejects more than five images before calling external services", async () => {
  const { geminiImageService } = await import("./gemini-image.service.js");
  const file = {
    fieldname: "files",
    originalname: "item.png",
    encoding: "7bit",
    mimetype: "image/png",
    size: 8,
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  } as Express.Multer.File;

  await assert.rejects(
    () => geminiImageService.analyzePostImages(Array.from({ length: 6 }, () => file), "LOST"),
    /tối đa 5 ảnh/
  );
});
