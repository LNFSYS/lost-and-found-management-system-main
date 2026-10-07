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
    avatar: { hasAvatar: false, updatedAt: null },
    roles: ["USER", "STUDENT"],
    status: "ACTIVE",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z"
  }
};

test.beforeEach(async ({ page }) => {
  // These background reads are not part of session recovery and must not trigger extra 401 refreshes.
  await page.route("**/api/auth/activity", route => route.fulfill({ status: 503, json: { message: "Activity unavailable in this fixture" } }));
  await page.route(/\/api\/notifications(?:\?.*)?$/, route => route.fulfill({ status: 503, json: { message: "Notifications unavailable in this fixture" } }));
});

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

test("hard reload keeps a rate-limited session on the protected URL and obeys Retry-After", async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/api/auth/refresh", route => {
    calls++;
    return calls === 1
      ? route.fulfill({ status: 429, headers: { "Retry-After": "3" }, json: { message: "Khôi phục phiên đang bị giới hạn." } })
      : route.fulfill({ json: session });
  });
  await page.goto("/profile");
  await expect(page.locator(".auth-recovery")).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Thử lại sau/ })).toBeDisabled();
  expect(calls).toBe(1);
  await page.clock.fastForward(3100);
  await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân" })).toBeVisible();
  expect(calls).toBe(2);
  calls = 0;
  await page.reload();
  await expect(page.locator(".auth-recovery")).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
  await page.clock.fastForward(3100);
  await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân" })).toBeVisible();
  expect(calls).toBe(2);
});

for (const failure of ["503", "network"] as const) {
  test(`temporary refresh ${failure} recovers without treating the session as revoked`, async ({ page }) => {
    await page.clock.install();
    let calls = 0;
    await page.route("**/api/auth/refresh", route => {
      calls++;
      if (calls > 1) return route.fulfill({ json: session });
      return failure === "network" ? route.abort("failed") : route.fulfill({ status: 503, json: { message: "Database temporarily unavailable" } });
    });
    await page.goto("/profile");
    await expect(page.locator(".auth-recovery")).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
    await page.clock.fastForward(2100);
    await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân" })).toBeVisible();
    expect(calls).toBe(2);
  });
}

test("bootstrap retry is bounded and a revoked refresh still fails closed", async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/api/auth/refresh", route => { calls++; return route.fulfill({ status: 503, json: { message: "Service unavailable" } }); });
  await page.goto("/profile");
  await expect(page.locator(".auth-recovery")).toBeVisible();
  for (let attempt = 0; attempt < 2; attempt++) { await page.clock.fastForward(2100); await expect.poll(() => calls).toBe(attempt + 2); }
  await page.clock.fastForward(30_000);
  expect(calls).toBe(3);
  await rejectRefresh(page);
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân" })).toHaveCount(0);
});

test("late bootstrap refresh cannot overwrite a newly logged-in account", async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const pending = new Promise<void>(resolve => { started = resolve; });
  await page.route("**/api/auth/refresh", async route => { started(); await waiting; await route.fulfill({ json: session }).catch(() => undefined); });
  const second = { ...session, accessToken: "second-token", user: { ...session.user, id: "second-user", fullName: "Second Account" } };
  await page.route("**/api/auth/login", route => route.fulfill({ json: second }));
  await page.goto("/login");
  await pending;
  await page.getByLabel("Email", { exact: true }).fill("second@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  release();
  await page.getByRole("link", { name: "Hồ sơ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân" })).toBeVisible();
  await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveValue("Second Account");
});

test("late logout cannot clear a newer account or its access token", async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const pending = new Promise<void>(resolve => { started = resolve; });
  let completed!: () => void;
  const finished = new Promise<void>(resolve => { completed = resolve; });
  await page.route("**/api/auth/refresh", route => route.fulfill({ json: session }));
  await page.route("**/api/auth/logout", async route => { started(); await waiting; await route.fulfill({ json: { loggedOut: true } }); completed(); });
  const second = { ...session, accessToken: "second-token", user: { ...session.user, id: "second-user", fullName: "Second Account" } };
  await page.route("**/api/auth/login", route => route.fulfill({ json: second }));
  await page.route("**/api/auth/profile", route => {
    expect(route.request().headers().authorization).toBe("Bearer second-token");
    return route.fulfill({ json: { user: second.user } });
  });
  await page.goto("/profile");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await pending;
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill("second@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  release();
  await finished;
  await page.getByRole("link", { name: "Hồ sơ", exact: true }).click();
  await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveValue("Second Account");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByText("Đã cập nhật hồ sơ.", { exact: true })).toBeVisible();
});
