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
  areas: [], buildings: [], handoverPoints: []
};

function post(id: string, title: string, owner = "Nguyễn Minh An") {
  return {
    id, type: "LOST", status: "OPEN", visibilityMode: "PUBLIC", title,
    description: "Ví da màu nâu, bên trong có thẻ sinh viên.",
    category: { id: catalog.categories[1].id, name: "Ví / bóp", icon: null },
    location: { area: { id: "area-1", name: "Khu Alpha" }, building: null, roomText: "Sảnh tầng 1", customLocation: null },
    handoverPoint: null, lostFoundAt: "2026-08-12T08:30:00.000Z", owner: { id: "owner-1", fullName: owner }, media: [], canEdit: owner === "Sinh viên Demo", createdAt: "2026-08-12T09:00:00.000Z"
  };
}

async function prepare(page: Page, requests: string[], destination = "/posts") {
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) }));
  await page.route("**/api/posts/catalog", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(catalog) }));
  await page.route(/\/api\/posts(?:\?.*)?$/, (route) => {
    const url = route.request().url();
    requests.push(url);
    const isRelated = url.includes("type=FOUND") && url.includes(`categoryId=${catalog.categories[1].id}`);
    const item = isRelated ? { ...post("post-related", "Ví da được nhặt ở khu Beta"), type: "FOUND" } : post("post-public", "Ví da nam màu nâu");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 1, page: 1, pageSize: 9, items: [item] }) });
  });
  await page.route(/\/api\/posts\/mine(?:\?.*)?$/, (route) => {
    requests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 1, page: 1, pageSize: 9, items: [post("post-mine", "Thẻ sinh viên của tôi", "Sinh viên Demo")] }) });
  });
  await page.route(/\/api\/posts\/post-public$/, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(post("post-public", "Ví da nam màu nâu"))
  }));
  await page.goto(destination);
}

test("header navigation switches between the public board and only the current user's posts", async ({ page }) => {
  const requests: string[] = [];
  await prepare(page, requests);
  await expect(page.getByRole("heading", { name: "Bài đăng", exact: true })).toBeVisible();
  await expect(page.getByText("Ví da nam màu nâu")).toBeVisible();
  await expect(page.getByRole("link",{name:"Xem hành trình vật phẩm",exact:true})).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "Phạm vi bài đăng" })).toHaveCount(0);
  await expect(page.getByText("Tìm báo cáo thất lạc, theo dõi vật phẩm bạn đã đăng và xem trạng thái xử lý.")).toHaveCount(0);
  await page.locator(".topbar").getByRole("link", { name: "Bài của tôi", exact: true }).click();
  await expect(page).toHaveURL(/\/my-posts$/);
  await expect(page.getByRole("heading", { name: "Bài đăng của tôi", exact: true })).toBeVisible();
  await expect(page.getByText("Thẻ sinh viên của tôi")).toBeVisible();
  await expect(page.getByText("Ví da nam màu nâu")).toHaveCount(0);
  await expect(page.locator(".posts-toolbar")).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Xem hành trình vật phẩm",exact:true})).toHaveAttribute("href","/posts/post-mine/journey");
  expect(requests.some((url) => url.includes("/api/posts/mine?"))).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath("my-posts-desktop.png"), fullPage: true });
  await page.locator(".topbar").getByRole("link", { name: "Bài đăng", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bài đăng", exact: true })).toBeVisible();
  await expect(page.getByText("Ví da nam màu nâu")).toBeVisible();
  await expect(page.getByText("Thẻ sinh viên của tôi")).toHaveCount(0);
  await expect(page.getByLabel("Danh mục", { exact: true })).toBeVisible();
});

test("My Posts loads directly without hidden public-board filters on mobile", async ({ page }) => {
  const requests: string[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, requests, `/my-posts?type=FOUND&categoryId=${catalog.categories[1].id}`);
  await expect(page.getByRole("heading", { name: "Bài đăng của tôi", exact: true })).toBeVisible();
  await expect(page.getByText("Thẻ sinh viên của tôi")).toBeVisible();
  await expect(page.locator(".posts-toolbar, .posts-tabs")).toHaveCount(0);
  const mineRequest = requests.find(url => url.includes("/api/posts/mine?"));
  expect(mineRequest).toBeTruthy();
  const query = new URL(mineRequest!).searchParams;
  expect(query.get("sort")).toBe("newest");
  expect(query.has("type")).toBeFalsy();
  expect(query.has("categoryId")).toBeFalsy();
  expect(query.has("q")).toBeFalsy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: test.info().outputPath("my-posts-mobile.png"), fullPage: true });
});

test("public filters do not carry over to My Posts through header navigation", async ({ page }) => {
  const requests: string[] = [];
  await prepare(page, requests);
  await page.getByLabel("Tìm kiếm bài đăng").fill("ví da");
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await page.getByLabel("Loại bài", { exact: true }).selectOption("FOUND");
  await expect.poll(() => requests.some(url => url.includes("q=v%C3%AD+da") && url.includes("type=FOUND"))).toBeTruthy();
  await page.locator(".topbar").getByRole("link", { name: "Bài của tôi", exact: true }).click();
  await expect(page.getByText("Thẻ sinh viên của tôi")).toBeVisible();
  const query = new URL(requests.find(url => url.includes("/api/posts/mine?"))!).searchParams;
  expect(query.has("q")).toBeFalsy();
  expect(query.has("type")).toBeFalsy();
});

test("applies search and category filters without horizontal overflow", async ({ page }) => {
  const requests: string[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, requests);
  await page.getByLabel("Tìm kiếm bài đăng").fill("ví da");
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await page.getByLabel("Danh mục").selectOption(catalog.categories[1].id);
  await expect.poll(() => requests.some((url) => url.includes("q=v%C3%AD+da") && url.includes(`categoryId=${catalog.categories[1].id}`))).toBeTruthy();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: test.info().outputPath("posts-mobile.png"), fullPage: true });
});

test("opens a dedicated post detail page from a board card", async ({ page }) => {
  const requests: string[] = [];
  await prepare(page, requests);
  await page.getByRole("link", { name: "Xem chi tiết", exact: true }).click();
  await expect(page).toHaveURL(/\/posts\/post-public$/);
  await expect(page.getByRole("heading", { name: "Ví da nam màu nâu" })).toBeVisible();
  await expect(page.getByText("Thông tin vật phẩm")).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "Sảnh tầng 1 · Khu Alpha" })).toBeVisible();
  await expect(page.getByText("Ví da được nhặt ở khu Beta")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Đồ nhặt được có thể liên quan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Quay lại bài đăng" })).toBeVisible();
  expect(requests.some((url) => url.includes("type=FOUND") && url.includes(`categoryId=${catalog.categories[1].id}`) && !url.includes("areaId="))).toBeTruthy();
});
