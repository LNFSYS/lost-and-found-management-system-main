import { expect, test, type Page } from "@playwright/test";

const staffSession = {
  accessToken: "staff-access-token",
  accessTokenExpiresIn: "15m",
  user: {
    id: "staff-1",
    email: "staff@example.com",
    fullName: "Staff Demo",
    studentCode: null,
    phoneNumber: null,
    roles: ["USER", "STAFF"],
    status: "ACTIVE",
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z"
  }
};

const catalog = {
  categories: [
    { id: "cat-parent", name: "Giấy tờ", parentId: null },
    { id: "cat-card", name: "Thẻ sinh viên", parentId: "cat-parent" }
  ],
  areas: [{ id: "area-1", name: "Khu Alpha" }],
  buildings: [{ id: "building-1", areaId: "area-1", name: "Sảnh A" }],
  handoverPoints: [{ id: "hp-1", name: "Quầy dịch vụ", address: "Tầng 1", openingHours: "08:00-17:00" }]
};

const item = {
  id: "item-1",
  postId: null,
  handoverPoint: { id: "hp-1", name: "Quầy dịch vụ", address: "Tầng 1" },
  itemName: "Ví da màu nâu",
  description: "Có thẻ sinh viên bên trong",
  category: { id: "cat-card", name: "Thẻ sinh viên" },
  location: { area: { id: "area-1", name: "Khu Alpha" }, building: { id: "building-1", name: "Sảnh A" }, roomText: "Sảnh tầng 1" },
  finder: { userId: null, userName: null, name: "Nguyễn An", contact: "an@example.com" },
  status: "RECEIVED",
  conditionNotes: "Còn tốt",
  storageCode: null,
  receivedAt: "2026-08-23T09:00:00.000Z",
  returnedAt: null,
  retentionDeadline: "2026-10-22T09:00:00.000Z",
  createdBy: { id: "staff-1", fullName: "Staff Demo" },
  createdAt: "2026-08-23T09:00:00.000Z",
  updatedAt: "2026-08-23T09:00:00.000Z",
  logCount: 1
};

function dashboard() {
  return {
    stats: { totalItems: 1, activeItems: 1, receivedItems: 1, storedItems: 0, returnedItems: 0, overdueItems: 0 },
    handoverCounts: [{ handoverPointId: "hp-1", name: "Quầy dịch vụ", address: "Tầng 1", itemCount: 1, storedCount: 0, overdueCount: 0 }],
    total: 1,
    page: 1,
    pageSize: 12,
    items: [item]
  };
}

async function prepare(page: Page, calls: { created?: unknown; patched?: unknown }) {
  await page.route(/\/api\/staff\/custody-requests(?:\?.*)?$/, route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20, counts: { PENDING: 0, ACCEPTED: 0, INTAKED: 0, REJECTED: 0, CANCELLED: 0 } }) }));
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(staffSession) }));
  await page.route("**/api/staff/warehouse-items/catalog", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(catalog) }));
  await page.route(/\/api\/staff\/warehouse-items(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "POST") {
      calls.created = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ...item, id: "item-created", itemName: "Thẻ sinh viên", conditionNotes: "Nguyên vẹn", retentionDeadline: "2026-12-21T09:00:00.000Z" })
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dashboard()) });
  });
  await page.route(/\/api\/staff\/warehouse-items\/(?!catalog$)[^/]+$/, async (route) => {
    calls.patched = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...item, status: "STORED", storageCode: "A1-04", logCount: 2 })
    });
  });
  await page.route(/\/api\/staff\/warehouse-items\/[^/]+\/logs$/, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      logs: [{
        id: "log-1",
        warehouseItemId: "item-1",
        postId: null,
        handoverPoint: { id: "hp-1", name: "Quầy dịch vụ" },
        actor: { id: "staff-1", fullName: "Staff Demo" },
        action: "STORED",
        fromStatus: "RECEIVED",
        toStatus: "STORED",
        conditionNotes: "Còn tốt",
        storageCode: "A1-04",
        note: "Move to shelf",
        createdAt: "2026-08-23T10:00:00.000Z"
      }]
    })
  }));
}

test("staff can see warehouse counts and receive an item with condition notes", async ({ page }) => {
  const calls: { created?: any } = {};
  await prepare(page, calls);
  await page.goto("/staff");

  await expect(page.getByRole("heading", { name: "Tiếp nhận & Quản lý Custody" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hàng đợi Custody" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Tiếp nhận Walk-in (Tại quầy)", exact: true }).click();

  const receive = page.locator(".custody-modal");
  await receive.getByLabel("Tên vật phẩm").fill("Thẻ sinh viên");
  await receive.getByLabel("Tình trạng khi nhận").fill("Nguyên vẹn");
  await receive.getByLabel("Danh mục").selectOption("cat-card");
  await receive.getByRole("button", { name: "Tạo hồ sơ kho (Walk-in)" }).click();

  await expect(page.getByText("Đã tiếp nhận vật phẩm thành công (Walk-in)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đã hiểu & Đóng" }).click();
  await page.getByRole("button", { name: "Kho tài sản", exact: true }).click();
  await expect(page.getByText("Ví da màu nâu", { exact: true })).toBeVisible();
  expect(calls.created?.itemName).toBe("Thẻ sinh viên");
  expect(calls.created?.conditionNotes).toBe("Nguyên vẹn");
  expect(calls.created?.handoverPointId).toBe("hp-1");
});

test("staff can open storage logs and update item state", async ({ page }) => {
  const calls: { patched?: any } = {};
  await prepare(page, calls);
  await page.goto("/staff");

  await page.getByRole("button", { name: "Kho tài sản", exact: true }).click();
  await page.getByRole("button", { name: "Chi tiết & Nhật ký" }).click();
  const detail = page.locator(".warehouse-detail-panel");
  await expect(detail.getByText("Move to shelf", { exact: false })).toBeVisible();
  await detail.getByRole("button", { name: "Cập nhật trạng thái" }).click();
  const update = page.locator(".custody-modal");
  await update.getByLabel("Trạng thái").selectOption("STORED");
  await update.getByLabel("Mã vị trí lưu kho").fill("A1-04");
  await update.getByLabel("Ghi chú").fill("Move to shelf");
  await update.getByRole("button", { name: "Lưu trạng thái mới" }).click();

  await expect(page.getByText("Đã cập nhật trạng thái vật phẩm kho thành công", { exact: true })).toBeVisible();
  expect(calls.patched?.status).toBe("STORED");
  expect(calls.patched?.storageCode).toBe("A1-04");
  expect(calls.patched?.note).toBe("Move to shelf");
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`staff server pagination and filtering at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepare(page, {});
    const queries: string[] = [];
    await page.route(/\/api\/staff\/custody-requests(?:\?.*)?$/, route => {
      const url = new URL(route.request().url());
      queries.push(url.search);
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const status = url.searchParams.get("status") ?? "PENDING";
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ page: pageNumber, pageSize: 20, total: 21,
        counts: { PENDING: 20, ACCEPTED: 1, INTAKED: 0, REJECTED: 0, CANCELLED: 0 },
        items: [{ id: `request-${pageNumber}`, postId: "post-1", post: { id: "post-1", title: `Item page ${pageNumber}` }, claimId: null, roomId: null,
          status, intakeType: "CUSTODY_TRANSFER", reason: "Fixture", requester: { id: "finder-1", fullName: "Finder" }, handler: null,
          handoverPoint: catalog.handoverPoints[0], confirmedHandoverAt: null, warehouseItemId: null, rejectionReason: null,
          createdAt: "2026-10-01T09:00:00Z", updatedAt: "2026-10-01T09:00:00Z" }] }) });
    });
    await page.goto("/staff");
    await expect(page.getByText("Item page 1", { exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Phân trang" }).getByRole("button", { name: "Sau", exact: true }).click();
    await expect(page.getByText("Item page 2", { exact: true })).toBeVisible();
    expect(queries.some(query => new URLSearchParams(query).get("page") === "2")).toBeTruthy();
    await page.getByRole("button", { name: "Chờ bàn giao (1)", exact: true }).click();
    await expect(page.getByText("Item page 1", { exact: true })).toBeVisible();
    expect(queries.some(query => new URLSearchParams(query).get("status") === "ACCEPTED" && new URLSearchParams(query).get("page") === "1")).toBeTruthy();
    await page.evaluate(() => window.scrollTo(0, 0));
    const headerBox = await page.locator(".topbar").boundingBox();
    const headingBox = await page.getByRole("heading", { name: "Tiếp nhận & Quản lý Custody" }).boundingBox();
    expect(headingBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
    await page.screenshot({ path: testInfo.outputPath(`staff-${viewport.width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
    await page.getByRole("button", { name: "Kho tài sản", exact: true }).click();
    await expect(page.getByText("Ví da màu nâu", { exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`warehouse-${viewport.width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
    const warehouseQueries: string[] = [];
    await page.route(/\/api\/staff\/warehouse-items(?:\?.*)?$/, route => {
      const url = new URL(route.request().url());
      warehouseQueries.push(url.search);
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...dashboard(), total: 13, page: pageNumber,
        items: [{ ...item, id: `item-page-${pageNumber}`, itemName: `Warehouse page ${pageNumber}` }] }) });
    });
    await page.getByRole("button", { name: "Lọc", exact: true }).click();
    await expect(page.getByText("Warehouse page 1", { exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Phân trang" }).getByRole("button", { name: "Sau", exact: true }).click();
    await expect(page.getByText("Warehouse page 2", { exact: true })).toBeVisible();
    expect(warehouseQueries.some(query => new URLSearchParams(query).get("page") === "2")).toBeTruthy();
    await page.getByRole("combobox", { name: "Trạng thái", exact: true }).selectOption("STORED");
    await page.getByRole("button", { name: "Lọc", exact: true }).click();
    await expect(page.getByText("Warehouse page 1", { exact: true })).toBeVisible();
    expect(warehouseQueries.some(query => new URLSearchParams(query).get("status") === "STORED" && new URLSearchParams(query).get("page") === "1")).toBeTruthy();
  });
}
