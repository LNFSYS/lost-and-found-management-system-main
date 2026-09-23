import { expect, test } from "@playwright/test";

const reportId = "33333333-3333-4333-8333-333333333333";
const postId = "11111111-1111-4111-8111-111111111111";
const session = {
  accessToken: "e2e-access-token", accessTokenExpiresIn: "15m",
  user: { id: "user-1", email: "student@example.com", fullName: "Sinh viên Demo", studentCode: "SE000000", phoneNumber: null, avatar: { hasAvatar: false, updatedAt: null }, roles: ["USER", "STUDENT"], status: "ACTIVE", createdAt: "2026-09-22T00:00:00.000Z", updatedAt: "2026-09-22T00:00:00.000Z" }
};

test("user submits, views and withdraws a pending moderation report", async ({ page }) => {
  let status: "PENDING" | "WITHDRAWN" = "PENDING";
  let submitted = false;
  const record = () => ({
    id: reportId, entityType: "POST", entityId: postId, sourceType: "POST", sourceId: postId,
    reason: "Nội dung không phù hợp", details: "Thông tin hỗ trợ", status, resolution: null,
    reviewedAt: null, withdrawnAt: status === "WITHDRAWN" ? "2026-09-22T01:00:00.000Z" : null,
    createdAt: "2026-09-22T00:00:00.000Z", target: { title: "Bài đăng cần kiểm tra", status: "OPEN" }
  });
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) }));
  await page.route(/\/api\/reports\/mine(?:\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: submitted ? 1 : 0, page: 1, pageSize: 10, items: submitted ? [record()] : [] }) }));
  await page.route(/\/api\/reports\/mine\/.+\/withdraw$/, (route) => { status = "WITHDRAWN"; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(record()) }); });
  await page.route(/\/api\/reports$/, async (route) => {
    const payload = route.request().postDataJSON();
    expect(payload.targetType).toBe("POST");
    expect(payload.targetId).toBe(postId);
    expect(payload.idempotencyKey).toBeTruthy();
    submitted = true;
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(record()) });
  });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto(`/reports?targetType=POST&targetId=${postId}`);
  await expect(page.getByRole("heading", { name: "Báo cáo của tôi" })).toBeVisible();
  await page.getByLabel("Lý do").fill("Nội dung không phù hợp");
  await page.getByLabel("Mô tả hỗ trợ").fill("Thông tin hỗ trợ");
  await page.getByRole("button", { name: "Gửi báo cáo" }).click();
  await expect(page.getByText("Đã gửi báo cáo cho bộ phận quản trị")).toBeVisible();
  await expect(page.getByText("Bài đăng cần kiểm tra")).toBeVisible();
  await page.getByRole("button", { name: "Rút báo cáo" }).click();
  await expect(page.getByText("Đã rút báo cáo")).toBeVisible();
  await expect(page.locator(".report-status--withdrawn", { hasText: "Đã rút" })).toBeVisible();
});

test("report page remains usable at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) }));
  await page.route(/\/api\/reports\/mine(?:\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 0, page: 1, pageSize: 10, items: [] }) }));
  await page.goto("/reports");
  await expect(page.getByRole("button", { name: "Gửi báo cáo" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
