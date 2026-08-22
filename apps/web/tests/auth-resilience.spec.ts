import { expect, test, type Page } from "@playwright/test";

const session = {
  accessToken: "e2e-access-token",
  accessTokenExpiresIn: "15m",
  user: {
    id: "e2e-user",
    email: "student@example.com",
    fullName: "Sinh viên Demo",
    studentCode: "SE000000",
    phoneNumber: null,
    roles: ["USER", "STUDENT"],
    status: "ACTIVE",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z"
  }
};

async function rejectRefresh(page: Page) {
  await page.route("**/api/auth/refresh", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ message: "Phiên đăng nhập không hợp lệ" })
  }));
}

test("shows the password-reset confirmation once after redirecting to login", async ({ page }) => {
  await rejectRefresh(page);
  await page.route("**/api/auth/reset-password", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ reset: true })
  }));

  await page.goto("/reset-password?email=student%40example.com");
  await page.getByLabel("Mã OTP gồm 6 số").fill("123456");
  await page.getByLabel("Mật khẩu mới").fill("NewPassword123!");
  await page.getByRole("button", { name: /Cập nhật mật khẩu/i }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("status")).toHaveText("Mật khẩu đã được cập nhật. Hãy đăng nhập lại.");

  await page.reload();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("clears the local session even when the logout endpoint fails", async ({ page }) => {
  await page.route("**/api/auth/refresh", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(session)
  }));
  await page.route("**/api/auth/logout", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ message: "Dịch vụ tạm thời không khả dụng" })
  }));

  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân" })).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Đăng nhập để tiếp tục" })).toBeVisible();
});
