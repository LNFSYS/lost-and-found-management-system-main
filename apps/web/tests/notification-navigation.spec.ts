import { expect, test, type Page } from "@playwright/test";

const session = {
  accessToken: "e2e-access-token", accessTokenExpiresIn: "15m",
  user: { id: "user-1", email: "student@example.com", fullName: "Sinh vien Demo", roles: ["USER"], status: "ACTIVE" }
};
const post = {
  id: "post-1", type: "LOST", status: "OPEN", visibilityMode: "PUBLIC", title: "Vi da mau den",
  description: "Vi da", category: null, location: { area: null, building: null, roomText: null, customLocation: null },
  handoverPoint: null, lostFoundAt: "2026-10-07T08:00:00.000Z", owner: { id: "user-1", fullName: "Sinh vien Demo" },
  media: [], canEdit: true, createdAt: "2026-10-07T08:00:00.000Z"
};
const destinations = [
  { entityType: "POST_MATCH", entityId: "post-1", path: "/posts/post-1/matches" },
  { entityType: "POST", entityId: "post-1", path: "/posts/post-1" },
  { entityType: "CLAIM", entityId: "claim-1", path: "/claims/claim-1" },
  { entityType: "APPOINTMENT", entityId: "appointment-1", path: "/appointments/appointment-1" },
  { entityType: "APPOINTMENT_REMINDER", entityId: "appointment-1", path: "/appointments/appointment-1" },
  { entityType: "CUSTODY_REQUEST", entityId: "custody-1", path: "/notifications?custodyRequestId=custody-1" }
];

function notification(entityType: string | null, entityId: string | null) {
  return { id: "notification-1", type: entityType === "POST_MATCH" ? "MATCH_FOUND" : "CLAIM_REQUEST_RECEIVED",
    title: "Thong bao moi", body: "Mo noi dung lien quan", entityType, entityId,
    isRead: false, readAt: null, createdAt: "2026-10-07T08:00:00.000Z" };
}

async function prepare(page: Page, item = notification("POST_MATCH", "post-1")) {
  const reads: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  // Block all unconfigured API requests, including destinations no longer accessible.
  await page.route("**/api/**", route => route.fulfill({ status: 404, contentType: "application/json",
    body: JSON.stringify({ error: "not_found", message: "Test destination unavailable" }) }));
  await page.route("**/api/auth/refresh", route => route.fulfill({ json: session }));
  await page.route(/\/api\/notifications(?:\?.*)?$/, route => route.fulfill({ json: { items: [item], unreadTotal: 1 } }));
  await page.route("**/api/notifications/notification-1/read", route => {
    reads.push(route.request().url());
    return route.fulfill({ json: { read: true } });
  });
  await page.route(/\/api\/claims(?:\?.*)?$/, route => route.fulfill({ json: { items: [], page: 1, hasMore: false } }));
  await page.route("**/api/posts/post-1", route => route.fulfill({ json: post }));
  await page.route(/\/api\/posts\/post-1\/matches(?:\?.*)?$/, route => route.fulfill({ json: {
    source: post, matcherVersion: "rule-v2-explainable", calculatedAt: null,
    thresholds: { weak: 0.45, suggestion: 0.6, notification: 0.75, highConfidence: 0.85 },
    weights: { text: 0.3, category: 0.2, location: 0.15, time: 0.1, image: 0.15, ocr: 0.1 },
    results: [], total: 0, page: 1, pageSize: 20, hasMore: false
  } }));
  await page.route("**/api/staff/custody-requests/custody-1", route => route.fulfill({ json: {
    request: { id: "custody-1", post: { title: post.title }, status: "INTAKED", handoverPoint: null, confirmedHandoverAt: null }, audit: []
  } }));
  await page.goto("/notifications");
  await expect(page.locator(".notifications-page__item")).toBeVisible();
  return { reads, errors };
}

for (const surface of ["bell", "page"] as const) {
  for (const destination of destinations) {
    test(`${surface} opens the ${destination.entityType} destination and marks it read`, async ({ page }) => {
      const { reads, errors } = await prepare(page, notification(destination.entityType, destination.entityId));
      if (surface === "bell") await page.getByRole("button", { name: "Thông báo", exact: true }).click();
      await page.locator(surface === "bell" ? ".notification-item" : ".notifications-page__item").click();
      await expect(page).toHaveURL(url => `${url.pathname}${url.search}` === destination.path);
      await expect(page.locator(".notification-popover")).toHaveCount(0);
      await expect.poll(() => reads.length).toBe(1);
      if (destination.entityType === "POST_MATCH") {
        await expect(page.locator(".matches-empty")).toBeVisible();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
      if (destination.entityType === "POST") await expect(page.getByRole("heading", { name: post.title, exact: true })).toBeVisible();
      if (["CLAIM", "APPOINTMENT", "APPOINTMENT_REMINDER"].includes(destination.entityType)) {
        await expect(page.getByText("Test destination unavailable", { exact: true })).toBeVisible();
      }
      if (destination.entityType === "CUSTODY_REQUEST") {
        await expect(page.getByRole("dialog", { name: "Yêu cầu bàn giao custody" })).toBeVisible();
        await expect(page.getByRole("dialog").getByText(post.title)).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [320, 390, 768]) {
  test(`mobile bell opens matching results at ${width}px without clipping`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const { reads } = await prepare(page);
    await page.getByRole("button", { name: "Thông báo", exact: true }).click();
    await expect.poll(() => page.locator(".notification-popover").evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= window.innerWidth && bounds.top >= 0 && bounds.bottom <= window.innerHeight;
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("notification-bell-mobile.png") });
    await page.locator(".notification-item").click();
    await expect(page).toHaveURL(/\/posts\/post-1\/matches$/);
    await expect(page.locator(".matches-empty")).toBeVisible();
    await expect.poll(() => reads.length).toBe(1);
  });
}

test("matching toast opens the same destination without waiting for read acknowledgement", async ({ page }) => {
  const { errors } = await prepare(page);
  const item = { ...notification("POST_MATCH", "post-1"), id: "notification-2" };
  await page.route(/\/api\/notifications(?:\?.*)?$/, route => route.fulfill({ json: { items: [item], unreadTotal: 2 } }));
  let finishRead: (() => void) | undefined;
  const readPending = new Promise<void>(resolve => { finishRead = resolve; });
  let readStarted = false;
  await page.route("**/api/notifications/notification-2/read", async route => {
    readStarted = true;
    await readPending;
    await route.fulfill({ status: 503, json: { error: "unavailable", message: "Read acknowledgement unavailable" } });
  });
  try {
    const toast = page.locator(".notification-toast__content");
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await toast.click();
    await expect(page).toHaveURL(/\/posts\/post-1\/matches$/);
    await expect(page.locator(".notification-toast")).toHaveCount(0);
    await expect(page.locator(".matches-empty")).toBeVisible();
    await expect.poll(() => readStarted).toBe(true);
  } finally {
    finishRead?.();
  }
  expect(errors).toEqual([]);
});

for (const missingTarget of [notification("UNKNOWN", "unknown-1"), notification("POST_MATCH", null)]) {
  test(`bell falls back to the notification page for ${missingTarget.entityType}/${missingTarget.entityId}`, async ({ page }) => {
    const { reads } = await prepare(page, missingTarget);
    await page.goto("/profile");
    await page.getByRole("button", { name: "Thông báo", exact: true }).click();
    await page.locator(".notification-item").click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.locator(".notifications-page__item")).toBeVisible();
    await expect.poll(() => reads.length).toBe(1);
  });
}
