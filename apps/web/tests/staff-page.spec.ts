import { expect, test, type Page } from "@playwright/test";
const photoBuffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMioAAAAASUVORK5CYII=", "base64");
const intakePhoto = { name: "condition.png", mimeType: "image/png", buffer: photoBuffer };

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
  await page.route("**/api/staff/warehouse-intake-images", route => route.fulfill({ json: { id: "intake-photo", url: "/staff/warehouse-images/intake-photo?provenance=INTAKE" } }));
  await page.route("**/api/staff/warehouse-images/**", route => route.fulfill({ contentType: "image/png", body: photoBuffer }));
  await page.route("**/api/staff/warehouse-items/*/images", route => route.fulfill({ json: { images: [] } }));
  await page.route("**/api/staff/warehouse-items/*/return-claim-reviews", route => route.fulfill({ json: { claims: [] } }));
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
  await receive.getByLabel("Phụ kiện thực nhận").fill("Không có");
  await receive.getByLabel("Ảnh tình trạng tiếp nhận", { exact: true }).setInputFiles(intakePhoto);
  await expect(receive.getByText("Ảnh tình trạng tiếp nhận * (1/5)")).toBeVisible();
  await receive.getByLabel("Tôi đã đối chiếu vật phẩm, số lượng, phụ kiện và ảnh tình trạng tại quầy.").check();
  await receive.getByRole("button", { name: "Tạo hồ sơ kho (Walk-in)" }).click();

  await expect(page.getByText("Đã tiếp nhận thực tế, chưa lưu kho.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đã hiểu & Đóng" }).click();
  await page.getByRole("button", { name: "Kho tài sản", exact: true }).click();
  await expect(page.getByText("Ví da màu nâu", { exact: true })).toBeVisible();
  expect(calls.created?.itemName).toBe("Thẻ sinh viên");
  expect(calls.created?.conditionNotes).toBe("Nguyên vẹn");
  expect(calls.created?.handoverPointId).toBe("hp-1");
  expect(calls.created?.intakeImageIds).toEqual(["intake-photo"]);
  expect(calls.created?.receivedQuantity).toBe(1);
});

for (const width of [1440,390]) {
  test(`custody physical reconciliation retains source and receives pending/legacy request at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await prepare(page, {});
    let receives = 0;
    const request = { id: "request-1", postId: "post-1", post: { id: "post-1", title: "Thẻ sinh viên", thumbnailId: "source-photo" },
      status: width === 1440 ? "PENDING" : "ACCEPTED", intakeType: "CUSTODY_TRANSFER", requester: { id: "finder", fullName: "Finder" },
      handler: null, handoverPoint: catalog.handoverPoints[0], claimId: null, roomId: null, reason: null, rejectionReason: null,
      warehouseItemId: null, confirmedHandoverAt: null, createdAt: "2026-10-04T09:00:00Z", updatedAt: "2026-10-04T09:00:00Z" };
    await page.route(/\/api\/staff\/custody-requests(?:\?.*)?$/, route => route.fulfill({ json: { items: [request], total: 1, page: 1, pageSize: 20, counts: { PENDING: 1, ACCEPTED: 0, INTAKED: 0, REJECTED: 0, CANCELLED: 0 } } }));
    await page.route("**/api/staff/custody-requests/*/intake-context", route => route.fulfill({ json: { request,
      post: { title: "Thẻ sinh viên", description: "Bài gốc còn nguyên", categoryId: "cat-card", areaId: "area-1", buildingId: "building-1", roomText: "Sảnh", finderName: "Finder", finderContact: "finder@example.com", finderUserId: "finder" },
      images: [{ id: "source-photo", provenance: "SOURCE_POST", uploadedAt: "2026-10-04T09:00:00Z", capturedAt: null }] } }));
    await page.route("**/api/staff/custody-requests/*/intake", route => {
      receives++;
      const body = route.request().postDataJSON();
      expect(body.itemName).toBe("Thẻ sinh viên tại quầy");
      expect(body.intakeImageIds).toEqual(["intake-photo"]);
      expect(body.receivedQuantity).toBe(2);
      return route.fulfill({ json: { ...request, status: "INTAKED", warehouseItemId: "new-item" } });
    });
    await page.route("**/api/posts/analyze-image", route => route.fulfill({ status: 503, json: { message: "AI chưa sẵn sàng" } }));
    await page.goto("/staff");
    await page.getByRole("button", { name: "Tiếp nhận vật phẩm", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Đối chiếu và tiếp nhận vật phẩm" });
    await expect(modal.locator(".intake-source").getByText("Bài gốc còn nguyên", { exact: true })).toBeVisible();
    await modal.locator(".intake-source").getByRole("button", { name: "Xem ảnh vật phẩm", exact: true }).click();
    const zoom = page.getByRole("dialog", { name: "Ảnh vật phẩm", exact: true });
    await expect(zoom.getByAltText("Ảnh vật phẩm phóng to")).toBeVisible();
    expect(await zoom.getByAltText("Ảnh vật phẩm phóng to").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(zoom).toHaveCount(0);
    await expect(modal).toBeVisible();
    expect(receives).toBe(0);
    await modal.getByRole("button", { name: "Xác nhận tiếp nhận", exact: true }).click();
    await expect(modal.getByText("Cần từ 1 đến 5 ảnh tình trạng do Staff tải lên.", { exact: true })).toBeVisible();
    expect(receives).toBe(0);
    await modal.getByLabel("Tên vật phẩm").fill("Thẻ sinh viên tại quầy");
    await modal.getByLabel("Tình trạng khi nhận").fill("Một góc bị xước nhẹ");
    await modal.getByLabel("Số lượng thực nhận").fill("2");
    await modal.getByLabel("Phụ kiện thực nhận").fill("Không có");
    await modal.getByLabel("Ảnh tình trạng tiếp nhận", { exact: true }).setInputFiles(intakePhoto);
    await expect(modal.getByText("Ảnh tình trạng tiếp nhận * (1/5)")).toBeVisible();
    await modal.getByRole("button", { name: "Phân tích ảnh" }).click();
    await expect(modal.getByText("AI chưa sẵn sàng", { exact: true })).toBeVisible();
    await expect(modal.getByLabel("Tên vật phẩm")).toHaveValue("Thẻ sinh viên tại quầy");
    await expect(modal.locator(".intake-source").getByText("Bài gốc còn nguyên", { exact: true })).toBeVisible();
    await modal.getByLabel("Tôi đã đối chiếu vật phẩm, số lượng, phụ kiện và ảnh tình trạng tại quầy.").check();
    await page.screenshot({ path: testInfo.outputPath(`intake-${width}.png`) });
    expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
    await modal.getByRole("button", { name: "Xác nhận tiếp nhận", exact: true }).click();
    await expect(modal).toHaveCount(0);
    expect(receives).toBe(1);
  });
}

test("walk-in photo suggestions remain optional and require explicit Staff review before receipt", async ({ page }) => {
  const calls: { created?: any } = {};
  await prepare(page,calls);
  await page.route("**/api/posts/analyze-image",route => route.fulfill({ json: { title: "Thẻ được nhận tại quầy", description: "Thẻ sinh viên có góc bị xước",
    suggestedCategory: catalog.categories[1], visualAttributes: ["card"], visibleText: [], confidence: .9, warnings: [], model: "fixture", assistedBy: "fixture", imageCount: 1 } }));
  await page.goto("/staff");
  await page.getByRole("button", { name: "Tiếp nhận Walk-in (Tại quầy)", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Tiếp nhận trực tiếp (Walk-in / Tại quầy)", exact: true });
  await modal.getByLabel("Tên vật phẩm").fill("Thông tin Staff đang đối chiếu");
  await modal.getByLabel("Tình trạng khi nhận").fill("Một góc bị xước");
  await modal.getByLabel("Phụ kiện thực nhận").fill("Không có");
  await modal.getByLabel("Ảnh tình trạng tiếp nhận", { exact: true }).setInputFiles(intakePhoto);
  await expect(modal.getByText("Ảnh tình trạng tiếp nhận * (1/5)")).toBeVisible();
  await modal.getByRole("button", { name: "Phân tích ảnh", exact: true }).click();
  await expect(modal.getByRole("heading", { name: "Gợi ý từ ảnh", exact: true })).toBeVisible();
  await expect(modal.getByLabel("Tên vật phẩm")).toHaveValue("Thông tin Staff đang đối chiếu");
  expect(calls.created).toBeUndefined();
  await modal.getByLabel("Tôi đã đối chiếu vật phẩm, số lượng, phụ kiện và ảnh tình trạng tại quầy.").check();
  await modal.getByRole("button", { name: "Áp dụng gợi ý", exact: true }).click();
  await expect(modal.getByLabel("Danh mục")).toHaveValue("cat-card");
  await expect(modal.getByLabel("Tên vật phẩm")).toHaveValue("Thẻ được nhận tại quầy");
  await expect(modal.getByLabel("Tôi đã đối chiếu vật phẩm, số lượng, phụ kiện và ảnh tình trạng tại quầy.")).not.toBeChecked();
  await modal.getByRole("button", { name: "Tạo hồ sơ kho (Walk-in)", exact: true }).click();
  await expect(modal.getByText("Cần xác nhận đã kiểm tra vật phẩm thực tế.", { exact: true })).toBeVisible();
  expect(calls.created).toBeUndefined();
  await modal.getByLabel("Tôi đã đối chiếu vật phẩm, số lượng, phụ kiện và ảnh tình trạng tại quầy.").check();
  await modal.getByRole("button", { name: "Tạo hồ sơ kho (Walk-in)", exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect(calls.created.itemName).toBe("Thẻ được nhận tại quầy");
  expect(calls.created.physicalReviewConfirmed).toBe(true);
  expect(calls.created.intakeImageIds).toEqual(["intake-photo"]);
  expect(calls.created.postId).toBeUndefined();
});

for (const width of [1440, 390]) {
  test(`Staff verifies a custody claim in the return modal at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await prepare(page, {});
    const claim = { claimId: "claim-online", recipientId: "owner", fullName: "Nguyễn An", description: "Ví có chi tiết riêng bên trong", status: "CONVERSATION_OPEN", verified: false };
    await page.route("**/api/staff/warehouse-items/*/return-claim-reviews", route => route.fulfill({ json: { claims: [claim] } }));
    let verified = false;
    await page.route("**/api/staff/warehouse-items/*/verify-claim", route => {
      const input = route.request().postDataJSON();
      expect(input.claimId).toBe(claim.claimId);
      expect(input.recipientId).toBe(claim.recipientId);
      expect(input.verified).toBe(true);
      expect(input.reason.length).toBeGreaterThanOrEqual(10);
      verified = true;
      return route.fulfill({ json: { claims: [{ ...claim, verified: true, status: "ACCEPTED" }] } });
    });
    await page.goto("/staff");
    await page.getByRole("button", { name: "Kho tài sản", exact: true }).click();
    await page.getByRole("button", { name: "Trả cho chủ sở hữu", exact: true }).click();
    const modal = page.locator(".custody-modal");
    await modal.getByLabel("Liên kết claim trực tuyến (không bắt buộc)").selectOption(claim.claimId);
    await modal.getByRole("button", { name: "Xác minh claim tại quầy", exact: true }).click();
    await expect(modal.locator("#return-claimReviewReason-error")).toBeVisible();
    expect(verified).toBe(false);
    await modal.getByLabel("Nội dung đối chiếu").fill("Đã đối chiếu đặc điểm riêng và giấy tờ tại quầy");
    await modal.getByLabel("Tôi đã đối chiếu quyền sở hữu tại quầy").check();
    await modal.getByRole("button", { name: "Xác minh claim tại quầy", exact: true }).click();
    await expect(modal.getByRole("button", { name: "Xác minh claim tại quầy", exact: true })).toHaveCount(0);
    expect(verified).toBe(true);
    await expect(modal.getByLabel("Liên kết claim trực tuyến (không bắt buộc)")).toContainText("Đã xác minh");
    await expect(modal.getByLabel(/^Họ và tên người nhận/)).toHaveValue(claim.fullName);
    await page.screenshot({ path: testInfo.outputPath(`custody-verified-${width}.png`) });
    expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
    const submit = modal.getByRole("button", { name: "Xác nhận Đã trả hàng" });
    await submit.scrollIntoViewIfNeeded();
    expect(await submit.evaluate(el => el.getBoundingClientRect().left >= el.parentElement!.getBoundingClientRect().left)).toBeTruthy();
  });
}

test("staff can open storage logs and update item state", async ({ page }) => {
  const calls: { patched?: any } = {};
  await prepare(page, calls);
  await page.goto("/staff");

  await page.getByRole("button", { name: "Kho tài sản", exact: true }).click();
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  const detail = page.getByRole("dialog", { name: "Chi tiết vật phẩm kho" });
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

for (const width of [1920, 1440, 1024, 390]) {
  test(`inventory stays compact and opens full details with photos at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await prepare(page, {});
    const description = "Vật phẩm có nhiều ngăn, phụ kiện và dấu hiệu nhận dạng cần đối chiếu khi bàn giao. ".repeat(30);
    const newest = { ...item, itemName: "Balo xám đựng laptop và dụng cụ học tập", category: { id: "cat-bag", name: "Balo" }, description, receivedAt: "2026-10-05T10:00:00Z", storageCode: "WH-2026-A1-04",
      receivedQuantity: 1, accessories: "Laptop, sạc và bình nước", thumbnail: { id: "condition", provenance: "INTAKE" } };
    await page.route(/\/api\/staff\/warehouse-items(?:\?.*)?$/, route => route.fulfill({ json: { ...dashboard(), total: 4,
      items: [newest,
        { ...item, id: "stored", itemName: "Điện thoại có ốp bảo vệ và dây đeo", status: "STORED", category: { id: "cat-phone", name: "Thiết bị điện tử và phụ kiện điện thoại" } },
        { ...item, id: "claimed", itemName: "Chìa khóa xe", status: "CLAIMED" },
        { ...item, id: "older", itemName: "Áo thun trắng", status: "RETURNED", category: null }] } }));
    await page.route("**/api/staff/warehouse-items/*/images", route => route.fulfill({ json: { images: [{ id: "condition", provenance: "INTAKE",
      uploadedAt: newest.receivedAt, capturedAt: newest.receivedAt }] } }));
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/admin/staff");
    await page.getByRole("button", { name: "Kho tài sản", exact: true }).click();
    const cards = page.locator(".warehouse-item-card");
    await expect(cards).toHaveCount(4);
    await expect(cards.first().getByRole("heading")).toHaveText(newest.itemName);
    await expect(cards.first().locator("p")).toHaveCount(0);
    await expect(cards.first().locator(".warehouse-card-meta dt")).toHaveText(["Danh mục", "Tiếp nhận"]);
    await expect(cards.first().locator(".warehouse-card-meta dd").first()).toHaveText("Balo");
    await expect(cards.first().locator("time")).toHaveAttribute("datetime", newest.receivedAt);
    const receiptText = await page.evaluate(value => new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)), newest.receivedAt);
    await expect(cards.first().locator("time")).toHaveText(receiptText);
    await expect(cards.locator(".warehouse-status")).toHaveText(["Đã tiếp nhận", "Đang lưu kho", "Đang đợi nhận", "Đã trả"]);
    await expect(cards.last().locator(".warehouse-card-meta dd").first()).toHaveText("Chưa ghi nhận");
    await expect(cards.first().locator(".warehouse-card-actions button")).toHaveCount(2);
    await expect(cards.last().getByRole("button", { name: "Trả cho chủ sở hữu" })).toHaveCount(0);
    await expect(cards.first().locator("img")).toBeVisible();
    const columns = width > 1200 ? 3 : width > 700 ? 2 : 1;
    const positions = await cards.evaluateAll(elements => elements.map(element => {
      const { x, y, height } = element.getBoundingClientRect();
      return { x, y, height };
    }));
    expect(positions.filter(position => Math.abs(position.y - positions[0].y) < 1)).toHaveLength(columns);
    expect(positions[columns].y).toBeGreaterThan(positions[0].y);
    for (const position of positions) expect(position.height).toBeLessThan(520);
    for (const card of await cards.all()) {
      expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
      for (const button of await card.locator(".warehouse-card-actions button").all()) {
        expect(await button.evaluate(element => element.scrollWidth <= element.clientWidth && element.getBoundingClientRect().height >= 44)).toBeTruthy();
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.locator(".warehouse-item-list").screenshot({ path: testInfo.outputPath(`inventory-compact-${width}.png`) });

    const trigger = cards.first().getByRole("button", { name: "Xem chi tiết" });
    await trigger.click();
    const modal = page.getByRole("dialog", { name: "Chi tiết vật phẩm kho" });
    await expect(modal).toBeVisible();
    await expect(modal.locator(".summary-desc")).toHaveText(description.trim());
    await expect(modal.getByText("WH-2026-A1-04", { exact: true })).toBeVisible();
    await expect(modal.getByText(newest.accessories, { exact: true })).toBeVisible();
    await expect(modal.getByText("Nguyễn An", { exact: true })).toBeVisible();
    await expect(modal.getByText("an@example.com", { exact: true })).toBeVisible();
    await expect(modal.getByText("Move to shelf", { exact: false })).toBeVisible();
    await expect(modal.getByRole("button", { name: "Đóng chi tiết" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(modal.getByRole("button", { name: "Cập nhật trạng thái" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(modal.getByRole("button", { name: "Đóng chi tiết" })).toBeFocused();
    expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
    await modal.getByRole("button", { name: "Xem ảnh vật phẩm" }).click();
    const zoom = page.getByRole("dialog", { name: "Ảnh vật phẩm", exact: true });
    await expect(zoom).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(zoom).toHaveCount(0);
    await expect(modal).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`inventory-detail-${width}.png`) });
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test("inventory detail ignores late logs after closing and selecting another item", async ({ page }) => {
  await prepare(page, {});
  await page.route(/\/api\/staff\/warehouse-items(?:\?.*)?$/, route => route.fulfill({ json: { ...dashboard(), total: 2,
    items: [item, { ...item, id: "other-item", itemName: "Khóa xe" }] } }));
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route("**/api/staff/warehouse-items/item-1/logs", async route => {
    started(); await delayed;
    await route.fulfill({ json: { logs: [{ id: "stale", actor: { fullName: "STALE LOG" }, createdAt: item.receivedAt }] } });
  });
  await page.goto("/staff");
  await page.getByRole("button", { name: "Kho tài sản", exact: true }).click();
  await page.getByRole("button", { name: "Xem chi tiết" }).first().click();
  await requested;
  await page.getByRole("button", { name: "Đóng chi tiết" }).click();
  await page.getByRole("button", { name: "Xem chi tiết" }).last().click();
  const modal = page.getByRole("dialog", { name: "Chi tiết vật phẩm kho" });
  await expect(modal.getByRole("heading", { name: "Khóa xe" })).toBeVisible();
  await expect(modal.getByText("Move to shelf", { exact: false })).toBeVisible();
  const lateResponse = page.waitForResponse("**/api/staff/warehouse-items/item-1/logs");
  release();
  await lateResponse;
  await expect(modal.getByText("STALE LOG", { exact: false })).toHaveCount(0);
});

test("inventory detail displays log errors and retries inside the popup", async ({ page }) => {
  await prepare(page, {});
  let attempts = 0;
  await page.route("**/api/staff/warehouse-items/item-1/logs", route => route.fulfill(++attempts === 1
    ? { status: 503, json: { message: "Nhật ký đang tạm thời không khả dụng" } } : { json: { logs: [] } }));
  await page.goto("/staff");
  await page.getByRole("button", { name: "Kho tài sản", exact: true }).click();
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  const modal = page.getByRole("dialog", { name: "Chi tiết vật phẩm kho" });
  await expect(modal.getByRole("alert")).toContainText("Nhật ký đang tạm thời không khả dụng");
  await modal.getByRole("button", { name: "Thử lại" }).click();
  await expect(modal.getByRole("alert")).toHaveCount(0);
  await expect(modal.getByText("Chưa có nhật ký ghi nhận cho vật phẩm này.", { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`warehouse return shows field errors before submitting at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepare(page, {});
    await page.route("**/api/staff/warehouse-items/*/return-recipients", route => route.fulfill({ json: { recipients: [] } }));
    let returnRequests = 0;
    await page.route("**/api/staff/warehouse-items/*/return", route => {
      returnRequests++;
      return route.fulfill({ json: item });
    });
    await page.goto("/staff");
    await page.getByRole("button", { name: "Kho tài sản", exact: true }).click();
    await page.getByRole("button", { name: "Trả cho chủ sở hữu", exact: true }).click();
    const modal = page.locator(".custody-modal");
    const phone = modal.getByLabel(/^Số điện thoại/);
    await phone.fill("0359");
    await phone.blur();
    await expect(modal.locator("#return-receiverPhone-error")).toHaveText("Số điện thoại phải có từ 9 đến 20 ký tự.");
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    await modal.getByRole("button", { name: "Xác nhận Đã trả hàng" }).click();
    await expect(modal.locator("#return-receiverName-error")).toBeVisible();
    await expect(modal.locator("#return-receiverIdentity-error")).toBeVisible();
    await expect(modal.locator("#return-proofImage-error")).toBeVisible();
    await expect(modal.locator("#return-verified-error")).toBeVisible();
    expect(returnRequests).toBe(0);
    await phone.fill("0359123456");
    await expect(phone).toHaveAttribute("aria-invalid", "false");
    await expect(modal.locator("#return-receiverPhone-error")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`return-errors-${viewport.width}.png`) });
    expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
  });

  test(`staff server pagination and filtering at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepare(page, {});
    const queries: string[] = [];
    await page.route(/\/api\/staff\/custody-requests(?:\?.*)?$/, route => {
      const url = new URL(route.request().url());
      queries.push(url.search);
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const status = url.searchParams.get("status") === "AWAITING_INTAKE" ? "ACCEPTED" : url.searchParams.get("status") ?? "PENDING";
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
    await page.getByRole("button", { name: "Chờ tiếp nhận (21)", exact: true }).click();
    await expect(page.getByText("Item page 1", { exact: true })).toBeVisible();
    expect(queries.some(query => new URLSearchParams(query).get("status") === "AWAITING_INTAKE" && new URLSearchParams(query).get("page") === "1")).toBeTruthy();
    await page.evaluate(() => window.scrollTo(0, 0));
    const headerBox = await page.locator(".admin-workspace-bar").boundingBox();
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

for (const status of ["RECEIVED", "EXPIRED"]) {
test(`warehouse ${status} return retains server field errors and can retry an in-person return`, async ({ page }) => {
  await prepare(page, {});
  await page.route(/\/api\/staff\/warehouse-items(?:\?.*)?$/, route => route.fulfill({ json: { ...dashboard(), items: [{ ...item, status }] } }));
  await page.route("**/api/staff/warehouse-items/*/return-recipients", route => route.fulfill({ json: { recipients: [] } }));
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const proofId = "00000000-0000-4000-8000-000000000000";
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5n8AAAAASUVORK5CYII=", "base64");
  let uploads = 0;
  await page.route("**/api/staff/warehouse-items/upload-proof", route => {
    uploads++;
    return route.fulfill({ json: { id: proofId } });
  });
  await page.route("**/api/staff/warehouse-proofs/*", route => route.fulfill({ contentType: "image/png", body: image }));
  let attempts = 0;
  await page.route("**/api/staff/warehouse-items/*/return", route => {
    const payload = route.request().postDataJSON();
    expect(payload.claimId).toBeNull();
    expect(payload.recipientId).toBeNull();
    expect(payload.proofImage).toBe(proofId);
    attempts++;
    return attempts === 1
      ? route.fulfill({ status: 422, json: { message: "Dữ liệu nhập chưa hợp lệ", errors: { receiverPhone: ["Vui lòng kiểm tra lại số điện thoại người nhận."] } } })
      : route.fulfill({ json: { ...item, status: "RETURNED" } });
  });
  await page.goto("/staff");
  await page.getByRole("button", { name: "Kho tài sản", exact: true }).click();
  await page.getByRole("button", { name: "Trả cho chủ sở hữu", exact: true }).click();
  const modal = page.locator(".custody-modal");
  await modal.getByLabel(/^Họ và tên người nhận/).fill("Nguyễn An");
  await modal.getByLabel(/^Số điện thoại/).fill("0359123456");
  await modal.getByLabel(/^Mã thẻ SV/).fill("DE123456");
  await modal.getByRole("checkbox").check();
  const upload = modal.getByLabel("Ảnh bằng chứng bàn giao", { exact: true });
  await upload.setInputFiles(Array.from({ length: 6 }, (_, index) => ({ name: `proof-${index}.png`, mimeType: "image/png", buffer: image })));
  await expect(modal.locator("#return-proofImage-error")).toHaveText("Chỉ được tải lên tối đa 5 ảnh bằng chứng.");
  expect(uploads).toBe(0);
  await upload.setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: image });
  await expect(modal.getByText("1 ảnh đã lưu riêng tư", { exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "Xác nhận Đã trả hàng" }).click();
  await expect(modal.locator("#return-receiverPhone-error")).toHaveText("Vui lòng kiểm tra lại số điện thoại người nhận.");
  await expect(modal.getByLabel(/^Họ và tên người nhận/)).toHaveValue("Nguyễn An");
  await modal.getByLabel(/^Số điện thoại/).fill("0359123457");
  await modal.getByRole("button", { name: "Xác nhận Đã trả hàng" }).click();
  await expect(page.getByText("Đã hoàn tất trả hàng cho chủ sở hữu!", { exact: true })).toBeVisible();
  await expect(modal).toHaveCount(0);
  expect(attempts).toBe(2);
  expect(pageErrors).toEqual([]);
});
}
