import { expect, test, type Page } from "@playwright/test";

const postId = "22222222-2222-4222-8222-222222222222";
const claimId = "44444444-4444-4444-8444-444444444444";
const checkId = "33333333-3333-4333-8333-333333333333";
const photo = { name: "wallet.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMioAAAAASUVORK5CYII=","base64") };
const session = { accessToken: "fixture", accessTokenExpiresIn: "15m", user: { id: "finder", email: "finder@example.invalid", fullName: "Finder",
  studentCode: null, phoneNumber: null, roles: ["USER","STUDENT"], status: "ACTIVE", avatar: { hasAvatar: false }, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" } };
const post = { id: postId, type: "LOST", status: "OPEN", visibilityMode: "PUBLIC", title: "Ví da bị mất", description: "Ví màu đen khóa bạc",
  category: { id: "wallet", name: "Ví / bóp" }, location: { area: null, building: null, roomText: null, customLocation: null }, handoverPoint: null,
  lostFoundAt: null, owner: { id: "owner", fullName: "Owner" }, media: [], canEdit: false, createdAt: "2026-10-01T00:00:00Z" };
function claim(approved = true, postType: "LOST" | "FOUND" = "LOST") {
  return { id: claimId, lostPostId: null, foundPostId: postId, claimantId: "owner", finderId: "finder", status: "CONVERSATION_OPEN", finderDecision: "ACCEPTED",
    conversationDecision: "OPEN_CONVERSATION", appointmentEligible: false, description: null, approximateLostAt: null, approximateLocation: null,
    rejectionReason: null, moreInfoRequest: null, acceptedAt: null, rejectedAt: null, cancelledAt: null, createdAt: post.createdAt, updatedAt: post.createdAt,
    claimant: post.owner, finder: { id: "finder", fullName: "Finder" }, posts: { lost: null, found: { id: postId, title: post.title } },
    roomId: "room", participants: [], canSend: approved, room: { id: "room" }, item: { postId, title: post.title, categoryName: "Ví / bóp", locationLabel: null, imageUrl: null },
    contactPhoto: postType === "LOST" ? { required: true, approved, postId, questions: ["Ví có chất liệu và kiểu khóa như thế nào?"] } : null };
}
async function prepare(page: Page, currentClaim: () => ReturnType<typeof claim>, list = false, viewerSession = session) {
  await page.route("**/api/**", route => route.fulfill({ status: 404, json: { message: "Unmocked fixture endpoint" } }));
  await page.route("**/api/auth/refresh", route => route.fulfill({ json: viewerSession }));
  await page.route("**/api/claims?page=1&pageSize=50", route => route.fulfill({ json: { items: list ? [currentClaim()] : [], total: list ? 1 : 0, page: 1, pageSize: 50, hasMore: false } }));
  await page.route(`**/api/posts/${postId}`, route => route.fulfill({ json: post }));
  await page.route(`**/api/claims/${claimId}`, route => route.fulfill({ json: currentClaim() }));
  const participantRole = () => currentClaim().finderId === viewerSession.user.id ? "FINDER" : "CLAIMANT";
  await page.route(`**/api/claims/${claimId}/messages*`, route => route.fulfill({ json: { room: { id: "room", claimId, status: "CONVERSATION_OPEN", participantRole: participantRole(), createdAt: post.createdAt }, items: [], hasMore: false, nextCursor: null } }));
  await page.route(`**/api/claims/${claimId}/evidence`, route => route.fulfill({ json: { items: [] } }));
  await page.route(`**/api/claims/${claimId}/verification`, route => route.fulfill({ json: { claimId, status: "CONVERSATION_OPEN", appointmentEligible: false,
    participantRole: participantRole(), roomEscalation: null, policy: { templateId: "wallet-bag", templateVersion: 1, minimumAnswers: 1,
      answeredCount: 0, readyForDecision: false }, questions: [], history: [] } }));
  await page.route(`**/api/claims/${claimId}/verification/templates`, route => route.fulfill({ json: { category: "Ví / bóp",
    template: { id: "wallet-bag", version: 1, minimumAnswers: 1, prompts: [], customFollowUpAllowed: true } } }));
}

for (const width of [1440,390]) test(`LOST photo checks preserve drafts on failure and unlock only above 60 percent at ${width}px`, async ({ page },testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  let checks = 0, sent: Record<string,unknown> | null = null;
  const errors: string[] = []; page.on("pageerror",error => errors.push(error.message));
  await prepare(page,() => claim());
  await page.route("**/api/claims/contact-photo-checks", route => {
    checks++;
    if (checks === 1) return route.fulfill({ json: { approved: false, score: .6, checkId: null, expiresAt: null } });
    if (checks === 2) return route.fulfill({ status: 503, json: { message: "Không thể phân tích ảnh lúc này" } });
    return route.fulfill({ json: { approved: true, score: .81, checkId, expiresAt: new Date(Date.now()+1800000).toISOString() } });
  });
  await page.route("**/api/claims/direct-messages", route => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { claim: claim(), message: { id: "first", content: sent!.content } } });
  });
  await page.goto(`/claims?composePostId=${postId}`);
  await page.getByLabel("Tin nhắn riêng").fill("Tôi đang giữ một ví tương tự");
  expect((await page.getByLabel("Tin nhắn riêng").boundingBox())!.width).toBeGreaterThan(200);
  const send = page.getByRole("button",{ name: "Gửi tin nhắn", exact: true });
  await expect(send).toBeDisabled();
  await page.getByLabel("Ảnh vật phẩm đang giữ").setInputFiles(photo);
  const preview = page.getByAltText("Ảnh vật phẩm trước khi liên hệ");
  await expect(preview).toBeVisible();
  expect(await preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button",{ name: "Kiểm tra ảnh", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "chưa đạt" })).toBeVisible();
  await expect(send).toBeDisabled();
  expect(sent).toBeNull();
  await page.getByRole("button",{ name: "Kiểm tra ảnh", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Không thể phân tích" })).toBeVisible();
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("Tôi đang giữ một ví tương tự");
  await expect(preview).toBeVisible();
  await expect(send).toBeDisabled();
  await page.getByRole("button",{ name: "Kiểm tra ảnh", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đủ điều kiện trao đổi" })).toBeVisible();
  await expect(send).toBeEnabled();
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({ path: testInfo.outputPath(`contact-photo-${width}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await send.click();
  await expect(page).toHaveURL(new RegExp(`/claims/${claimId}$`));
  expect(sent!.contactCheckId).toBe(checkId);
  await expect(page.getByText("Ví có chất liệu và kiểu khóa như thế nào?",{ exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a legacy LOST room requires its own photo and reveals questions without accepting ownership", async ({ page }) => {
  let approved = false, attached = 0;
  await prepare(page,() => claim(approved),true);
  await page.route("**/api/claims/contact-photo-checks", route => route.fulfill({ json: { approved: true, score: .8, checkId, expiresAt: new Date(Date.now()+1800000).toISOString() } }));
  await page.route(`**/api/claims/${claimId}/contact-photo`, route => {
    expect(route.request().postDataJSON()).toEqual({ contactCheckId: checkId });
    attached++; approved = true; return route.fulfill({ json: claim(true) });
  });
  await page.goto(`/claims/${claimId}`);
  await expect(page.getByRole("heading",{ name: "Ảnh vật phẩm bạn đang giữ" })).toBeVisible();
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveCount(0);
  await page.getByLabel("Ảnh vật phẩm đang giữ").setInputFiles(photo);
  await page.getByRole("button",{ name: "Kiểm tra ảnh", exact: true }).click();
  await expect(page.getByLabel("Tin nhắn riêng")).toBeVisible();
  expect(attached).toBe(1);
  await expect(page.getByText("Ví có chất liệu và kiểu khóa như thế nào?",{ exact: true })).toBeVisible();
  expect(claim().appointmentEligible).toBe(false);
});

for (const width of [1440,390]) test(`LOST owners see a persistent photo safety reminder without changing chat gates at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const ownerSession = { ...session, user: { ...session.user, ...post.owner, email: "owner@example.invalid" } };
  const currentClaim = { ...claim(), contactPhoto: { ...claim().contactPhoto!, required: false } };
  await prepare(page, () => currentClaim, true, ownerSession);
  let sent: Record<string, unknown> | null = null;
  const writes: string[] = [];
  page.on("request", request => {
    if (request.method() !== "GET" && request.url().includes("/api/claims/")) writes.push(new URL(request.url()).pathname);
  });
  await page.route(`**/api/claims/${claimId}/messages`, route => {
    if (route.request().method() !== "POST") return route.fallback();
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: "owner-message", roomId: "room", sender: post.owner,
      clientMessageId: route.request().headers()["idempotency-key"], content: sent!.content, messageType: "TEXT", isRead: false, readAt: null, createdAt: post.createdAt } });
  });
  await page.goto(`/claims/${claimId}`);
  const notice = page.getByRole("complementary", { name: "Lưu ý tránh lừa đảo" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Hãy xin ảnh vật phẩm trước khi hẹn nhận đồ");
  await expect(notice).toContainText("Không chuyển tiền");
  await expect(notice).toContainText("ảnh tương đồng chưa chứng minh họ đang giữ đồ");
  const composer = page.getByLabel("Tin nhắn riêng");
  await composer.fill("Bạn gửi giúp mình ảnh vật phẩm hiện tại nhé");
  await expect(page.getByRole("button", { name: "Gửi tin nhắn", exact: true })).toBeEnabled();
  await composer.scrollIntoViewIfNeeded();
  expect(await notice.evaluate(element => element.closest(".claim-chat-scroll"))).toBeNull();
  await notice.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath(`lost-owner-safety-${width}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
  await expect(composer).toHaveValue("");
  await expect(notice).toBeVisible();
  expect(sent!.content).toBe("Bạn gửi giúp mình ảnh vật phẩm hiện tại nhé");
  expect(writes).toEqual([`/api/claims/${claimId}/messages`]);
  expect(currentClaim.status).toBe("CONVERSATION_OPEN");
  expect(currentClaim.appointmentEligible).toBe(false);
});

for (const scenario of ["LOST finder", "FOUND owner", "FOUND claimant"] as const) test(`photo safety reminder is not shown to the ${scenario}`, async ({ page }) => {
  const currentClaim = scenario === "LOST finder" ? claim() : { ...claim(true, "FOUND"),
    ...(scenario === "FOUND claimant" ? { finderId: "owner", claimantId: "finder", finder: post.owner, claimant: session.user } : {}) };
  await prepare(page, () => currentClaim, true);
  await page.goto(`/claims/${claimId}`);
  await expect(page.getByLabel("Tin nhắn riêng")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Lưu ý tránh lừa đảo" })).toHaveCount(0);
});
