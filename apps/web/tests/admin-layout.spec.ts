import { expect, test } from "@playwright/test";

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
