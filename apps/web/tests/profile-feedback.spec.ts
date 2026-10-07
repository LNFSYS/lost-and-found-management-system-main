import { expect, test } from "@playwright/test";

const appointmentId = "11111111-1111-4111-8111-111111111111";
const session = {
  accessToken: "profile-feedback-token",
  accessTokenExpiresIn: "15m",
  user: {
    id: "user-1",
    email: "student@example.com",
    fullName: "Sinh viên Demo",
    studentCode: "SE000000",
    phoneNumber: null,
    avatar: { hasAvatar: false, updatedAt: null },
    roles: ["USER", "STUDENT"],
    status: "ACTIVE",
    createdAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z"
  }
};

function activity(points = 0, receivedFeedback = 0) {
  return {
    ownerId: session.user.id,
    counts: { posts: 1, openPosts: 1, claims: 1, completedReturns: 1, receivedFeedback },
    reputation: { totalPoints: points, level: points >= 8 ? "TRUSTED" : "NEW", updatedAt: "2026-09-05T08:05:00.000Z" },
    recentEvents: points ? [{ type: "REPUTATION_CHANGED", label: "Diem uy tin thay doi", occurredAt: "2026-09-05T08:05:00.000Z", pointsDelta: 6 }] : []
  };
}

test("profile lets an eligible participant submit return feedback once", async ({ page }, testInfo) => {
  let submitted: Record<string, unknown> | null = null;
  let activityPoints = 0;
  await page.route("**/api/returns/completed?*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ id: appointmentId, postTitle: "Ví da đã hoàn trả", completedAt: "2026-09-05T08:00:00.000Z", rating: null }], page: 1, hasMore: false }) }));
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) }));
  await page.route("**/api/auth/activity", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(activity(activityPoints, activityPoints ? 1 : 0)) }));
  await page.route(`**/api/returns/${appointmentId}/feedback/eligibility`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      appointmentId,
      eligible: submitted === null,
      reason: submitted ? "Ban da gui feedback cho return nay" : null,
      returnStatus: "COMPLETED",
      completedAt: "2026-09-05T08:00:00.000Z",
      dualConfirmed: true,
      custodyAuthorized: false,
      currentUserFeedback: submitted ? {
        id: "feedback-1",
        appointmentId,
        reviewer: { id: session.user.id, fullName: session.user.fullName },
        target: { id: "finder-1", fullName: "Nguoi nhat" },
        rating: submitted.rating,
        comment: submitted.comment,
        isNegative: false,
        status: "NEW",
        createdAt: "2026-09-05T08:04:00.000Z"
      } : null,
      feedbackCount: submitted ? 1 : 0,
      participants: {
        claimant: { id: session.user.id, fullName: session.user.fullName },
        finder: { id: "finder-1", fullName: "Nguoi nhat" }
      }
    })
  }));
  await page.route(`**/api/returns/${appointmentId}/feedback`, async (route) => {
    submitted = route.request().postDataJSON();
    activityPoints = 6;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        feedback: {
          id: "feedback-1",
          appointmentId,
          reviewer: { id: session.user.id, fullName: session.user.fullName },
          target: { id: "finder-1", fullName: "Nguoi nhat" },
          rating: submitted?.rating,
          comment: submitted?.comment,
          isNegative: false,
          status: "NEW",
          createdAt: "2026-09-05T08:04:00.000Z"
        },
        reputationEventCreated: true,
        idempotent: false
      })
    });
  });

  await page.goto("/profile");
  await expect(page.getByPlaceholder("UUID appointment")).toHaveCount(0);
  await page.getByRole("button", { name: /Ví da đã hoàn trả/ }).click();
  await expect(page.locator(".return-feedback-status").first()).toContainText("Bạn có thể gửi feedback");
  await page.locator(".return-feedback-form select").selectOption("5");
  await page.locator(".return-feedback-form textarea").fill("Cảm ơn bạn đã trả đồ đúng hẹn");
  const feedbackRequest = page.waitForRequest((request) =>
    request.method() === "POST" && request.url().endsWith(`/api/returns/${appointmentId}/feedback`)
  );
  await page.locator(".return-feedback-form button").click();
  const payload = (await feedbackRequest).postDataJSON();

  await expect(page.locator(".return-feedback-status.is-done")).toContainText("5/5");
  await expect(page.locator(".profile-grid")).toContainText("6");
  expect(payload.idempotencyKey).toBe(`feedback-${appointmentId}-${session.user.id}`);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator(".return-feedback-panel").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`completed-returns-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
});

test("completed return list recovers from errors, pages and handles an empty result", async ({ page }) => {
  await page.route("**/api/auth/refresh", route => route.fulfill({ json: session }));
  await page.route("**/api/auth/activity", route => route.fulfill({ json: activity() }));
  let attempts = 0;
  await page.route("**/api/returns/completed?*", route => {
    if (++attempts === 1) return route.fulfill({ status: 503, json: { message: "Unavailable" } });
    const current = Number(new URL(route.request().url()).searchParams.get("page"));
    return route.fulfill({ json: { items: current === 1 ? [{ id: appointmentId, postTitle: "Completed wallet", completedAt: "2026-01-01T00:00:00Z", rating: 5 }] : [], page: current, hasMore: current === 1 } });
  });
  await page.goto("/profile");
  const panel = page.locator(".return-feedback-panel");
  await expect(panel).toContainText("Không tải được lịch hoàn trả");
  await panel.getByRole("button", { name: "Thử lại" }).click();
  await expect(panel.getByRole("button", { name: /Completed wallet/ })).toContainText("Đã đánh giá 5/5");
  await panel.getByRole("button", { name: "Sau", exact: true }).click();
  await expect(panel).toContainText("Bạn chưa có lịch hoàn trả đã hoàn tất.");
  await expect(panel.getByRole("button", { name: "Sau", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "Trước", exact: true }).click();
  await expect(panel.getByRole("button", { name: /Completed wallet/ })).toBeVisible();
});
