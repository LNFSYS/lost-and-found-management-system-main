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
  await expect(page.getByRole("heading", { level: 1, name: /Đồ thất lạc/i })).toBeVisible();
}

test("renders the protected storytelling home with a campus hero image", async ({ page }) => {
  await openHome(page);
  await expect(page.locator(".story-thread-layer")).toHaveCount(0);
  await expect(page.locator(".thread-spool")).toHaveCount(0);
  await expect(page.locator(".story-stage-marker")).toHaveCount(7);
  await expect(page.locator(".story-connector")).toHaveCount(6);
  expect(await page.locator(".story-connector").evaluateAll((connectors) => connectors.every((connector) => {
    const position = getComputedStyle(connector).position;
    return position !== "fixed" && position !== "sticky";
  }))).toBe(true);
  const campusImage = page.getByRole("img", { name: /FPT University Đà Nẵng campus/i });
  await expect(campusImage).toBeVisible();
  await expect.poll(() => campusImage.evaluate((element) => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 400 && image.naturalHeight > 250;
  })).toBe(true);
  await expect(page.locator(".hero-campus-photo")).toBeVisible();
  await expect(page.locator(".floating-status")).toHaveCount(0);
  await expect(page.locator(".campus-card")).toHaveCount(0);
  await expect(page.locator(".hero-workflow")).toBeVisible();
  await expect(page.locator(".hero-workflow span")).toHaveCount(3);
  await page.screenshot({ path: "../../test-results/home/home-desktop-top.png" });

  for (const stageId of ["#two-sides", "#quick-story", "#system-analysis", "#matching-search"]) {
    await page.locator(stageId).scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
  }

  await expect(page.locator(".scan-line")).toHaveCount(0);
  await expect(page.locator(".scan-board .workflow-no-candidates")).toBeVisible();
  await expect(page.getByText("Chuẩn hóa thông tin")).toBeVisible();

  for (const stageId of ["#potential-match", "#human-review", "#handover"]) {
    await page.locator(stageId).scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
  }

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
  await expect(page.locator("#human-review .review-status")).toBeVisible();
  await expect(page.locator("#human-review .review-sheet")).toContainText("PHÒNG TRAO ĐỔI RIÊNG");
  await page.screenshot({ path: "../../test-results/home/home-desktop.png", fullPage: true });
});

test("keeps the story readable without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  await expect(page.getByRole("button", { name: /Báo mất đồ/i }).first()).toBeVisible();
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
