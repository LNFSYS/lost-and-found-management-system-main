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
    avatar: { hasAvatar: false, updatedAt: null },
    roles: ["USER", "STUDENT"],
    status: "ACTIVE",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z"
  }
};

const claimA = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  lostPostId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  foundPostId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  claimantId: "e2e-user",
  finderId: "finder-a",
  status: "CONVERSATION_OPEN",
  finderDecision: "ACCEPTED",
  description: null,
  approximateLostAt: null,
  approximateLocation: null,
  rejectionReason: null,
  moreInfoRequest: null,
  acceptedAt: "2026-09-06T00:00:00.000Z",
  rejectedAt: null,
  cancelledAt: null,
  createdAt: "2026-09-06T00:00:00.000Z",
  updatedAt: "2026-09-06T00:00:00.000Z",
  claimant: { id: "e2e-user", fullName: "Sinh viên Demo" },
  finder: { id: "finder-a", fullName: "Finder A" },
  posts: { lost: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Ví A bị mất" }, found: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "Ví A đã nhặt" } },
  roomId: "room-a",
  participants: [],
  room: { id: "room-a" },
  canSend: true
};

const claimB = {
  ...claimA,
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  lostPostId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  foundPostId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  finderId: "finder-b",
  posts: { lost: { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", title: "Ví B bị mất" }, found: { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", title: "Ví B đã nhặt" } },
  roomId: "room-b",
  room: { id: "room-b" }
};

async function fulfillJson(route: Parameters<Page["route"]>[0], body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

test("ignores a late claim-room response after switching to another room", async ({ page }) => {
  await page.route("**/api/auth/refresh", (route) => fulfillJson(route, session));
  await page.route("**/api/claims?page=1&pageSize=50", (route) => fulfillJson(route, {
    items: [claimA, claimB], total: 2, page: 1, pageSize: 50, hasMore: false
  }));
  await page.route("**/api/claims/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await fulfillJson(route, claimA);
  });
  await page.route("**/api/claims/dddddddd-dddd-4ddd-8ddd-dddddddddddd", (route) => fulfillJson(route, claimB));
  await page.route("**/api/claims/dddddddd-dddd-4ddd-8ddd-dddddddddddd/messages*", (route) => {
    if (route.request().method() === "POST") return fulfillJson(route, {
      id: "message-b", roomId: "room-b", sender: { id: "e2e-user", fullName: "Sinh viên Demo" },
      clientMessageId: "11111111-1111-4111-8111-111111111111", content: "Thông tin của phòng B", messageType: "TEXT",
      isRead: false, readAt: null, createdAt: "2026-09-06T00:01:00.000Z"
    });
    return fulfillJson(route, { room: { id: "room-b", claimId: claimB.id, status: claimB.status, participantRole: "CLAIMANT", createdAt: claimB.createdAt }, items: [], hasMore: false, nextCursor: null });
  });
  await page.route("**/api/claims/dddddddd-dddd-4ddd-8ddd-dddddddddddd/evidence", (route) => fulfillJson(route, { items: [] }));

  await page.goto(`/claims/${claimA.id}`);
  await expect(page.getByRole("button", { name: /Ví B bị mất/ })).toBeVisible();
  await page.getByRole("button", { name: /Ví B bị mất/ }).click();
  await expect(page).toHaveURL(new RegExp(`/claims/${claimB.id}$`));
  await expect(page.getByRole("heading", { name: "Ví B bị mất" })).toBeVisible();
  await page.waitForTimeout(850);
  await expect(page.getByRole("heading", { name: "Ví B bị mất" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ví A bị mất" })).toHaveCount(0);

  await page.getByLabel("Tin nhắn riêng").fill("Thông tin của phòng B");
  await page.getByRole("button", { name: "Gửi" }).click();
  await expect(page.getByText("Thông tin của phòng B")).toBeVisible();
});
