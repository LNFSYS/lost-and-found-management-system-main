import { expect, test, type Page } from "@playwright/test";

const session = {
  accessToken: "admin-access-token",
  accessTokenExpiresIn: "15m",
  user: {
    id: "admin-1",
    email: "admin@example.com",
    fullName: "Admin Demo",
    studentCode: null,
    phoneNumber: null,
    roles: ["USER", "ADMIN"],
    status: "ACTIVE",
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z"
  }
};

const point = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Quầy Alpha",
  address: "Sảnh tòa Alpha",
  areaId: "11111111-1111-4111-8111-111111111111",
  areaName: "Khu Alpha",
  buildingId: "22222222-2222-4222-8222-222222222222",
  buildingName: "Tòa Alpha",
  openingHours: "08:00 - 17:30",
  contactInfo: "Phòng CTSV",
  mapImageUrl: null,
  mapPositionX: 42,
  mapPositionY: 58,
  isActive: true,
  storedItems: 7,
  activeAppointments: 1,
  createdAt: "2026-08-26T00:00:00.000Z"
};

const catalog = {
  stats: { totalPosts: 12, processingPosts: 5, totalUsers: 8, returnedPosts: 3 },
  categories: [],
  areas: [{ id: point.areaId, name: "Khu Alpha", description: "Khối học tập", isActive: true, sortOrder: 0, buildingCount: 1, createdAt: point.createdAt }],
  buildings: [{ id: point.buildingId, areaId: point.areaId, areaName: "Khu Alpha", name: "Tòa Alpha", isActive: true, sortOrder: 0, createdAt: point.createdAt }],
  handoverPoints: [point]
};

async function prepare(page: Page, calls: { created?: any; uploaded?: boolean; deleted?: boolean }) {
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) }));
  await page.route("**/api/admin/catalog", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(catalog) }));
  await page.route("**/api/admin/handover-points", async (route) => {
    calls.created = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ...point, id: "new-point", activeAppointments: 0 }) });
  });
  await page.route(/\/api\/admin\/handover-points\/[^/]+\/map-image$/, async (route) => {
    calls.uploaded = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...point, id: "new-point" }) });
  });
  await page.route(/\/api\/admin\/handover-points\/[^/]+$/, async (route) => {
    if (route.request().method() === "DELETE") {
      calls.deleted = true;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...point, isActive: false }) });
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Điểm bàn giao" }).click();
}

test("admin creates a mapped handover point and uploads a campus image", async ({ page }) => {
  const calls: { created?: any; uploaded?: boolean } = {};
  await prepare(page, calls);

  await expect(page.getByText("Quầy Alpha")).toBeVisible();
  await expect(page.getByText("7 vật phẩm")).toBeVisible();
  await page.getByLabel("Tên điểm bàn giao").fill("Quầy thư viện");
  await page.getByLabel("Địa chỉ").fill("Tầng 1 thư viện");
  await page.getByLabel("Khu vực").selectOption(point.areaId);
  await page.getByLabel("Địa điểm cụ thể").selectOption(point.buildingId);
  await page.getByLabel("Tọa độ X (%)").fill("63.5");
  await page.getByLabel("Tọa độ Y (%)").fill("41.25");
  await page.locator(".handover-map-upload input").setInputFiles({
    name: "campus.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB", "base64")
  });
  await page.getByRole("button", { name: "Tạo điểm bàn giao" }).click();

  await expect(page.getByText("Đã tạo điểm bàn giao")).toBeVisible();
  expect(calls.created?.name).toBe("Quầy thư viện");
  expect(calls.created?.areaId).toBe(point.areaId);
  expect(calls.created?.buildingId).toBe(point.buildingId);
  expect(calls.created?.mapPositionX).toBe(63.5);
  expect(calls.created?.mapPositionY).toBe(41.25);
  expect(calls.uploaded).toBe(true);
});

test("admin UI prevents hard delete when an active appointment uses the point", async ({ page }) => {
  const calls: { deleted?: boolean } = {};
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, calls);

  await page.getByRole("button", { name: "Xóa Quầy Alpha" }).click();
  await expect(page.getByRole("alert")).toContainText("1 lịch hẹn hoạt động");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(calls.deleted).not.toBe(true);
});
