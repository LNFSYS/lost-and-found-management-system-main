import { expect, test, type Page } from "@playwright/test";

const session = {
  accessToken: "pwa-access-token",
  accessTokenExpiresIn: "15m",
  user: {
    id: "user-pwa",
    email: "pwa@example.com",
    fullName: "PWA Tester",
    studentCode: "SE123456",
    phoneNumber: null,
    roles: ["USER", "STUDENT"],
    status: "ACTIVE",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z"
  }
};

const catalog = {
  categories: [
    { id: "category-parent", name: "Electronics", parentId: null },
    { id: "category-phone", name: "Phone", parentId: "category-parent" }
  ],
  areas: [{ id: "area-alpha", name: "Alpha" }],
  buildings: [{ id: "building-alpha", areaId: "area-alpha", name: "Alpha Hall" }],
  handoverPoints: []
};

const boardPost = {
  id: "post-pwa",
  type: "LOST",
  status: "OPEN",
  visibilityMode: "PUBLIC",
  title: "Lost iPhone",
  description: "Black iPhone with a blue case.",
  category: { id: "category-phone", name: "Phone", icon: null },
  location: { area: catalog.areas[0], building: catalog.buildings[0], roomText: "Lobby", customLocation: null },
  handoverPoint: null,
  lostFoundAt: "2026-09-01T08:30:00.000Z",
  owner: { id: "owner-1", fullName: "Board Owner" },
  media: [],
  canEdit: false,
  createdAt: "2026-09-01T09:00:00.000Z"
};

async function mockSessionAndPosts(page: Page) {
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) }));
  await page.route("**/api/posts/catalog", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(catalog) }));
  await page.route(/\/api\/posts(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ total: 1, page: 1, pageSize: 9, items: [boardPost] })
  }));
  await page.route(/\/api\/posts\/mine(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ total: 0, page: 1, pageSize: 9, items: [] })
  }));
}

test("PWA manifest is installable and the service worker registers", async ({ page, request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("FPTU Lost & Found");
  expect(manifest.start_url).toBe("/home");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThan(0);

  const workerSource = await (await request.get("/sw.js")).text();
  expect(workerSource).toContain("hasAuthorization");
  expect(workerSource).toContain("isMutation(request)");
  expect(workerSource).toContain("/api/admin");
  expect(workerSource).toContain("/media/");

  await page.goto("/login");
  const scope = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return null;
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(scope).toContain("/");
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 820, height: 1100 },
  { name: "mobile", width: 390, height: 844 }
]) {
  test(`public board remains usable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockSessionAndPosts(page);
    await page.goto("/posts");

    await expect(page.locator(".posts-create")).toBeVisible();
    await expect(page.locator(".posts-toolbar")).toBeVisible();
    await expect(page.locator(".post-card")).toBeVisible();
    await page.locator(".posts-search input").fill("iPhone");
    await page.locator(".posts-search button").click();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("offline post creation clearly stays unsent", async ({ page, context }) => {
  await mockSessionAndPosts(page);
  await page.goto("/home");
  await page.locator("#quick-story").scrollIntoViewIfNeeded();

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));

  await expect(page.locator(".offline-banner")).toBeVisible();
  await expect(page.locator(".story-form-message.is-warning")).toBeVisible();
  await expect(page.locator(".story-post-form button[type=submit]")).toBeDisabled();
  await context.setOffline(false);
});
