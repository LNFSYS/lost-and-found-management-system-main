import { expect, test, type Page } from "@playwright/test";

const session = {
  accessToken: "e2e-access-token",
  accessTokenExpiresIn: "15m",
  user: { id: "user-1", email: "student@example.com", fullName: "Sinh viên Demo", studentCode: "SE000000", phoneNumber: null, roles: ["USER", "STUDENT"], status: "ACTIVE", createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z" }
};

const catalog = {
  categories: [
    { id: "99999999-9999-4999-8999-999999999999", name: "Túi ví & phụ kiện", parentId: null },
    { id: "11111111-1111-4111-8111-111111111111", name: "Ví / bóp", parentId: "99999999-9999-4999-8999-999999999999" },
    { id: "55555555-5555-4555-8555-555555555555", name: "Balo", parentId: "99999999-9999-4999-8999-999999999999" },
    { id: "66666666-6666-4666-8666-666666666666", name: "Thiết bị điện tử", parentId: null },
    { id: "77777777-7777-4777-8777-777777777777", name: "Điện thoại", parentId: "66666666-6666-4666-8666-666666666666" }
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
      calculatedAt: "2026-08-20T09:10:00.000Z",
      feedback: null
    }] : []
    , total: withCandidate ? 1 : 0, page: 1, pageSize: 20, hasMore: false
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
  await page.route(/\/api\/posts\/post-1\/matches(?:\/recalculate)?(?:\?.*)?$/, (route) => route.fulfill({
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

for (const provider of ["Qwen", "DeepSeek"]) {
test(`${provider} phone draft autofills title description and both category dropdowns`, async ({ page }) => {
  await prepare(page, () => undefined);
  await page.route("**/api/posts/analyze-image", route => route.fulfill({ json: {
    title: "Điện thoại màu đỏ", description: "Điện thoại màu đỏ có màn hình đen.",
    suggestedCategory: catalog.categories[4], visualAttributes: ["đỏ", "màn hình đen"], visibleText: [],
    confidence: null, warnings: [], assistedBy: "Qwen image understanding (local)", model: "Qwen", imageCount: 1
  } }));
  const form = page.locator(".story-post-form");
  await form.locator('input[type=file]').setInputFiles("tests/fixtures/appointment-item.png");
  await form.getByRole("button", { name: `Phân tích bằng ${provider}` }).click();
  await expect(form.getByLabel("Tên vật phẩm")).toHaveValue("Điện thoại màu đỏ");
  await expect(form.getByLabel("Mô tả nhận dạng")).toHaveValue("Điện thoại màu đỏ có màn hình đen.");
  await expect(form.getByLabel("Nhóm chính", { exact: true })).toHaveValue(catalog.categories[3].id);
  await expect(form.getByLabel("Danh mục cụ thể", { exact: true })).toHaveValue(catalog.categories[4].id);
});
}

test("switching providers replaces AI category but preserves a manual category", async ({ page }) => {
  await prepare(page, () => undefined);
  const calls: string[] = [];
  await page.route("**/api/posts/analyze-image", route => {
    const provider = route.request().postData()?.match(/name="provider"\r?\n\r?\n(gemini|qwen|deepseek)/)?.[1] ?? "missing";
    calls.push(provider);
    return route.fulfill({ json: {
      title: `Vật phẩm ${provider}`, description: `Mô tả riêng của ${provider}.`,
      suggestedCategory: provider === "gemini" ? catalog.categories[4] : null,
      visualAttributes: [provider], visibleText: [], confidence: null, warnings: [], assistedBy: provider, model: provider, imageCount: 1
    } });
  });
  const form = page.locator(".story-post-form");
  await form.locator('input[type=file]').setInputFiles("tests/fixtures/appointment-item.png");
  await form.getByRole("button", { name: "Phân tích bằng Gemini" }).click();
  await expect(form.getByLabel("Danh mục cụ thể", { exact: true })).toHaveValue(catalog.categories[4].id);
  await form.getByRole("button", { name: "Phân tích bằng Qwen" }).click();
  await expect(form.getByLabel("Tên vật phẩm")).toHaveValue("Vật phẩm qwen");
  await expect(form.getByLabel("Nhóm chính", { exact: true })).toHaveValue("");
  await expect(form.getByLabel("Danh mục cụ thể", { exact: true })).toHaveValue("");
  await form.getByLabel("Nhóm chính", { exact: true }).selectOption(catalog.categories[0].id);
  await form.getByLabel("Danh mục cụ thể", { exact: true }).selectOption(catalog.categories[2].id);
  await form.getByRole("button", { name: "Phân tích bằng DeepSeek" }).click();
  await expect(form.getByLabel("Tên vật phẩm")).toHaveValue("Vật phẩm deepseek");
  await expect(form.getByLabel("Mô tả nhận dạng")).toHaveValue("Mô tả riêng của deepseek.");
  await expect(form.getByLabel("Danh mục cụ thể", { exact: true })).toHaveValue(catalog.categories[2].id);
  expect(calls).toEqual(["gemini", "qwen", "deepseek"]);
});

test("pending provider locks all analysis buttons against repeated clicks", async ({ page }) => {
  await prepare(page, () => undefined);
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/posts/analyze-image", async route => {
    calls++;
    await pending;
    await route.fulfill({ status: 503, json: { message: "DeepSeek tạm bận" } });
  });
  const form = page.locator(".story-post-form");
  await form.locator('input[type=file]').setInputFiles("tests/fixtures/appointment-item.png");
  await form.getByRole("button", { name: "Phân tích bằng DeepSeek" }).click();
  await expect.poll(() => calls).toBe(1);
  for (const button of await form.locator(".story-image-analysis-actions button").all()) await expect(button).toBeDisabled();
  release();
  await expect(form.getByRole("button", { name: "Phân tích bằng DeepSeek" })).toBeEnabled();
  expect(calls).toBe(1);
});

for (const status of [200, 503]) for (const width of [1440, 390]) test(`analysis completion ${status} smoothly returns to the form at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await prepare(page, () => undefined);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/posts/analyze-image", async route => {
    await pending;
    await route.fulfill({ status, json: status === 200 ? { title: "Ví đen", description: "Ví màu đen.", suggestedCategory: null,
      visualAttributes: [], visibleText: [], confidence: null, warnings: [], imageCount: 1 } : { message: "Phân tích thất bại, vui lòng thử lại." } });
  });
  await page.locator('.story-post-form input[type=file]').setInputFiles("tests/fixtures/appointment-item.png");
  await page.getByRole("button", { name: "Phân tích bằng Gemini" }).click();
  await expect(page.locator("#system-analysis .is-scanning")).toBeInViewport();
  release();
  if (status === 200) await expect(page.getByLabel("Tên vật phẩm")).toHaveValue("Ví đen");
  else await expect(page.locator(".story-post-form").getByText("Phân tích thất bại, vui lòng thử lại.", { exact: true })).toBeVisible();
  await expect.poll(() => page.locator(".story-post-form__head").evaluate(element =>
    Math.abs(element.getBoundingClientRect().top - (document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0) - 16)
  )).toBeLessThan(3);
});

for (const status of [200, 503]) {
  test(`ending analysis session returns to form and ignores late ${status} response`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await prepare(page, () => undefined);
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/posts/analyze-image", async route => {
      await pending;
      await route.fulfill({ status, json: status === 200 ? {
        title: "Late draft", description: "Late result", suggestedCategory: null,
        visualAttributes: [], visibleText: [], confidence: null, warnings: [], imageCount: 1
      } : { message: "Late provider failure" } });
    });
    await page.locator('.story-post-form input[type=file]').setInputFiles("tests/fixtures/appointment-item.png");
    await page.getByRole("button", { name: "Phân tích bằng Qwen" }).click();
    await expect(page.locator("#system-analysis .is-scanning")).toBeVisible();
    await page.locator("#system-analysis").getByRole("button", { name: "Kết thúc phiên", exact: true }).click();
    await expect(page.locator("#system-analysis .workflow-analysis-layout")).toHaveCount(0);
    await expect.poll(() => page.locator(".story-post-form__head").evaluate(element =>
      Math.abs(element.getBoundingClientRect().top - (document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0) - 16)
    )).toBeLessThan(3);
    await page.evaluate(() => {
      const original = window.scrollTo.bind(window);
      (window as unknown as { resetScrollCalls: number }).resetScrollCalls = 0;
      window.scrollTo = (...args: [ScrollToOptions]) => {
        (window as unknown as { resetScrollCalls: number }).resetScrollCalls++;
        original(...args);
      };
    });
    release();
    // Covers the former 650 ms completion scroll timer, not just immediate state.
    await page.waitForTimeout(850);
    await expect(page.locator("#system-analysis .workflow-analysis-layout")).toHaveCount(0);
    await expect(page.locator('.story-post-form').getByLabel("Tên vật phẩm")).toHaveValue("");
    expect(await page.evaluate(() => (window as unknown as { resetScrollCalls: number }).resetScrollCalls)).toBe(0);
  });
}

for (const width of [390, 768, 1024, 1440]) {
  test(`analysis buttons stay inside their panel at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await prepare(page, () => undefined);
    const panel = page.locator(".story-image-analysis-actions");
    await expect(panel.locator("button")).toHaveCount(3);
    expect(await panel.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return [...element.querySelectorAll("button")].every(button => {
        const bounds = button.getBoundingClientRect();
        return bounds.left >= rect.left + parseFloat(style.paddingLeft) - 1
          && bounds.right <= rect.right - parseFloat(style.paddingRight) + 1
          && button.scrollWidth <= button.clientWidth;
      });
    })).toBe(true);
  });
}

for (const width of [390, 1440]) {
  test(`provider buttons send independent choices and recover from Qwen failure at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await prepare(page, () => undefined);
    const calls: string[] = [];
    await page.route("**/api/posts/analyze-image", route => {
      const body = route.request().postData() ?? "";
      const provider = body.match(/name="provider"\r?\n\r?\n(gemini|qwen|deepseek)/)?.[1];
      calls.push(provider ?? "missing");
      if (provider === "qwen") return route.fulfill({ status: 503, json: { message: "Qwen chưa sẵn sàng" } });
      return route.fulfill({ json: { title: "Balo từ Gemini", description: "Balo màu xanh đậm.",
        suggestedCategory: catalog.categories[2], visualAttributes: [], visibleText: [], confidence: 0.8,
        warnings: [], assistedBy: "Gemini image understanding", model: "gemini-test", imageCount: 1 } });
    });
    const form = page.locator(".story-post-form");
    const gemini = form.getByRole("button", { name: "Phân tích bằng Gemini" });
    const qwen = form.getByRole("button", { name: "Phân tích bằng Qwen" });
    await expect(gemini).toBeDisabled();
    await expect(qwen).toBeDisabled();
    await form.locator('input[type=file]').setInputFiles("tests/fixtures/appointment-item.png");
    await gemini.click();
    await expect(form.getByLabel("Tên vật phẩm")).toHaveValue("Balo từ Gemini");
    await qwen.click();
    await expect(gemini).toBeEnabled();
    await gemini.click();
    await expect.poll(() => calls).toEqual(["gemini", "qwen", "gemini"]);
    await expect(form.getByLabel("Tên vật phẩm")).toHaveValue("Balo từ Gemini");
    await form.getByRole("button", { name: "Phân tích bằng DeepSeek" }).click();
    await expect.poll(() => calls).toEqual(["gemini", "qwen", "gemini", "deepseek"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const type of ["LOST", "FOUND"] as const) {
  for (const resolved of [true, false]) {
    test(`Qwen ${type} draft preserves unknown confidence and editable ${resolved ? "resolved" : "unresolved"} category`, async ({ page }) => {
      let payload: Record<string, unknown> = {};
      await prepare(page, value => { payload = value; });
      if (type === "FOUND") await page.locator("#two-sides").getByRole("button", { name: /Tôi nhặt được đồ/i }).click();
      const description = "Balo xanh đậm có ba sọc trắng, quai đen và túi khóa kéo phía trước.";
      await page.route("**/api/posts/analyze-image", route => route.fulfill({ json: {
        title: "Balo xanh đậm", description, suggestedCategory: resolved ? catalog.categories[2] : null,
        visualAttributes: ["xanh đậm", "đen", "trắng", "quai đen"], visibleText: [],
        confidence: null, confidence_source: "unavailable", warnings: [],
        model: "Qwen3-VL-2B-Instruct (local)", assistedBy: "Qwen image understanding (local)", imageCount: 1
      } }));
      const form = page.locator(".story-post-form");
      // Synthetic fixture exercises upload; the backpack model result above is mocked.
      await form.locator('input[type=file]').setInputFiles("tests/fixtures/appointment-item.png");
      await form.getByRole("button", { name: "Phân tích bằng Qwen" }).click();
      await expect(form.getByLabel("Tên vật phẩm")).toHaveValue("Balo xanh đậm");
      await expect(form.getByLabel("Mô tả nhận dạng")).toHaveValue(description);
      await expect(form.getByText(/Chưa có điểm tin cậy/)).toBeVisible();
      await expect(form.getByText(/độ tin cậy 0%/)).toHaveCount(0);
      await expect(form.getByText("xanh đậm", { exact: true })).toBeVisible();
      await expect(form.getByLabel("Nhóm chính", { exact: true })).toHaveValue(resolved ? catalog.categories[0].id : "");
      await expect(form.getByLabel("Danh mục cụ thể", { exact: true })).toHaveValue(resolved ? catalog.categories[2].id : "");
      await form.getByLabel("Nhóm chính", { exact: true }).selectOption(catalog.categories[0].id);
      await form.getByLabel("Danh mục cụ thể", { exact: true }).selectOption(catalog.categories[2].id);
      await form.getByLabel("Mô tả nhận dạng").fill(`${description} Thông tin do người dùng bổ sung.`);
      await form.getByLabel("Khu vực").selectOption(catalog.areas[0].id);
      await form.getByRole("button", { name: `Đăng bài ${type}` }).click();
      await expect.poll(() => payload.type).toBe(type);
      expect(payload.categoryId).toBe(catalog.categories[2].id);
      expect(payload.description).toContain("Thông tin do người dùng bổ sung.");
      // Existing DB tags require numeric confidence; unknown scores must not become 0.
      expect(payload.analysisSignals).toBeUndefined();
    });
  }
}

for (const type of ["LOST", "FOUND"] as const) {
  for (const width of [1440, 390]) {
    for (const reducedMotion of ["reduce", "no-preference"] as const) {
      test(`keeps the ${type} form below navigation after ${reducedMotion} motion selection at ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion });
        await prepare(page, () => undefined);
        await page.evaluate(() => document.fonts.ready);
        await page.locator("#two-sides").getByRole("button", {
          name: type === "LOST" ? /Tôi làm mất đồ/i : /Tôi nhặt được đồ/i
        }).click();
        const form = page.locator(".story-post-form");
        await expect(form.getByText(type === "LOST" ? "Báo mất vật phẩm" : "Báo nhặt được vật phẩm")).toBeVisible();
        // Observe consecutive frames without overriding the application's scroll position.
        await expect.poll(() => form.locator(".story-post-form__head").evaluate(async (element) => {
          const offsets: number[] = [];
          for (let frame = 0; frame < 6; frame += 1) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            offsets.push(element.getBoundingClientRect().top - document.querySelector(".topbar")!.getBoundingClientRect().bottom);
          }
          const movement = Math.max(...offsets) - Math.min(...offsets);
          return movement <= 1 ? Math.min(...offsets) : -1;
        })).toBeGreaterThan(0);
        await expect(form.locator(".story-image-drop")).toBeInViewport({ ratio: 1 });
        await expect(form.getByRole("button", { name: "Phân tích bằng Gemini" })).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: testInfo.outputPath("selected-form.png") });
      });
    }
  }
}

test("does not apply a pending font-layout scroll after leaving the story", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepare(page, () => undefined);
  await page.evaluate(() => {
    const probe = { requested: false, scrolls: 0, release: () => undefined as void };
    const ready = new Promise<void>((resolve) => { probe.release = resolve; });
    Object.defineProperty(document.fonts, "ready", { configurable: true, get: () => { probe.requested = true; return ready; } });
    const originalScrollTo = window.scrollTo.bind(window);
    window.scrollTo = (optionsOrX?: ScrollToOptions | number, y?: number) => {
      probe.scrolls += 1;
      if (typeof optionsOrX === "number") originalScrollTo(optionsOrX, y ?? 0);
      else originalScrollTo(optionsOrX);
    };
    Object.assign(window, { storyFontProbe: probe });
  });
  await page.locator("#two-sides").getByRole("button", { name: /Tôi nhặt được đồ/i }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { storyFontProbe: { requested: boolean } }).storyFontProbe.requested)).toBe(true);
  await page.getByRole("link", { name: "Bài đăng", exact: true }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("heading", { name: "Bài đăng", exact: true })).toBeVisible();
  const before = await page.evaluate(() => (window as unknown as { storyFontProbe: { scrolls: number } }).storyFontProbe.scrolls);
  await page.evaluate(async () => {
    (window as unknown as { storyFontProbe: { release: () => void } }).storyFontProbe.release();
    for (let frame = 0; frame < 6; frame += 1) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  expect(await page.evaluate(() => (window as unknown as { storyFontProbe: { scrolls: number } }).storyFontProbe.scrolls)).toBe(before);
});

for (const type of ["LOST", "FOUND"] as const) {
  for (const width of [1440, 390]) {
    test(`shows image upload and analysis before manual ${type} fields at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await prepare(page, () => undefined);
      await page.evaluate(() => document.fonts.ready);
      if (type === "FOUND") {
        await page.locator("#two-sides").getByRole("button", { name: /Tôi nhặt được đồ/i }).click();
        await expect(page.getByText("Báo nhặt được vật phẩm")).toBeVisible();
      }

      const form = page.locator(".story-post-form");
      await form.locator(".story-post-form__head").evaluate((element) => {
        const navigation = document.querySelector(".topbar")!;
        window.scrollBy({ top: element.getBoundingClientRect().top - navigation.getBoundingClientRect().bottom - 16, behavior: "instant" });
      });
      const upload = form.locator(".story-image-drop");
      const analyze = form.getByRole("button", { name: "Phân tích bằng Gemini" });
      await expect(upload).toBeInViewport({ ratio: 1 });
      await expect(analyze).toBeInViewport({ ratio: 1 });
      if (width > 700) {
        expect(await form.evaluate((element) => {
          const uploadRect = element.querySelector(".story-image-drop")!.getBoundingClientRect();
          const actionsRect = element.querySelector(".story-image-analysis-actions")!.getBoundingClientRect();
          return Math.abs(uploadRect.top - actionsRect.top) < 1 && Math.abs(uploadRect.bottom - actionsRect.bottom) < 1;
        })).toBe(true);
      }
      await expect(form.locator(".story-image-analysis-actions p")).toContainText("Chọn Gemini, Qwen hoặc DeepSeek");
      const analysisHint = form.locator(".story-image-analysis-hint");
      await expect(analysisHint).toBeInViewport({ ratio: 1 });
      await expect(analysisHint).toHaveText("Chọn một trong các nút để tự động điền thông tin từ ảnh.");
      expect(await form.evaluate((element) => {
        const uploadRect = element.querySelector(".story-image-drop")!.getBoundingClientRect();
        const actionsRect = element.querySelector(".story-image-analysis-actions")!.getBoundingClientRect();
        const hintRect = element.querySelector(".story-image-analysis-hint")!.getBoundingClientRect();
        const gap = hintRect.top - Math.max(uploadRect.bottom, actionsRect.bottom);
        return Math.abs(hintRect.left - uploadRect.left) < 1 && gap >= 0 && gap <= 24;
      })).toBe(true);
      const analysisNote = form.locator(".story-image-analysis-note");
      await expect(analysisNote).toBeInViewport({ ratio: 1 });
      await expect(analysisNote).toContainText("Thông tin điền sẵn từ ảnh chỉ mang tính tham khảo, không đảm bảo chính xác 100%");
      await expect(analysisNote).toContainText("Vui lòng kiểm tra kỹ và chỉnh sửa trước khi đăng");
      expect(await upload.evaluate((element) => element.getBoundingClientRect().top > document.querySelector(".topbar")!.getBoundingClientRect().bottom)).toBe(true);
      await expect(analyze).toBeDisabled();
      await expect(form.getByLabel("Tên vật phẩm")).toHaveValue("");
      expect(await form.evaluate((element) => {
        const assistance = element.querySelector(".story-image-assistance")!;
        const fields = element.querySelector(".story-form-fields")!;
        return Boolean(assistance.compareDocumentPosition(fields) & Node.DOCUMENT_POSITION_FOLLOWING)
          && assistance.getBoundingClientRect().bottom < fields.getBoundingClientRect().top;
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("image-first-form.png") });

      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
      await upload.locator("input[type=file]").setInputFiles({ name: "item.png", mimeType: "image/png", buffer: png });
      await expect(form.locator(".story-image-thumb")).toHaveCount(1);
      await expect.poll(() => form.locator(".story-image-thumb img").evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
      await expect(form.getByRole("button", { name: "Phân tích bằng Gemini" })).toBeEnabled();
      await expect(form.getByLabel("Tên vật phẩm")).toHaveValue("");
      await form.getByRole("button", { name: "Xóa ảnh 1" }).click();
      await expect(form.locator(".story-image-thumb")).toHaveCount(0);
      await expect(analyze).toBeDisabled();
    });
  }
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

for (const type of ["LOST", "FOUND"] as const) {
  for (const width of [1440, 390]) {
    test(`shows a one-time no-match popup after creating ${type} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await prepare(page, () => undefined);
      await page.route(/\/api\/posts\/post-1\/matches(?:\?.*)?$/, route => route.fulfill({
        status: 200, contentType: "application/json", body: JSON.stringify({ ...matchResponse(), source: { ...sourcePost, type } })
      }));
      await page.route("**/api/staff/custody-requests/mine/post/post-1", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) }));
      if (type === "FOUND") await page.locator("#two-sides").getByRole("button", { name: /Tôi nhặt được đồ/i }).click();
      await fillCommonForm(page);
      await page.locator(".story-post-form button[type=submit]").click();

      await expect(page).toHaveURL(/\/posts\/post-1\/matches$/, { timeout: 6_000 });
      const dialog = page.getByRole("dialog", { name: "Chưa có gợi ý phù hợp" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("chúng tôi sẽ thông báo đến email của bạn theo cài đặt thông báo");
      await expect(dialog).toContainText("Bài đã đóng sẽ không nhận thông báo matching mới");
      const close = dialog.getByRole("button", { name: "Đóng thông báo" });
      const understood = dialog.getByRole("button", { name: "Đã hiểu" });
      await expect(close).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(understood).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      await expect(dialog.getByRole("link", { name: "Xem bài đăng cộng đồng" })).toBeInViewport({ ratio: 1 });
      expect(await dialog.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
          && element.scrollWidth <= element.clientWidth;
      })).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("no-matches-popup.png") });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(page.locator(".matches-empty h2")).toBeFocused();
      await page.getByRole("button", { name: "Tính lại matching" }).click();
      await expect(page.getByRole("button", { name: "Tính lại matching" })).toBeEnabled();
      await expect(dialog).toHaveCount(0);
      await page.reload();
      await expect(page.locator(".matches-empty")).toBeVisible();
      await expect(dialog).toHaveCount(0);
    });
  }
}

test("opens community posts from the no-match popup", async ({ page }) => {
  await prepare(page, () => undefined);
  await fillCommonForm(page);
  await page.locator(".story-post-form button[type=submit]").click();
  const dialog = page.getByRole("dialog", { name: "Chưa có gợi ý phù hợp" });
  await dialog.getByRole("link", { name: "Xem bài đăng cộng đồng" }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await expect(dialog).toHaveCount(0);
  await page.goBack();
  await expect(page.locator(".matches-empty")).toBeVisible();
  await expect(dialog).toHaveCount(0);
});

test("does not show a no-match popup when creation has a candidate", async ({ page }) => {
  await prepare(page, () => undefined, true);
  await fillCommonForm(page);
  await page.locator(".story-post-form button[type=submit]").click();
  await expect(page.locator(".match-analysis-card")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("weak-only results still show the no-suitable-match popup without hiding saved candidates", async ({ page }) => {
  await prepare(page, () => undefined, true);
  const response = matchResponse(true);
  await page.route(/\/api\/posts\/post-1\/matches(?:\?.*)?$/, route => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ ...response, results: [{ ...response.results[0], totalScore: 0.59, scoreTier: "WEAK" }] }) }));
  await fillCommonForm(page);
  await page.locator(".story-post-form button[type=submit]").click();
  const dialog = page.getByRole("dialog", { name: "Chưa có gợi ý phù hợp" });
  await dialog.getByRole("button", { name: "Đã hiểu" }).click();
  await expect(page.locator(".match-analysis-card")).toBeVisible();
  await expect(page.getByRole("heading", { name: /So sánh bài/ })).toBeFocused();
});

test("opens owned matching results from a new-match notification", async ({ page }) => {
  await prepare(page, () => undefined, true);
  await page.route(/\/api\/notifications(?:\?.*)?$/, route => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ items: [{ id: "match-notification", type: "MATCH_FOUND", title: "Có gợi ý phù hợp mới cho bài đăng của bạn",
      body: "Mở kết quả matching để kiểm tra.", entityType: "POST_MATCH", entityId: "post-1", isRead: false, readAt: null, createdAt: "2026-10-07T08:00:00.000Z" }] }) }));
  await page.route("**/api/notifications/match-notification/read", route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto("/notifications");
  await page.getByRole("button", { name: /Có gợi ý phù hợp mới cho bài đăng của bạn/ }).click();
  await expect(page).toHaveURL(/\/posts\/post-1\/matches$/);
  await expect(page.locator(".match-analysis-card")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("does not show a no-match popup for existing posts or failed matching reads", async ({ page }) => {
  await prepare(page, () => undefined);
  await page.goto("/posts/post-1/matches");
  await expect(page.locator(".matches-empty")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let reads = 0;
  await page.route(/\/api\/posts\/post-1\/matches(?:\?.*)?$/, route => {
    reads += 1;
    return route.fulfill({ status: reads === 1 ? 200 : 503, contentType: "application/json",
      body: JSON.stringify(reads === 1 ? matchResponse() : { error: { code: "unavailable", message: "Không đọc được matching" } }) });
  });
  await page.goto("/home");
  await fillCommonForm(page);
  await page.locator(".story-post-form button[type=submit]").click();
  await expect(page.getByRole("heading", { name: "Không mở được kết quả matching" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("hides the viewer's own LOST match but keeps inactive matching posts visible", async ({ page }) => {
  await prepare(page, () => undefined);
  const response = matchResponse(true);
  const baseMatch = response.results[0];
  const ownLostPost = { ...foundCandidate, id: "own-lost", type: "LOST", title: "Bài LOST của tôi", canEdit: true };
  const closedLostPost = { ...foundCandidate, id: "closed-lost", type: "LOST", status: "CLOSED", title: "Bài LOST đã đóng", canEdit: false };
  await page.route(/\/api\/posts\/post-1\/matches(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ...response,
      total: 2,
      source: { ...sourcePost, type: "FOUND" },
      results: [
        { ...baseMatch, matchId: "match-own", candidate: ownLostPost },
        { ...baseMatch, matchId: "match-closed", candidate: closedLostPost }
      ]
    })
  }));

  await page.goto("/posts/post-1/matches");
  await expect(page.getByRole("heading", { name: "Bài LOST của tôi" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Bài LOST đã đóng" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Không thể nhắn tin với bài này" })).toBeDisabled();
  await expect(page.locator(".matches-hero__actions dd").first()).toHaveText("1");
});

test("opens My Posts from the top navigation after matching", async ({ page }) => {
  await prepare(page, () => undefined);
  await fillCommonForm(page);
  await page.locator(".story-post-form button[type=submit]").click();

  await expect(page).toHaveURL(/\/posts\/post-1\/matches$/, { timeout: 6_000 });
  await page.getByRole("dialog", { name: "Chưa có gợi ý phù hợp" }).getByRole("button", { name: "Đã hiểu" }).click();
  await page.locator(".topbar").getByRole("link", { name: "Bài của tôi" }).click();
  await expect(page).toHaveURL(/\/my-posts$/);
  await expect(page.getByRole("heading", { name: "Bài đăng của tôi", exact: true })).toBeVisible();
  await expect(page.locator(".posts-tabs, .posts-toolbar")).toHaveCount(0);
});

test("rates and dismisses a persisted match without starting a claim", async ({ page }) => {
  let feedbackCalls = 0;
  let dismissCalls = 0;
  await prepare(page, () => undefined, true);
  await page.route(/\/api\/posts\/post-1\/matches(?:\?.*)?$/, (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(matchResponse(dismissCalls === 0))
  }));
  await page.route("**/api/posts/post-1/matches/match-1/feedback", async (route) => {
    feedbackCalls += 1;
    const payload = route.request().postDataJSON() as { value: string; correlationKey: string };
    expect(payload.value).toBe("USEFUL");
    expect(payload.correlationKey.length).toBeGreaterThan(7);
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "feedback-1", matchId: "match-1", userId: "user-1", sourcePostId: "post-1", value: "USEFUL", note: null, correlationKey: payload.correlationKey, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }) });
  });
  await page.route("**/api/posts/post-1/matches/match-1/dismiss", async (route) => {
    dismissCalls += 1;
    await route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
  });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/posts/post-1/matches");
  await page.locator(".match-feedback__options button").first().click();
  await expect(page.locator(".match-feedback__saved")).toBeVisible();
  await page.locator(".match-dismiss").click();
  await expect(page.locator(".match-analysis-card")).toHaveCount(0);
  expect(feedbackCalls).toBe(1);
  expect(dismissCalls).toBe(1);
  await expect(page).toHaveURL(/\/posts\/post-1\/matches$/);
});

test("paginates matching results and preserves page on recalculate", async ({ page }, testInfo) => {
  await prepare(page, () => undefined, true);
  const response = matchResponse(true);
  const results = Array.from({ length: 41 }, (_, index) => ({ ...response.results[0], matchId: `match-${index}`, candidate: { ...response.results[0].candidate, id: `found-${index}`, title: `Wallet candidate ${index + 1}` } }));
  await page.route(/\/api\/posts\/post-1\/matches(?:\/recalculate)?(?:\?.*)?$/, route => {
    const url = new URL(route.request().url());
    const current = Number(url.searchParams.get("page") ?? 1);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...response, total: results.length, page: current, pageSize: 20, hasMore: current < 3, results: results.slice((current - 1) * 20, current * 20) }) });
  });
  await page.goto("/posts/post-1/matches");
  await expect(page.locator(".match-rank").first()).toHaveText("#01");
  await page.getByRole("navigation", { name: "Phân trang gợi ý matching" }).getByRole("button", { name: "Sau" }).click();
  await expect(page.locator(".match-rank").first()).toHaveText("#21");
  await page.getByRole("button", { name: "Tính lại matching" }).click();
  await expect(page.locator(".match-rank").first()).toHaveText("#21");
  await expect(page.locator(".match-analysis-card")).toHaveCount(20);
  await page.screenshot({ path: testInfo.outputPath("matching-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("matching-mobile.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("analyzes an image, fills an editable draft, posts it and shows real category candidates", async ({ page }) => {
  let payload: Record<string, unknown> = {};
  let analysisImageParts = 0;
  let finishAnalysis!: () => void;
  const analysisResponse = new Promise<void>(resolve => { finishAnalysis = resolve; });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepare(page, (value) => { payload = value; }, true);
  await page.route("**/api/posts/analyze-image", async (route) => {
    const multipartBody = route.request().postDataBuffer()?.toString("utf8") ?? "";
    analysisImageParts = multipartBody.match(/name="files"/g)?.length ?? 0;
    await analysisResponse;
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
  await page.getByRole("button", { name: "Phân tích bằng Gemini" }).click();
  // Hold the response until loading-state assertions finish, regardless of runner speed.
  try {
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
  } finally {
    finishAnalysis();
  }
  const form = page.locator(".story-post-form");
  await expect(form.getByLabel("Tên vật phẩm")).toHaveValue("Ví da màu đen");
  await expect(form.getByLabel("Danh mục cụ thể", { exact: true })).toHaveValue(catalog.categories[1].id);
  expect(await form.evaluate((element) => {
    const result = element.querySelector(".story-analysis-result")!;
    const fields = element.querySelector(".story-form-fields")!;
    return result.getBoundingClientRect().bottom < fields.getBoundingClientRect().top;
  })).toBe(true);
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
