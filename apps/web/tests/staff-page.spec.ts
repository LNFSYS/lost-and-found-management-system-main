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
    { id: "cat-parent", name: "Giay to", parentId: null },
    { id: "cat-card", name: "The sinh vien", parentId: "cat-parent" }
  ],
  areas: [{ id: "area-1", name: "Khu Alpha" }],
  buildings: [{ id: "building-1", areaId: "area-1", name: "Sanh A" }],
  handoverPoints: [{ id: "hp-1", name: "Quay dich vu", address: "Tang 1", openingHours: "08:00-17:00" }]
};

const item = {
  id: "item-1",
  postId: null,
  handoverPoint: { id: "hp-1", name: "Quay dich vu", address: "Tang 1" },
  itemName: "Vi da mau nau",
  description: "Co the sinh vien ben trong",
  category: { id: "cat-card", name: "The sinh vien" },
  location: { area: { id: "area-1", name: "Khu Alpha" }, building: { id: "building-1", name: "Sanh A" }, roomText: "Sanh tang 1" },
  finder: { userId: null, userName: null, name: "Nguyen An", contact: "an@example.com" },
  status: "RECEIVED",
  conditionNotes: "Con tot",
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
    handoverCounts: [{ handoverPointId: "hp-1", name: "Quay dich vu", address: "Tang 1", itemCount: 1, storedCount: 0, overdueCount: 0 }],
    total: 1,
    page: 1,
    pageSize: 12,
    items: [item]
  };
}

async function prepare(page: Page, calls: { created?: unknown; patched?: unknown }) {
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(staffSession) }));
  await page.route("**/api/staff/warehouse-items/catalog", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(catalog) }));
  await page.route(/\/api\/staff\/warehouse-items(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "POST") {
      calls.created = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ...item, id: "item-created", itemName: "The sinh vien", conditionNotes: "Nguyen ven", retentionDeadline: "2026-12-21T09:00:00.000Z" })
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
        handoverPoint: { id: "hp-1", name: "Quay dich vu" },
        actor: { id: "staff-1", fullName: "Staff Demo" },
        action: "STORED",
        fromStatus: "RECEIVED",
        toStatus: "STORED",
        conditionNotes: "Con tot",
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

  await expect(page.getByRole("heading", { name: "Kho noi bo" })).toBeVisible();
  await expect(page.getByText("Vi da mau nau")).toBeVisible();
  await expect(page.locator(".warehouse-counts").getByText("Quay dich vu")).toBeVisible();

  const receive = page.locator(".warehouse-receive-panel");
  await receive.getByLabel("Ten vat pham").fill("The sinh vien");
  await receive.getByLabel("Tinh trang khi nhan").fill("Nguyen ven");
  await receive.getByLabel("Danh muc").selectOption("cat-card");
  await receive.getByRole("button", { name: "Tiep nhan" }).click();

  await expect(page.getByText("Da tiep nhan vat pham")).toBeVisible();
  expect(calls.created?.itemName).toBe("The sinh vien");
  expect(calls.created?.conditionNotes).toBe("Nguyen ven");
  expect(calls.created?.handoverPointId).toBe("hp-1");
});

test("staff can open storage logs and update item state", async ({ page }) => {
  const calls: { patched?: any } = {};
  await prepare(page, calls);
  await page.goto("/staff");

  await page.getByRole("button", { name: "Chon" }).click();
  const detail = page.locator(".warehouse-detail-panel");
  await expect(detail.getByText("Da tiep nhan -> Dang luu kho")).toBeVisible();
  await detail.getByLabel("Ma luu kho").fill("A1-04");
  await detail.getByLabel("Ghi chu log").fill("Move to shelf");
  await detail.getByRole("button", { name: "Luu trang thai" }).click();

  await expect(page.getByText("Da cap nhat trang thai kho")).toBeVisible();
  expect(calls.patched?.status).toBe("STORED");
  expect(calls.patched?.storageCode).toBe("A1-04");
  expect(calls.patched?.note).toBe("Move to shelf");
});
