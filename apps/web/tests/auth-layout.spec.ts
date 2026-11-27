import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ status: 401, json: { message: "No session" } }));
});

test("registration uses the same card and sidebar styling as login", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const measure = () => page.evaluate(() => {
    const card = getComputedStyle(document.querySelector(".auth-card")!);
    const aside = getComputedStyle(document.querySelector(".auth-aside")!);
    const form = getComputedStyle(document.querySelector(".form-stack")!);
    return { width: card.width, padding: card.padding, asidePadding: aside.padding,
      columns: getComputedStyle(document.querySelector(".auth-page")!).gridTemplateColumns, gap: form.gap };
  });
  await page.goto("/login");
  const login = await measure();
  await page.goto("/register");
  expect(await measure()).toEqual(login);
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
  expect(layout.panelScroll).toBeLessThanOrEqual(1);
  expect(layout.headingTop).toBeGreaterThan(300);
});

test("registration stays readable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register");
  const submit = page.getByRole("button", { name: "Tạo tài khoản" });
  await submit.evaluate(element => element.scrollIntoView({ block: "center" }));
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

for (const viewport of [{ width: 1536, height: 700 }, { width: 1280, height: 640 }, { width: 960, height: 600 }]) {
  test(`registration retains one column and reachable fields at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/register");
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth,
      cardTop: document.querySelector(".auth-card")!.getBoundingClientRect().top
    }));
    expect(geometry.width).toBeLessThanOrEqual(viewport.width);
    expect(geometry.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: `../../test-results/home/register-${viewport.width}.png` });
    expect(geometry.cardTop).toBeGreaterThanOrEqual(0);
    const password = page.getByLabel("Mật khẩu");
    const role = page.getByLabel("Vai trò sử dụng");
    const passwordBox = await password.boundingBox();
    const roleBox = await role.boundingBox();
    expect(roleBox!.y).toBeGreaterThan(passwordBox!.y + passwordBox!.height);
    await page.getByRole("button", { name: "Tạo tài khoản" }).evaluate(element => element.scrollIntoView({ block: "center" }));
    await expect(page.getByRole("button", { name: "Tạo tài khoản" })).toBeInViewport({ ratio: 1 });
  });
}

test("extreme zoom sized viewport keeps the whole form reachable", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 350 });
  await page.goto("/register");
  await page.getByRole("heading", { name: "Bắt đầu với email của bạn" }).evaluate(element => element.scrollIntoView({ block: "center" }));
  await expect(page.getByRole("heading", { name: "Bắt đầu với email của bạn" })).toBeInViewport();
  await page.getByRole("button", { name: "Tạo tài khoản" }).evaluate(element => element.scrollIntoView({ block: "center" }));
  await expect(page.getByRole("button", { name: "Tạo tài khoản" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
