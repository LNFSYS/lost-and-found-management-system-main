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

async function openHome(page: Page) {
  await page.route("**/api/auth/refresh", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) }));
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: /Một món đồ thất lạc/i })).toBeVisible();
}

test("renders the protected storytelling home with a nonblank WebGL scene", async ({ page }) => {
  await openHome(page);
  await expect(page.locator(".story-thread-layer")).toHaveCount(0);
  await expect(page.locator(".thread-spool")).toHaveCount(0);
  await expect(page.locator(".story-stage-marker")).toHaveCount(7);
  await expect(page.locator(".story-connector")).toHaveCount(6);
  expect(await page.locator(".story-connector").evaluateAll((connectors) => connectors.every((connector) => {
    const position = getComputedStyle(connector).position;
    return position !== "fixed" && position !== "sticky";
  }))).toBe(true);
  const canvas = page.locator(".journey-scene canvas");
  await expect(canvas).toBeVisible();
  await expect.poll(async () => canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement;
    if (target.width === 0 || target.height === 0) return 0;
    const sample = document.createElement("canvas");
    sample.width = 32;
    sample.height = 32;
    const context = sample.getContext("2d");
    if (!context) return 0;
    context.drawImage(target, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let coloredPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 0 && pixels[index] + pixels[index + 1] + pixels[index + 2] > 24) coloredPixels += 1;
    }
    return coloredPixels;
  })).toBeGreaterThan(20);
  await page.screenshot({ path: "../../test-results/home/home-desktop-top.png" });

  for (const stageId of ["#two-sides", "#quick-story", "#system-analysis", "#matching-search"]) {
    await page.locator(stageId).scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
  }

  const scanLine = page.locator(".scan-line");
  await expect(scanLine).toBeVisible();
  const scanTopBefore = await scanLine.evaluate((element) => getComputedStyle(element).top);
  await page.waitForTimeout(650);
  const scanTopAfter = await scanLine.evaluate((element) => getComputedStyle(element).top);
  expect(scanTopAfter).not.toBe(scanTopBefore);
  await expect(page.getByText("Chuẩn hóa thông tin")).toBeVisible();

  for (const stageId of ["#potential-match", "#human-review", "#handover"]) {
    await page.locator(stageId).scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
  }

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
  await expect(page.getByText("Human verification required")).toBeVisible();
  await page.screenshot({ path: "../../test-results/home/home-desktop.png", fullPage: true });
});

test("keeps the story readable without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  await expect(page.getByRole("button", { name: /Tôi bị mất đồ/i }).first()).toBeVisible();
  for (const stageId of ["#two-sides", "#quick-story", "#system-analysis", "#matching-search", "#potential-match", "#human-review", "#handover"]) {
    await page.locator(stageId).scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
  }
  for (let index = 0; index < 6; index += 1) {
    await page.locator(".story-connector").nth(index).scrollIntoViewIfNeeded();
    await page.waitForTimeout(80);
  }
  await expect(page.locator(".story-connector-mobile").first()).toBeVisible();
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  await page.screenshot({ path: "../../test-results/home/home-mobile.png", fullPage: true });
});
