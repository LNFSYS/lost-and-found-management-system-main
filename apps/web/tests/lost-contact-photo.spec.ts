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
    contactPhoto: postType === "LOST" ? { required: true, approved, postId, questions: ["Ví có chất liệu và kiểu khóa như thế nào?", "Ví có dấu hiệu riêng nào?", "Bạn nhớ vị trí mất ở đâu?"] } : null };
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
      answeredCount: 0, readyForDecision: Boolean(currentClaim().contactPhoto?.approved), photoContactEligible: Boolean(currentClaim().contactPhoto?.approved) }, questions: [], history: [] } }));
  await page.route(`**/api/claims/${claimId}/verification/templates`, route => route.fulfill({ json: { category: "Ví / bóp",
    template: { id: "wallet-bag", version: 1, minimumAnswers: 1, prompts: [], customFollowUpAllowed: true } } }));
}

async function openPhotoCheckedRoom(page: Page) {
  let approved = false;
  await prepare(page, () => claim(approved), true);
  await page.route("**/api/claims/contact-photo-checks", route => route.fulfill({ json: {
    approved: true, score: .8, checkId, questions: claim().contactPhoto!.questions, expiresAt: new Date(Date.now() + 1800000).toISOString()
  } }));
  await page.route(`**/api/claims/${claimId}/contact-photo`, route => {
    approved = true; return route.fulfill({ json: claim() });
  });
  await page.goto(`/claims/${claimId}`);
  await page.getByLabel("Ảnh vật phẩm đang giữ").setInputFiles(photo);
  await page.getByRole("button", { name: "Kiểm tra ảnh", exact: true }).click();
  await expect(page.getByRole("group", { name: "Câu hỏi từ ảnh" }).getByRole("button")).toHaveCount(3);
}

for (const width of [1440,390]) test(`LOST photo checks preserve drafts and immediately open a room at 50 percent at ${width}px`, async ({ page },testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  let checks = 0, sent: Record<string,unknown> | null = null;
  const errors: string[] = []; page.on("pageerror",error => errors.push(error.message));
  await prepare(page,() => claim());
  await page.route("**/api/claims/contact-photo-checks", route => {
    checks++;
    if (checks === 1) return route.fulfill({ json: { approved: false, score: .49999, checkId: null, expiresAt: null } });
    if (checks === 2) return route.fulfill({ status: 503, json: { message: "Không thể phân tích ảnh lúc này" } });
    return route.fulfill({ json: { approved: true, score: .5, checkId, expiresAt: new Date(Date.now()+1800000).toISOString(), questions: claim().contactPhoto!.questions } });
  });
  await page.route("**/api/claims", route => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { ...claim(), idempotent: false } });
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
  await expect(page).toHaveURL(new RegExp(`/claims/${claimId}$`));
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("Tôi đang giữ một ví tương tự");
  await expect(page.getByRole("button", { name: "Đề xuất gặp mặt", exact: true })).toBeEnabled();
  await expect(page.getByRole("group", { name: "Câu hỏi từ ảnh" }).getByRole("button")).toHaveCount(3);
  await expect(page.locator(".claims-sidebar header strong")).toHaveText("1");
  await expect(page.locator(".claims-sidebar .claim-list-item")).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({ path: testInfo.outputPath(`contact-photo-${width}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(sent!.contactCheckId).toBe(checkId);
  await expect(page.getByText("Ví có chất liệu và kiểu khóa như thế nào?",{ exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a legacy LOST room requires its own photo and reveals questions without accepting ownership", async ({ page }) => {
  let approved = false, attached = 0;
  const questions = ["Khóa và các ngăn có bố cục ra sao?", "Có dấu hư hỏng nào?", "Có đặc điểm riêng nào chưa công khai?"];
  await prepare(page,() => claim(approved),true);
  await page.route("**/api/claims/contact-photo-checks", route => route.fulfill({ json: { approved: true, score: .8, checkId, questions, expiresAt: new Date(Date.now()+1800000).toISOString() } }));
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
  await expect(page.getByRole("group", { name: "Câu hỏi từ ảnh" }).getByRole("button")).toHaveCount(3);
  await expect(page.getByText(questions[0]!,{ exact: true })).toBeVisible();
  expect(claim().appointmentEligible).toBe(false);
});

for (const width of [1440,390]) test(`LOST owners see a persistent photo safety reminder without changing chat gates at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const ownerSession = { ...session, user: { ...session.user, ...post.owner, email: "owner@example.invalid" } };
  const currentClaim = { ...claim(), contactPhoto: { ...claim().contactPhoto!, required: false } };
  await page.addInitScript(({ id, questions }) => {
    window.history.replaceState({ ...window.history.state, usr: { claimId: id, contactQuestions: questions } }, "");
  }, { id: claimId, questions: claim().contactPhoto!.questions });
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
  await expect(page.getByRole("region", { name: "Câu hỏi đối chiếu vật phẩm" })).toHaveCount(0);
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
  await expect(page.getByRole("region", { name: "Câu hỏi đối chiếu vật phẩm" })).toHaveCount(0);
});

for (const width of [1440, 390]) test(`suggestions send normal text and the two attachment actions work at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await openPhotoCheckedRoom(page);
  const textRequests: string[] = [];
  let images = 0, evidenceUploads = 0;
  const message = (id: string, content: string, image = false) => ({ id, roomId: "room", sender: session.user, content,
    clientMessageId: id, messageType: image ? "IMAGE" : "TEXT", mediaUrl: image ? `/api/claims/${claimId}/evidence/chat-photo` : null,
    isRead: false, readAt: null, createdAt: "2026-10-01T01:00:00Z" });
  await page.route(`**/api/claims/${claimId}/messages`, route => {
    if (route.request().method() !== "POST") return route.fallback();
    const { content } = route.request().postDataJSON(); textRequests.push(content);
    return route.fulfill({ json: message("question-message", content) });
  });
  await page.route(`**/api/claims/${claimId}/messages/images`, route => {
    images++; expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    expect(route.request().postDataBuffer()?.includes(photo.buffer)).toBe(true);
    return route.fulfill({ json: message("chat-image", "", true) });
  });
  await page.route(`**/api/claims/${claimId}/evidence/chat-photo`, route => route.fulfill({ contentType: "image/png", body: photo.buffer }));
  await page.route(`**/api/claims/${claimId}/evidence`, route => {
    if (route.request().method() !== "POST") return route.fallback();
    evidenceUploads++;
    return route.fulfill({ json: { id: "separate-evidence", claimId, uploadedBy: session.user, mediaFormat: "png", mediaBytes: photo.buffer.length,
      evidenceType: "PHOTO", description: "Private evidence", createdAt: post.createdAt, url: `/api/claims/${claimId}/evidence/chat-photo` } });
  });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const suggestionPanel = page.getByRole("region", { name: "Câu hỏi đối chiếu vật phẩm" });
  const suggestions = page.getByRole("group", { name: "Câu hỏi từ ảnh" }).getByRole("button");
  await expect(suggestions).toHaveCount(3);
  const expandedHeight = (await suggestionPanel.boundingBox())!.height;
  const controls = page.locator(".review-actions");
  expect((await controls.boundingBox())!.y).toBeLessThan(500);
  await page.getByLabel("Tin nhắn riêng").fill("Giữ nguyên nháp khi gửi gợi ý");
  await suggestions.first().click();
  await expect(page.locator(".claim-messages")).toContainText(claim().contactPhoto!.questions[0]!);
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("Giữ nguyên nháp khi gửi gợi ý");
  const toggle = page.getByRole("button", { name: "Câu hỏi gợi ý (3)", exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await expect(page.getByRole("group", { name: "Câu hỏi từ ảnh" })).toBeHidden();
  expect((await suggestionPanel.boundingBox())!.height).toBeLessThan(expandedHeight / 2);
  await toggle.click();
  await expect(suggestions).toHaveCount(3);
  await toggle.click();
  expect(textRequests).toEqual([claim().contactPhoto!.questions[0]]);
  await page.getByLabel("Tin nhắn riêng").fill("");
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await page.getByRole("button", { name: "Ảnh", exact: true }).click();
  await page.getByLabel("Ảnh gửi trong chat").setInputFiles(photo);
  await expect(page.getByAltText("Ảnh chờ gửi")).toBeVisible();
  await page.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
  const chatImage = page.locator(".claim-messages").getByAltText("Ảnh trong cuộc trò chuyện");
  await expect(chatImage).toBeVisible();
  expect(await chatImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  expect(images).toBe(1);
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  const evidenceFile = page.getByLabel("Ảnh bằng chứng riêng tư");
  await expect(evidenceFile).toBeVisible(); await expect(evidenceFile).toBeFocused();
  await expect(page.locator(".evidence-panel--uploading")).toBeVisible();
  await evidenceFile.setInputFiles(photo);
  await page.locator(".evidence-upload-compact").getByRole("button", { name: "Tải lên", exact: true }).click();
  expect(evidenceUploads).toBe(1);
  await page.screenshot({ path: testInfo.outputPath(`chat-actions-${width}.png`), fullPage: true });
  expect(errors).toEqual([]);
});

for (const width of [1440, 390]) test(`a failed suggestion reopens for an idempotent retry at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openPhotoCheckedRoom(page);
  const keys: string[] = [];
  await page.route(`**/api/claims/${claimId}/messages`, route => {
    if (route.request().method() !== "POST") return route.fallback();
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) return route.fulfill({ status: 503, json: { message: "Chưa gửi được câu hỏi" } });
    return route.fulfill({ json: { id: "retry-question", roomId: "room", sender: session.user,
      content: route.request().postDataJSON().content, messageType: "TEXT", createdAt: post.createdAt } });
  });
  const question = page.getByRole("group", { name: "Câu hỏi từ ảnh" }).getByRole("button").first();
  await page.getByLabel("Tin nhắn riêng").fill("Nháp cần giữ");
  await question.click();
  await expect(page.locator(".claim-alert")).toContainText("Chưa gửi được câu hỏi");
  await expect(question).toBeVisible();
  await question.click();
  await expect(page.locator(".claim-messages")).toContainText(claim().contactPhoto!.questions[0]!);
  await expect(page.getByRole("button", { name: "Câu hỏi gợi ý (3)", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("Nháp cần giữ");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});
