import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const categoryId = "11111111-1111-4111-8111-111111111111";
const parentId = "99999999-9999-4999-8999-999999999999";
const session = { accessToken: "qa-token", accessTokenExpiresIn: "15m", user: { id: "owner", email: "student@example.com", fullName: "Sinh viên Demo", roles: ["USER", "STUDENT"], status: "ACTIVE", phoneNumber: null } };
const catalog = { categories: [{ id: parentId, name: "Đồ dùng", parentId: null }, { id: categoryId, name: "Bình nước", parentId }], areas: [], buildings: [], handoverPoints: [] };
const image = readFileSync(new URL("./fixtures/appointment-item.png", import.meta.url));
const title = "Bình nước màu đỏ";
const description = "Bình nước màu đỏ hình trụ với nắp màu đen";
type Attempt = { id: string; number: number; status: "READY" | "REJECTED" | "PENDING"; title: string; description: string; categoryId: string; url: string | null };
async function prepare(page: Page, options: { reject?: boolean; used?: number; pending?: boolean } = {}) {
  const attempts: Attempt[] = [];
  let calls = 0;
  let used = options.used ?? 0;
  let created: Record<string, unknown> | null = null;
  const state = () => ({ available: true, id: used ? "draft-1" : null, used, maxAttempts: 4, remaining: 4 - used, attempts });
  const add = (status: Attempt["status"], values = { title, description, categoryId }) => {
    const attempt: Attempt = { id: `image-${++used}`, number: used, status, ...values, url: status === "READY" ? `/api/posts/illustrations/image-${used}/image` : null };
    attempts.push(attempt); return attempt;
  };
  if (options.pending) add("PENDING");
  await page.route("**/api/auth/refresh", route => route.fulfill({ json: session }));
  await page.route("**/api/posts/catalog", route => route.fulfill({ json: catalog }));
  await page.route("**/api/posts/illustrations/draft", route => route.fulfill({ json: state() }));
  await page.route(/\/api\/posts\/illustrations\/image-\d\/image$/, route => route.fulfill({ contentType: "image/png", body: image }));
  await page.route(/\/api\/posts\/illustrations$/, async route => {
    calls++;
    const payload = route.request().postDataJSON();
    const attempt = add(options.reject ? "REJECTED" : "READY", { title: payload.title, description: payload.description, categoryId: payload.categoryId });
    await route.fulfill({ json: { attempt, draft: state() } });
  });
  await page.route(/\/api\/posts(?:\?.*)?$/, route => {
    if (route.request().method() === "POST") { created = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { id: "post-1", title, type: "LOST", status: "OPEN" } }); }
    return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 6 } });
  });
  await page.route("**/api/posts/post-1/matches**", route => route.fulfill({ json: { results: [], total: 0, page: 1, pageSize: 20 } }));
  await page.route("**/api/notifications**", route => route.fulfill({ json: { items: [], unreadTotal: 0 } }));
  await page.goto("/home");
  await page.locator("#quick-story").scrollIntoViewIfNeeded();
  return { calls: () => calls, created: () => created, finishPending: () => { attempts[0].status = "READY"; attempts[0].url = "/api/posts/illustrations/image-1/image"; } };
}
async function fill(page: Page) {
  const form = page.locator(".story-post-form");
  await form.getByLabel("Tên vật phẩm").fill(title);
  await form.getByLabel("Nhóm chính", { exact: true }).selectOption(parentId);
  await form.getByLabel("Danh mục cụ thể", { exact: true }).selectOption(categoryId);
  await form.getByLabel("Mô tả nhận dạng").fill(description);
  await form.getByLabel("Vị trí khác", { exact: true }).fill("Sảnh Alpha");
  return form;
}

for (const width of [1440, 390]) test(`LOST illustration chooses a generated image, labels it and publishes its server id at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  const qa = await prepare(page);
  const form = await fill(page);
  const panel = page.getByRole("region", { name: "Ảnh minh họa vật bị mất" });
  await panel.getByRole("button", { name: "Tạo ảnh minh họa", exact: true }).click();
  await expect(panel.getByText("1/4 lượt")).toBeVisible();
  await expect(panel.getByRole("img", { name: "Ảnh minh họa vật bị mất do AI tạo", exact: true })).toBeVisible();
  await expect.poll(() => panel.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(panel.getByText(/Không phải ảnh thật hoặc bằng chứng sở hữu/)).toBeVisible();
  await panel.getByLabel("Dùng ảnh này cho bài đăng").check();
  await panel.evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 160));
  await panel.screenshot({ path: testInfo.outputPath(`illustration-${width}.png`) });
  await page.screenshot({ path: testInfo.outputPath(`viewport-${width}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await form.getByRole("button", { name: "Đăng bài LOST" }).click();
  await expect.poll(() => qa.created()?.illustrationId).toBe("image-1");
  expect(qa.created()?.illustrationDraftId).toBe("draft-1");
  expect(qa.created()?.analysisSignals).toBeUndefined();
});

test("initial generation plus three retries persists on reload and leaves no fifth action", async ({ page }) => {
  const qa = await prepare(page);
  await fill(page);
  const panel = page.getByRole("region", { name: "Ảnh minh họa vật bị mất" });
  await panel.getByRole("button", { name: "Tạo ảnh minh họa", exact: true }).click();
  for (let count = 2; count <= 4; count++) {
    await panel.getByRole("button", { name: "Tạo lại ảnh", exact: true }).click();
    await expect(panel.getByText(`${count}/4 lượt`)).toBeVisible();
  }
  await expect(panel.getByRole("button", { name: "Tạo lại ảnh", exact: true })).toBeDisabled();
  await page.reload();
  await expect(panel.getByText("4/4 lượt")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Tạo lại ảnh", exact: true })).toBeDisabled();
  expect(qa.calls()).toBe(4);
});

test("editing description invalidates the prior selection and does not attach it to another item", async ({ page }) => {
  const qa = await prepare(page);
  const form = await fill(page);
  const panel = page.getByRole("region", { name: "Ảnh minh họa vật bị mất" });
  await panel.getByRole("button", { name: "Tạo ảnh minh họa", exact: true }).click();
  await panel.getByLabel("Dùng ảnh này cho bài đăng").check();
  await form.getByLabel("Mô tả nhận dạng").fill("Bình nước màu xanh có họa tiết hình ngôi sao");
  await expect(panel.getByText(/Ảnh thuộc mô tả trước đó/)).toBeVisible();
  await form.getByRole("button", { name: "Đăng bài LOST" }).click();
  await expect.poll(() => qa.created()).not.toBeNull();
  expect(qa.created()?.illustrationId).toBeUndefined();
  expect(qa.created()?.illustrationDraftId).toBe("draft-1");
});

test("rejected generation has no selectable image and shows remaining quota", async ({ page }) => {
  await prepare(page, { reject: true }); await fill(page);
  const panel = page.getByRole("region", { name: "Ảnh minh họa vật bị mất" });
  await panel.getByRole("button", { name: "Tạo ảnh minh họa", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("chưa phù hợp mô tả");
  await expect(panel.getByRole("img", { name: "Ảnh minh họa vật bị mất do AI tạo", exact: true })).toHaveCount(0);
  await expect(panel.getByLabel("Dùng ảnh này cho bài đăng")).toHaveCount(0);
  await expect(panel.getByText("1/4 lượt")).toBeVisible();
});

test("a restored pending attempt resyncs without another generation or premature post submission", async ({ page }) => {
  const qa = await prepare(page, { pending: true }); const form = await fill(page);
  const panel = page.getByRole("region", { name: "Ảnh minh họa vật bị mất" });
  await expect(panel.getByRole("button", { name: /Đang tạo ảnh/ })).toBeDisabled();
  await expect(form.getByRole("button", { name: "Đăng bài LOST" })).toBeDisabled();
  qa.finishPending();
  await panel.getByRole("button", { name: "Kiểm tra trạng thái ảnh minh họa" }).click();
  await expect(panel.getByRole("img", { name: "Ảnh minh họa vật bị mất do AI tạo", exact: true })).toBeVisible();
  await expect(form.getByRole("button", { name: "Đăng bài LOST" })).toBeEnabled();
  expect(qa.calls()).toBe(0);
});

test("invalid draft responses do not crash manual post creation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await prepare(page);
  await page.route("**/api/posts/illustrations/draft", route => route.fulfill({ json: { items: [] } }));
  await page.reload();
  const form = await fill(page);
  await expect(page.getByRole("alert").filter({ hasText: "Không đọc được trạng thái ảnh" })).toBeVisible();
  await expect(form.getByRole("button", { name: "Đăng bài LOST" })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("retrying a private preview does not spend another generation", async ({ page }) => {
  const qa = await prepare(page); await fill(page);
  let downloads = 0;
  await page.route(/\/api\/posts\/illustrations\/image-\d\/image$/, route => {
    downloads++;
    return downloads === 1 ? route.fulfill({ status: 503 }) : route.fulfill({ contentType: "image/png", body: image });
  });
  const panel = page.getByRole("region", { name: "Ảnh minh họa vật bị mất" });
  await panel.getByRole("button", { name: "Tạo ảnh minh họa", exact: true }).click();
  await expect(panel.getByLabel("Dùng ảnh này cho bài đăng")).toBeDisabled();
  await panel.getByRole("button", { name: "Tải lại ảnh minh họa" }).click();
  await expect(panel.locator("img")).toBeVisible();
  await expect(panel.getByLabel("Dùng ảnh này cho bài đăng")).toBeEnabled();
  expect(qa.calls()).toBe(1);
  expect(downloads).toBe(2);
});

test("quota errors survive reload as a server cooldown and leave manual posting available on mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 440, height: 956 });
  await prepare(page, { used: 2 }); await fill(page);
  let calls = 0;
  let cooldown: { until: number; message: string } | null = null;
  const message = "Gemini đang chặn quota Free Tier của model tạo ảnh. Quản trị viên cần kiểm tra Billing và hạn mức trong Google AI Studio; bấm tạo lại không khắc phục được.";
  await page.route("**/api/posts/illustrations/draft", route => route.fulfill({ json: { available: true, id: "draft-1", used: 2 + calls, maxAttempts: 4, remaining: 2 - calls, attempts: [], cooldown } }));
  await page.route(/\/api\/posts\/illustrations$/, route => {
    calls++; cooldown = { until: Date.now() + 76_775_000, message };
    return route.fulfill({ status: 429, headers: { "retry-after": "76775" }, json: { message } });
  });
  const panel = page.getByRole("region", { name: "Ảnh minh họa vật bị mất" });
  await panel.getByRole("button", { name: "Tạo lại ảnh", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("Billing");
  await expect(panel.getByRole("button", { name: "Tạo lại ảnh", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "Kiểm tra trạng thái ảnh minh họa" }).click();
  await expect(panel.getByRole("alert")).toContainText("Billing");
  await page.reload();
  const form = await fill(page);
  await expect(panel.getByRole("status")).toContainText("Tạm dừng thử lại");
  await expect(panel.getByRole("button", { name: "Tạo lại ảnh", exact: true })).toBeDisabled();
  await expect(form.getByRole("button", { name: "Đăng bài LOST" })).toBeEnabled();
  await expect(panel.getByText("3/4 lượt")).toBeVisible();
  await panel.evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 160));
  await page.screenshot({ path: testInfo.outputPath("quota-cooldown-mobile.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(calls).toBe(1);
});

test("Retry-After expiry enables an explicit retry without automatically calling the provider", async ({ page }) => {
  await page.clock.install();
  await prepare(page); await fill(page);
  let failures = 0;
  await page.route(/\/api\/posts\/illustrations$/, route => {
    failures++;
    return route.fulfill({ status: 429, headers: { "retry-after": "60" }, json: { message: "Gemini đang giới hạn tần suất yêu cầu." } });
  });
  const panel = page.getByRole("region", { name: "Ảnh minh họa vật bị mất" });
  const generate = panel.getByRole("button", { name: "Tạo ảnh minh họa", exact: true });
  await generate.click();
  await expect(generate).toBeDisabled();
  await expect(panel.getByRole("status")).toContainText("Tạm dừng thử lại");
  await page.clock.fastForward(61_000);
  await expect(generate).toBeEnabled();
  expect(failures).toBe(1);
  await generate.click();
  await expect.poll(() => failures).toBe(2);
});
