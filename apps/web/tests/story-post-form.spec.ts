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

async function prepare(page: Page, onCreate: (payload: Record<string, unknown>) => void) {
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) }));
  await page.route("**/api/posts/catalog", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(catalog) }));
  await page.route("**/api/posts", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    onCreate(route.request().postDataJSON());
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "post-1", type: "LOST", title: "Ví da màu đen", status: "OPEN", createdAt: new Date().toISOString() }) });
  });
  await page.route("**/api/posts/post-1/media", (route) => route.fulfill({ status: 201, contentType: "application/json", body: "{}" }));
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
