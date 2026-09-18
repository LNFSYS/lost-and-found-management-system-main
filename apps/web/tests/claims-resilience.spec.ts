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
  await page.route("**/api/claims/dddddddd-dddd-4ddd-8ddd-dddddddddddd/verification", (route) => fulfillJson(route, {
    claimId: claimB.id,
    status: claimB.status,
    appointmentEligible: false,
    participantRole: "CLAIMANT",
    roomEscalation: null,
    policy: { templateId: "wallet-bag", templateVersion: 1, minimumAnswers: 2, answeredCount: 0, readyForDecision: false },
    questions: [],
    history: []
  }));

  await page.goto(`/claims/${claimA.id}`);
  await expect(page.getByRole("button", { name: /Ví B đã nhặt/ })).toBeVisible();
  await page.getByRole("button", { name: /Ví B đã nhặt/ }).click();
  await expect(page).toHaveURL(new RegExp(`/claims/${claimB.id}$`));
  await expect(page.getByRole("heading", { name: "Ví B đã nhặt" })).toBeVisible();
  await page.waitForTimeout(850);
  await expect(page.getByRole("heading", { name: "Ví B đã nhặt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ví A đã nhặt" })).toHaveCount(0);

  await page.getByLabel("Tin nhắn riêng").fill("Thông tin của phòng B");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(page.getByText("Thông tin của phòng B")).toBeVisible();
});

test("Finder makes an explicit appointment-eligible decision in the private room", async ({ page }) => {
  const finderSession = { ...session, user: { ...session.user, id: "finder-a", fullName: "Finder A" } };
  const finderClaim = {
    ...claimA,
    claimantId: "claimant-a",
    finderId: "finder-a",
    appointmentEligible: false,
    conversationDecision: "OPEN_CONVERSATION"
  };
  const answeredVerification = {
    claimId: finderClaim.id,
    status: "CONVERSATION_OPEN",
    appointmentEligible: false,
    participantRole: "FINDER",
    roomEscalation: null,
    policy: { templateId: "wallet-bag", templateVersion: 1, minimumAnswers: 1, answeredCount: 1, matchedCount: 1, readyForDecision: true },
    questions: [{
      id: "11111111-1111-4111-8111-111111111111",
      prompt: "Ví có chất liệu và kiểu khóa như thế nào?",
      questionType: "VISUAL_DETAIL",
      privacyLevel: "PRIVATE",
      status: "DRAFT",
      assignedAt: "2026-09-18T01:00:00.000Z",
      template: { templateId: "wallet-bag", templateVersion: 1, promptKey: "material-layout" },
      answer: { answered: true, attemptCount: 1, answeredAt: "2026-09-18T01:05:00.000Z", isMatch: true }
    }],
    history: []
  };
  const acceptedClaim = { ...finderClaim, status: "ACCEPTED", appointmentEligible: true };
  let decisionRequest: { header: string | null; body: Record<string, unknown> } | null = null;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/auth/refresh", (route) => fulfillJson(route, finderSession));
  await page.route("**/api/claims?page=1&pageSize=50", (route) => fulfillJson(route, {
    items: [finderClaim], total: 1, page: 1, pageSize: 50, hasMore: false
  }));
  await page.route(`**/api/claims/${finderClaim.id}`, (route) => fulfillJson(route, finderClaim));
  await page.route(`**/api/claims/${finderClaim.id}/messages*`, (route) => fulfillJson(route, {
    room: { id: "room-a", claimId: finderClaim.id, status: finderClaim.status, participantRole: "FINDER", createdAt: finderClaim.createdAt },
    items: [], hasMore: false, nextCursor: null
  }));
  await page.route(`**/api/claims/${finderClaim.id}/evidence`, (route) => fulfillJson(route, { items: [] }));
  await page.route(`**/api/claims/${finderClaim.id}/verification/templates`, (route) => fulfillJson(route, {
    category: "vi / bop",
    template: { id: "wallet-bag", version: 1, minimumAnswers: 1, customFollowUpAllowed: true, prompts: [] }
  }));
  await page.route(`**/api/claims/${finderClaim.id}/verification`, (route) => fulfillJson(route, answeredVerification));
  await page.route(`**/api/claims/${finderClaim.id}/verification/decision`, async (route) => {
    decisionRequest = {
      header: route.request().headers()["idempotency-key"] ?? null,
      body: route.request().postDataJSON() as Record<string, unknown>
    };
    await fulfillJson(route, {
      claim: acceptedClaim,
      verification: { ...answeredVerification, status: "ACCEPTED", appointmentEligible: true }
    });
  });

  await page.goto(`/claims/${finderClaim.id}`);
  await expect(page.getByText("OWNERSHIP REVIEW")).toBeVisible();
  await expect(page.getByText("1 câu khớp")).toBeVisible();
  await page.getByRole("button", { name: "Đề xuất gặp mặt" }).click();
  await page.getByLabel("Lý do / nhận xét").fill("Các câu trả lời riêng phù hợp với vật phẩm");
  await page.getByRole("button", { name: "Xác nhận quyết định" }).click();

  await expect(page.getByText("Đủ điều kiện đặt lịch")).toBeVisible();
  expect(decisionRequest).not.toBeNull();
  expect(decisionRequest!.header).toBeTruthy();
  expect(decisionRequest!.body.decision).toBe("VERIFY_FOR_MEETUP");
  expect(decisionRequest!.body).not.toHaveProperty("idempotencyKey");
});
