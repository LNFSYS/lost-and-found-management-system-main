import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ status: 401, json: { message: "No session" } }));
});

test("registration fits a desktop viewport without an inner scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/register");
  await expect(page.getByRole("button", { name: "Tạo tài khoản" })).toBeVisible();
  await page.screenshot({ path: "../../test-results/home/register-desktop.png" });

  const layout = await page.evaluate(() => {
    const panel = document.querySelector(".auth-panel")!;
    const card = document.querySelector(".auth-card")!.getBoundingClientRect();
    const heading = document.querySelector(".auth-aside h1")!.getBoundingClientRect();
    return {
      pageHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      panelScroll: panel.scrollHeight - panel.clientHeight,
      cardBottom: card.bottom,
      headingTop: heading.top
    };
  });
  expect(layout.pageHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.panelScroll).toBeLessThanOrEqual(1);
  expect(layout.cardBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.headingTop).toBeGreaterThan(300);
});

test("registration stays readable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register");
  const submit = page.getByRole("button", { name: "Tạo tài khoản" });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeVisible();
  await page.screenshot({ path: "../../test-results/home/register-mobile.png", fullPage: true });
  const layout = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    panelOverflow: getComputedStyle(document.querySelector(".auth-panel")!).overflowY
  }));
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.panelOverflow).not.toBe("auto");
});
