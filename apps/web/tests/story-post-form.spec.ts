import { expect, test, type Page } from "@playwright/test";

const session = {
  accessToken: "e2e-access-token",
  accessTokenExpiresIn: "15m",
  user: { id: "user-1", email: "student@example.com", fullName: "Sinh viên Demo", studentCode: "SE000000", phoneNumber: null, roles: ["USER", "STUDENT"], status: "ACTIVE", createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z" }
};

const catalog = {
  categories: [
    { id: "99999999-9999-4999-8999-999999999999", name: "Túi ví & phụ kiện", parentId: null },
    { id: "11111111-1111-4111-8111-111111111111", name: "Ví / bóp", parentId: "99999999-9999-4999-8999-999999999999" }
  ],
  areas: [{ id: "22222222-2222-4222-8222-222222222222", name: "Tòa" }],
  buildings: [{ id: "33333333-3333-4333-8333-333333333333", areaId: "22222222-2222-4222-8222-222222222222", name: "Tòa Alpha" }],
  handoverPoints: [{ id: "44444444-4444-4444-8444-444444444444", name: "Quầy Alpha", address: "Sảnh Alpha", openingHours: "08:00 - 17:30" }]
};

const sourcePost = {
  id: "post-1",
  type: "LOST",
  status: "OPEN",
  visibilityMode: "PUBLIC",
  title: "Ví da màu đen",
  description: "Ví da màu đen có một vết xước nhỏ ở cạnh.",
  category: { id: catalog.categories[1].id, name: catalog.categories[1].name, icon: null },
  location: { area: catalog.areas[0], building: catalog.buildings[0], roomText: "Sảnh", customLocation: null },
  handoverPoint: null,
  lostFoundAt: "2026-08-20T08:00:00.000Z",
  owner: { id: session.user.id, fullName: session.user.fullName },
  media: [],
  canEdit: true,
  createdAt: "2026-08-20T08:05:00.000Z"
};

const foundCandidate = {
  id: "found-1",
  type: "FOUND",
  status: "OPEN",
  visibilityMode: "PUBLIC",
  title: "Ví da được nhặt tại Beta",
  description: "Ví da màu đen có khóa kim loại.",
  category: { id: catalog.categories[1].id, name: catalog.categories[1].name, icon: null },
  location: { area: catalog.areas[0], building: null, roomText: "Sảnh", customLocation: null },
  handoverPoint: null,
  lostFoundAt: "2026-08-20T09:00:00.000Z",
  owner: { id: "finder-1", fullName: "Người nhặt" },
  media: [],
  canEdit: false,
  createdAt: "2026-08-20T09:05:00.000Z"
};

function matchResponse(withCandidate = false) {
  return {
    source: sourcePost,
    matcherVersion: "rule-v2-explainable",
    calculatedAt: "2026-08-20T09:10:00.000Z",
    thresholds: { weak: 0.45, suggestion: 0.6, notification: 0.75, highConfidence: 0.85 },
    weights: { text: 0.3, category: 0.2, location: 0.15, time: 0.1, image: 0.15, ocr: 0.1 },
    results: withCandidate ? [{
      matchId: "match-1",
      candidate: foundCandidate,
      totalScore: 0.82,
      scoreTier: "NOTIFY",
      scores: { text: 0.78, category: 1, location: 0.45, time: 1, image: 0.72, ocr: 0.5 },
      explanation: {
        tier: "NOTIFY",
        summary: "Hai bài có mức tương đồng 82%. Đây là gợi ý hỗ trợ, không phải kết luận quyền sở hữu.",
        reasons: ["Mô tả 78%", "Danh mục 100%"],
        matchedTokens: ["vi", "den"],
        matchedImageTags: ["da", "khoa"],
        matchedOcrTokens: ["brand"],
        locationReason: "Cùng khu vực campus",
        categoryReason: "Trùng danh mục cụ thể",
        daysDiff: 0.04,
        penalties: []
      },
      matcherVersion: "rule-v2-explainable",
      calculatedAt: "2026-08-20T09:10:00.000Z"
    }] : []
  };
}

async function prepare(page: Page, onCreate: (payload: Record<string, unknown>) => void, withCandidate = false) {
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) }));
  await page.route("**/api/posts/catalog", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(catalog) }));
  await page.route(/\/api\/posts(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "POST") {
      onCreate(route.request().postDataJSON());
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "post-1", type: "LOST", title: "Ví da màu đen", status: "OPEN", createdAt: new Date().toISOString() }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 0, page: 1, pageSize: 6, items: [] }) });
  });
  await page.route("**/api/posts/post-1/media", (route) => route.fulfill({ status: 201, contentType: "application/json", body: "{}" }));
  await page.route(/\/api\/posts\/post-1\/matches(?:\/recalculate)?$/, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(matchResponse(withCandidate))
  }));
  await page.route("**/api/posts/mine**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 0, page: 1, pageSize: 9, items: [] }) }));
  await page.goto("/home");
  await page.locator("#quick-story").scrollIntoViewIfNeeded();
  await expect(page.getByText("Báo mất vật phẩm")).toBeVisible();
}

async function fillCommonForm(page: Page) {
  const form = page.locator(".story-post-form");
  await form.getByLabel("Tên vật phẩm").fill("Ví da màu đen");
  await form.getByLabel("Nhóm chính", { exact: true }).selectOption(catalog.categories[0].id);
  await form.getByLabel("Danh mục cụ thể", { exact: true }).selectOption(catalog.categories[1].id);
  await form.getByLabel("Khu vực").selectOption(catalog.areas[0].id);
  await form.getByLabel("Tòa nhà / địa điểm").selectOption(catalog.buildings[0].id);
  await form.getByLabel("Mô tả nhận dạng").fill("Ví da màu đen có một vết xước nhỏ ở cạnh.");
}

test("creates a LOST post inside the storytelling flow", async ({ page }) => {
  let payload: Record<string, unknown> = {};
  await prepare(page, (value) => { payload = value; });
  await fillCommonForm(page);
  await page.getByRole("button", { name: "Đăng bài LOST" }).click();
  await expect(page.getByText("Đã đưa vào hành trình")).toBeVisible();
  expect(payload.type).toBe("LOST");
  expect(payload.categoryId).toBe(catalog.categories[1].id);
  expect(payload.areaId).toBe(catalog.areas[0].id);
  expect(payload.handoverPointId).toBeNull();
  expect(payload.visibilityMode).toBe("PUBLIC");
});

test("creates a private FOUND post with a handover point", async ({ page }) => {
  let payload: Record<string, unknown> = {};
  await prepare(page, (value) => { payload = value; });
  await page.locator("#two-sides").scrollIntoViewIfNeeded();
  await page.locator("#two-sides").getByRole("button", { name: /Tôi nhặt được đồ/i }).click();
  await page.locator("#quick-story").scrollIntoViewIfNeeded();
  await expect(page.getByText("Báo nhặt được vật phẩm")).toBeVisible();
  await fillCommonForm(page);
  await page.getByLabel("Điểm bàn giao (nếu đã gửi)").selectOption(catalog.handoverPoints[0].id);
  await page.getByText("Giữ chi tiết nhạy cảm ở chế độ riêng tư").click();
  await page.getByRole("button", { name: "Đăng bài FOUND" }).click();
  await expect(page.getByText("Đã đưa vào hành trình")).toBeVisible();
  expect(payload.type).toBe("FOUND");
  expect(payload.handoverPointId).toBe(catalog.handoverPoints[0].id);
  expect(payload.visibilityMode).toBe("PRIVATE_DETAILS");
});

test("opens the persisted matching analysis after a no-match scan", async ({ page }) => {
  await prepare(page, () => undefined);
  await fillCommonForm(page);
  await page.locator(".story-post-form button[type=submit]").click();

  await expect(page).toHaveURL(/\/posts\/post-1\/matches$/, { timeout: 6_000 });
  await expect(page.getByRole("heading", { name: /So sánh bài/i })).toBeVisible();
  await expect(page.getByText("Chưa có bài đối ứng vượt ngưỡng 45%")).toBeVisible();
});

test("opens My Posts from the top navigation after matching", async ({ page }) => {
  await prepare(page, () => undefined);
  await fillCommonForm(page);
  await page.locator(".story-post-form button[type=submit]").click();

  await expect(page).toHaveURL(/\/posts\/post-1\/matches$/, { timeout: 6_000 });
  await page.locator(".topbar").getByRole("link", { name: "Bài của tôi" }).click();
  await expect(page).toHaveURL(/\/my-posts$/);
  await expect(page.getByRole("tab", { name: "Bài đăng của tôi" })).toHaveAttribute("aria-selected", "true");
});

test("analyzes an image, fills an editable draft, posts it and shows real category candidates", async ({ page }) => {
  let payload: Record<string, unknown> = {};
  let analysisImageParts = 0;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepare(page, (value) => { payload = value; }, true);
  await page.route("**/api/posts/analyze-image", async (route) => {
    const multipartBody = route.request().postDataBuffer()?.toString("utf8") ?? "";
    analysisImageParts = multipartBody.match(/name="files"/g)?.length ?? 0;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        title: "Ví da màu đen",
        description: "Ví da màu đen có khóa kim loại và một vết xước nhỏ ở cạnh.",
        suggestedCategory: catalog.categories[1],
        visualAttributes: ["màu đen", "chất liệu da", "khóa kim loại"],
        visibleText: ["BRAND"],
        confidence: 0.87,
        warnings: ["Cần người dùng xác nhận thương hiệu."],
        imageCount: 2
      })
    });
  });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await page.locator(".story-image-drop input[type=file]").setInputFiles([
    { name: "wallet-front.png", mimeType: "image/png", buffer: png },
    { name: "wallet-back.png", mimeType: "image/png", buffer: png }
  ]);
  await expect(page.locator(".story-image-thumb")).toHaveCount(2);
  await page.getByRole("button", { name: "Phân tích 2 ảnh" }).click();
  await page.locator("#system-analysis").scrollIntoViewIfNeeded();
  await expect(page.locator(".workflow-image-scanner.is-scanning")).toBeVisible();
  await expect(page.locator(".workflow-image-scanner__filmstrip > span")).toHaveCount(2);
  const scanBeam = page.locator(".workflow-image-scanner__beam");
  await expect(scanBeam).toHaveCSS("animation-name", "workflow-image-scan");
  const initialBeamTop = await scanBeam.evaluate((element) => element.getBoundingClientRect().top);
  await page.waitForTimeout(400);
  const movedBeamTop = await scanBeam.evaluate((element) => element.getBoundingClientRect().top);
  expect(Math.abs(movedBeamTop - initialBeamTop)).toBeGreaterThan(8);
  await page.screenshot({ path: "../../test-results/home/story-image-analysis.png" });
  const form = page.locator(".story-post-form");
  await expect(form.getByLabel("Tên vật phẩm")).toHaveValue("Ví da màu đen");
  await expect(form.getByLabel("Danh mục cụ thể", { exact: true })).toHaveValue(catalog.categories[1].id);
  await form.getByLabel("Tên vật phẩm").fill("Ví da màu đen của tôi");
  await form.getByLabel("Khu vực").selectOption(catalog.areas[0].id);
  await page.getByRole("button", { name: "Đăng bài LOST" }).click();
  await expect(page).toHaveURL(/\/posts\/post-1\/matches$/, { timeout: 6_000 });
  await expect(page.getByRole("heading", { name: "Ví da được nhặt tại Beta" })).toBeVisible();
  await expect(page.getByText("82%").first()).toBeVisible();
  await expect(page.getByText("Mô tả").first()).toBeVisible();
  await expect(page.getByText("OCR / chữ")).toBeVisible();
  await page.screenshot({ path: "../../test-results/home/persisted-match-analysis.png", fullPage: true });
  expect(payload.title).toBe("Ví da màu đen của tôi");
  expect(payload.categoryId).toBe(catalog.categories[1].id);
  expect((payload.analysisSignals as { visibleText: string[] }).visibleText).toEqual(["BRAND"]);
  expect(analysisImageParts).toBe(2);
});
