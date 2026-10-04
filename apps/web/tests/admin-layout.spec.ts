import { expect, test, type Page } from "@playwright/test";

const adminSession = {
  accessToken: "admin-access-token",
  accessTokenExpiresIn: "15m",
  user: {
    id: "admin-1",
    email: "admin@example.com",
    fullName: "Quản trị viên",
    studentCode: null,
    phoneNumber: null,
    roles: ["USER", "ADMIN"],
    status: "ACTIVE",
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z"
  }
};

test("admin login opens the dedicated sidebar workspace", async ({ page }) => {
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No session" }) }));
  await page.route("**/api/auth/login", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminSession) }));
  await page.route("**/api/admin/catalog", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stats: { totalPosts: 0, processingPosts: 0, totalUsers: 1, returnedPosts: 0 }, categories: [], areas: [], buildings: [], handoverPoints: [] }) }));
  await page.route(/\/api\/admin\/users(?:\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }) }));
  await page.route(/\/api\/admin\/configs(?:\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }) }));
  await page.route(/\/api\/admin\/reports(?:\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }) }));
  await page.route(/\/api\/admin\/dashboard\/kpis(?:\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ filters: { days: 30 }, totals: { posts: 0, claims: 0, appointments: 0, returns: 0 }, snapshot: { openPosts: 0, custodyItems: 0, unresolvedReports: 0 }, trends: [], statusBreakdown: { posts: [], claims: [], appointments: [], custody: [], reports: [] } }) }));

  await page.goto("/home");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Mật khẩu").fill("Password123!");
  await page.getByRole("button", { name: /Đăng nhập/ }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("LNFS Admin")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Chức năng quản trị" })).toBeVisible();
  await expect(page.locator(".topbar")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Moderation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Người dùng" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Điểm bàn giao" })).toBeVisible();
});

async function prepareWorkspace(page: Page, roles: string[] = ["USER", "ADMIN"]) {
  const adminRequests: string[] = [];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/api/admin/")) adminRequests.push(path);
    if (path === "/api/auth/refresh") return route.fulfill({ json: { ...adminSession, user: { ...adminSession.user, roles } } });
    if (path === "/api/auth/logout") return route.fulfill({ status: 204 });
    if (path === "/api/posts/catalog") return route.fulfill({ json: { categories: [], areas: [], buildings: [], handoverPoints: [] } });
    if (path === "/api/admin/catalog") return route.fulfill({ json: { stats: { totalPosts: 0, processingPosts: 0, totalUsers: 1, returnedPosts: 0 }, categories: [], areas: [], buildings: [], handoverPoints: [] } });
    if (path === "/api/admin/dashboard/kpis") return route.fulfill({ json: { filters: { days: 30 }, totals: { posts: 0, claims: 0, appointments: 0, returns: 0 }, snapshot: { openPosts: 0, custodyItems: 0, unresolvedReports: 0 }, trends: [], statusBreakdown: { posts: [], claims: [], appointments: [], custody: [], reports: [] } } });
    if (path === "/api/staff/warehouse-items/catalog") return route.fulfill({ json: { categories: [], areas: [], buildings: [], handoverPoints: [] } });
    if (path === "/api/staff/warehouse-items") return route.fulfill({ json: { stats: { totalItems: 0, activeItems: 0, receivedItems: 0, storedItems: 0, returnedItems: 0, overdueItems: 0 }, handoverCounts: [], total: 0, page: 1, pageSize: 12, items: [] } });
    if (path === "/api/staff/custody-requests") return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20, counts: { PENDING: 0, ACCEPTED: 0, INTAKED: 0, REJECTED: 0, CANCELLED: 0 } } });
    return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 10, unreadTotal: 0 } });
  });
  return adminRequests;
}

for (const width of [1440, 390]) {
  test(`internal workspace is inside administration with two-way user navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await prepareWorkspace(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Bảng quản trị" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.getByRole("link", { name: "Khu vực nội bộ" }).click();
    await expect(page).toHaveURL(/\/admin\/staff$/);
    await expect(page.getByRole("heading", { name: "Tiếp nhận & Quản lý Custody" })).toBeVisible();
    await expect(page.locator(".admin-sidebar")).toBeVisible();
    await expect(page.getByRole("link", { name: "Khu vực nội bộ" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".topbar")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `../../test-results/home/admin-internal-${width}.png`, fullPage: true });

    await page.getByRole("button", { name: "Danh mục", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\?tab=categories$/);
    await expect(page.getByRole("button", { name: "Danh mục", exact: true })).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(page.getByRole("button", { name: "Danh mục", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "Giao diện người dùng" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { name: /Đồ thất lạc/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Khu vực nội bộ" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Quản trị", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Quản trị", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `../../test-results/home/admin-user-view-${width}.png` });
    await page.getByRole("link", { name: "Quản trị", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Bảng quản trị" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `../../test-results/home/admin-switch-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("Staff uses the same workspace without Admin permissions and retains legacy links", async ({ page }) => {
  const adminRequests = await prepareWorkspace(page, ["USER", "STAFF"]);
  await page.goto("/staff?custodyRequestId=fixture#queue");
  await expect(page).toHaveURL(/\/admin\/staff\?custodyRequestId=fixture#queue$/);
  await expect(page.getByRole("heading", { name: "Tiếp nhận & Quản lý Custody" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Người dùng", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cấu hình", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Giao diện người dùng" }).click();
  await page.getByRole("link", { name: "Quản trị", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/staff$/);
  await page.goto("/admin?tab=users");
  await expect(page).toHaveURL(/\/admin\/staff$/);
  expect(adminRequests).toEqual([]);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("ordinary users cannot enter either administration route or see its switch", async ({ page }) => {
  const adminRequests = await prepareWorkspace(page, ["USER", "STUDENT"]);
  for (const path of ["/admin", "/admin/staff", "/staff"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("link", { name: "Quản trị", exact: true })).toHaveCount(0);
    await expect(page.locator(".admin-sidebar")).toHaveCount(0);
  }
  expect(adminRequests).toEqual([]);
});
