import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

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

const directLostClaim = {
  ...claimA, lostPostId: null, claimantId: "lost-owner", finderId: session.user.id,
  claimant: { id: "lost-owner", fullName: "LOST owner" }, finder: { id: session.user.id, fullName: session.user.fullName },
  posts: { lost: null, found: { id: claimA.foundPostId, title: "Balo bị mất" } },
  item: { postId: claimA.foundPostId, title: "Balo bị mất", categoryName: "Balo", locationLabel: "Campus", imageUrl: null }
};
const directLostVerification = {
  claimId: directLostClaim.id, status: "CONVERSATION_OPEN", appointmentEligible: false, participantRole: "FINDER", roomEscalation: null,
  policy: { templateId: "wallet-bag", templateVersion: 1, minimumAnswers: 1, answeredCount: 0, readyForDecision: false }, questions: [], history: []
};

async function setupDirectLostRoom(page: Page, items: Array<typeof directLostClaim> = [directLostClaim]) {
  await page.route("**/api/auth/refresh", route => fulfillJson(route, session));
  await page.route("**/api/claims?page=1&pageSize=50", route => fulfillJson(route, { items, total: items.length, page: 1, pageSize: 50, hasMore: false }));
  for (const item of items) {
    await page.route(`**/api/claims/${item.id}`, route => fulfillJson(route, item));
    await page.route(`**/api/claims/${item.id}/messages*`, route => fulfillJson(route, {
      room: { id: item.roomId, claimId: item.id, status: item.status, participantRole: "FINDER", createdAt: item.createdAt },
      items: [], hasMore: false, nextCursor: null
    }));
    await page.route(`**/api/claims/${item.id}/evidence`, route => fulfillJson(route, { items: [] }));
    await page.route(`**/api/claims/${item.id}/verification/templates`, route => fulfillJson(route, {
      category: "balo", template: { id: "wallet-bag", version: 1, minimumAnswers: 1, customFollowUpAllowed: true, prompts: [] }
    }));
  }
}

test("LOST Finder sees all four decision buttons without automatic ownership approval", async ({ page }) => {
  await setupDirectLostRoom(page);
  await page.route(`**/api/claims/${directLostClaim.id}/verification`, route => fulfillJson(route, directLostVerification));
  await page.goto(`/claims/${directLostClaim.id}`);
  await expect(page.locator(".review-actions button")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Đề xuất gặp mặt" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Yêu cầu thêm thông tin" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Từ chối", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Chuyển sang custody" })).toBeEnabled();
  await expect(page.getByText("Đang tải trạng thái xác minh...")).toHaveCount(0);
  await page.getByRole("button", { name: "Chuyển sang custody" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("lost-finder-controls-desktop.png"), fullPage: true });
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`custody review stays compact and opens keyboard-accessible details at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await setupDirectLostRoom(page);
    const reason = "Tôi sẽ bàn giao vật phẩm tại quầy để nhân viên đối chiếu và ghi nhận tình trạng. ".repeat(10);
    await page.route(`**/api/claims/${directLostClaim.id}/verification`, route => fulfillJson(route, {
      ...directLostVerification,
      appointmentEligible: true,
      roomEscalation: { escalatedAt: "2026-10-10T02:00:00.000Z", escalatedBy: session.user.id, reason },
      history: [{ id: "custody-event", action: "CUSTODY_ESCALATED", actorId: session.user.id, createdAt: "2026-10-10T02:00:00.000Z", metadata: { decision: "ESCALATE_TO_CUSTODY", reason } }]
    }));
    await page.route(`**/api/claims/${directLostClaim.id}/messages*`, route => fulfillJson(route, {
      room: { id: directLostClaim.roomId, claimId: directLostClaim.id, status: directLostClaim.status, participantRole: "FINDER", createdAt: directLostClaim.createdAt },
      items: [{ id: "message-visible", roomId: directLostClaim.roomId, sender: directLostClaim.claimant, content: "Cảm ơn bạn, tôi vẫn có thể trao đổi ở đây.", messageType: "TEXT", createdAt: "2026-10-10T02:01:00.000Z", isRead: true, readAt: null }],
      hasMore: false, nextCursor: null
    }));
    await page.goto(`/claims/${directLostClaim.id}`);
    const header = page.locator(".claim-chat-header");
    await expect(header.getByText("Đã gửi yêu cầu chuyển sang custody", { exact: true })).toHaveCount(1);
    await expect(header).not.toContainText(reason);
    await expect(header.getByRole("button", { name: "Điều chỉnh quyết định" })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Lịch hẹn", exact: true })).toBeVisible();
    await expect(page.getByText("Cảm ơn bạn, tôi vẫn có thể trao đổi ở đây.", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const review = await page.locator(".claim-chat-review").boundingBox();
    const chat = await page.locator(".claim-chat-scroll").boundingBox();
    expect(review!.height).toBeLessThan(220);
    expect(chat!.height).toBeGreaterThan(220);
    await expect(header.locator(".review-progress strong")).toHaveCSS("font-size", "13px");
    await expect(header.locator(".review-outcome > strong")).toHaveCSS("font-size", "13px");
    await page.screenshot({ path: test.info().outputPath(`compact-custody-${viewport.width}.png`) });
    await page.getByLabel("Tin nhắn riêng").fill("Bản nháp không bị mất khi xem chi tiết");

    const detailsButton = header.getByRole("button", { name: "Chi tiết xác minh", exact: true });
    await detailsButton.click();
    const dialog = page.getByRole("dialog", { name: "Chi tiết xác minh", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(reason.trim());
    await expect(dialog.getByRole("button", { name: "Đóng chi tiết xác minh" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Đóng chi tiết xác minh" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Đóng chi tiết xác minh" })).toBeFocused();
    await page.screenshot({ path: test.info().outputPath(`verification-details-${viewport.width}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(detailsButton).toBeFocused();
    await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("Bản nháp không bị mất khi xem chi tiết");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test("accepted review keeps the appointment and correction controls without repeating long reasons", async ({ page }) => {
  await setupDirectLostRoom(page);
  const reason = "Đã đối chiếu những đặc điểm riêng của vật phẩm trước khi đề xuất gặp mặt.";
  await page.route(`**/api/claims/${directLostClaim.id}/verification`, route => fulfillJson(route, {
    ...directLostVerification,
    status: "ACCEPTED",
    appointmentEligible: true,
    policy: { ...directLostVerification.policy, readyForDecision: true, answeredCount: 1 },
    history: [{ id: "accepted-event", action: "VERIFICATION_ACCEPTED", actorId: session.user.id, createdAt: "2026-10-10T02:00:00.000Z", metadata: { decision: "VERIFY_FOR_MEETUP", reason } }]
  }));
  await page.goto(`/claims/${directLostClaim.id}`);
  const header = page.locator(".claim-chat-header");
  await expect(header.getByText("Đủ điều kiện đặt lịch", { exact: true })).toBeVisible();
  await expect(header).not.toContainText(reason);
  await expect(header.getByRole("button", { name: "Lịch hẹn", exact: true })).toBeVisible();
  await header.getByRole("button", { name: "Điều chỉnh quyết định", exact: true }).click();
  await expect(header.locator(".review-actions button")).toHaveCount(4);
  await expect(header.getByRole("button", { name: "Chuyển sang custody", exact: true })).toBeEnabled();
  await header.getByRole("button", { name: "Ẩn lựa chọn quyết định", exact: true }).click();
  await expect(header.locator(".review-actions button")).toHaveCount(0);
});

const meetupVerification={...directLostVerification,status:"ACCEPTED",appointmentEligible:true,
  policy:{...directLostVerification.policy,readyForDecision:true,photoContactEligible:true},
  history:[{id:"accepted-event",action:"VERIFICATION_ACCEPTED",actorId:session.user.id,createdAt:"2026-10-10T02:00:00Z",metadata:{decision:"VERIFY_FOR_MEETUP",reason:"Compare in person"}}]};
function chatAppointment(overrides:Record<string,unknown>={}){
  return {id:"chat-appointment",claimId:directLostClaim.id,postId:directLostClaim.foundPostId,title:"Balo bị mất",proposerId:session.user.id,
    finderId:session.user.id,ownerId:"lost-owner",status:"PENDING",proposedAt:new Date(Date.now()+86400000).toISOString(),
    handoverPointId:null,location:"Sảnh thư viện",version:1,finderResponse:"PENDING",ownerResponse:"PENDING",noShowUserId:null,
    custodyAuthorized:false,completedAt:null,itemImageUrl:`/api/posts/${directLostClaim.foundPostId}/media/item-image`,events:[],...overrides};
}
async function setupChatAppointments(page:Page){
  await setupDirectLostRoom(page,[{...directLostClaim,status:"ACCEPTED"}]);
  await page.route(`**/api/claims/${directLostClaim.id}/verification`,route=>fulfillJson(route,meetupVerification));
  await page.route("**/api/handover-points",route=>fulfillJson(route,{handoverPoints:[{id:"desk-a",name:"Quầy Staff",address:"Sảnh A",isActive:true}]}));
  await page.route(/\/api\/appointments(?:\?.*)?$/,route=>fulfillJson(route,{results:[],total:0}));
  await page.route("**/api/appointments/chat-appointment",route=>fulfillJson(route,chatAppointment()));
  const image=readFileSync(new URL("./fixtures/appointment-item.png",import.meta.url));
  await page.route("**/api/posts/*/media/item-image",route=>route.fulfill({contentType:"image/png",body:image}));
}

for(const width of [1440,390])test(`chat appointment popup creates a custom-location meeting, preserves draft and traps focus (${width}px)`,async({page},info)=>{
  await page.setViewportSize({width,height:900});await setupChatAppointments(page);
  const calls:Array<Record<string,unknown>>=[];let release:()=>void=()=>{};
  await page.route("**/api/appointments",async route=>{
    if(route.request().method()!=="POST")return route.fallback();
    calls.push(route.request().postDataJSON());
    if(calls.length===1)return route.fulfill({status:503,json:{message:"Tạm thời mất kết nối, thử lại"}});
    await new Promise<void>(resolve=>{release=resolve;});await fulfillJson(route,chatAppointment());
  });
  await page.goto(`/claims/${directLostClaim.id}`);
  await page.getByLabel("Tin nhắn riêng").fill("Giữ lại bản nháp của tôi");
  const open=page.locator(".review-tools").getByRole("button",{name:"Lịch hẹn",exact:true});await open.click();
  const dialog=page.getByRole("dialog",{name:"Lịch hẹn trả đồ",exact:true});const close=dialog.getByRole("button",{name:"Đóng lịch hẹn"});
  await expect(close).toBeFocused();await expect(dialog.getByLabel("Thời gian hẹn")).toBeVisible();
  await page.keyboard.press("Shift+Tab");expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Tab");await expect(close).toBeFocused();
  await page.getByLabel("Tin nhắn riêng").evaluate(element=>(element as HTMLElement).focus());await expect(close).toBeFocused();
  await dialog.getByRole("radio",{name:"Địa điểm riêng",exact:true}).check();
  await dialog.getByLabel("Thời gian hẹn").fill(new Date(Date.now()+86400000).toISOString().slice(0,16));
  await dialog.getByLabel("Địa điểm hẹn riêng").fill("  Sảnh thư viện  ");
  await page.screenshot({path:info.outputPath(`chat-appointment-proposal-${width}.png`)});
  await dialog.getByRole("button",{name:"Gửi đề xuất"}).click();await expect(dialog.getByRole("alert")).toContainText("Tạm thời mất kết nối");
  await dialog.getByRole("button",{name:"Gửi đề xuất"}).click();await expect(close).toBeDisabled();
  await page.keyboard.press("Escape");await expect(dialog).toBeVisible();release();
  await expect(dialog.locator(".appointment-overview")).toBeVisible();
  expect(calls[0].requestKey).toBe(calls[1].requestKey);expect(calls[1]).toMatchObject({claimId:directLostClaim.id,customLocation:"Sảnh thư viện"});
  expect(calls[1].handoverPointId).toBeUndefined();await expect(page).toHaveURL(`/claims/${directLostClaim.id}`);
  const preview=dialog.getByRole("button",{name:"Phóng to ảnh Balo bị mất",exact:true});await expect(preview).toBeVisible();await preview.click();
  await expect(page.getByRole("dialog",{name:"Ảnh vật phẩm",exact:true})).toBeVisible();await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog",{name:"Ảnh vật phẩm",exact:true})).toHaveCount(0);await expect(dialog).toBeVisible();await expect(preview).toBeFocused();
  await page.screenshot({path:info.outputPath(`chat-appointment-detail-${width}.png`)});
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await expect(open).toBeFocused();
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("Giữ lại bản nháp của tôi");
});

test("chat popup cancels an existing meetup before Finder changes to custody",async({page})=>{
  await setupChatAppointments(page);let a=chatAppointment({status:"ACCEPTED",version:2});let cancelled:Record<string,unknown>|null=null;
  await page.route(/\/api\/appointments(?:\?.*)?$/,route=>fulfillJson(route,{results:[a],total:1}));
  await page.route("**/api/appointments/chat-appointment",route=>fulfillJson(route,a));
  await page.route("**/api/appointments/chat-appointment/actions",route=>{
    cancelled=route.request().postDataJSON();a={...a,status:"CANCELLED",version:3};return fulfillJson(route,a);
  });
  let transfer:Record<string,unknown>|null=null;
  await page.route(`**/api/claims/${directLostClaim.id}/verification/decision`,route=>{
    transfer=route.request().postDataJSON();return fulfillJson(route,{claim:{...directLostClaim,status:"ACCEPTED"},verification:{...meetupVerification,roomEscalation:{escalatedAt:new Date().toISOString(),escalatedBy:session.user.id,reason:"Không rảnh cùng giờ"}},message:null});
  });
  await page.goto(`/claims/${directLostClaim.id}`);await page.getByRole("button",{name:"Lịch hẹn",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Lịch hẹn trả đồ",exact:true});
  await expect(dialog.getByLabel("Thời gian hẹn")).toHaveCount(0);
  await dialog.getByRole("button",{name:"Xem lịch hẹn Balo bị mất",exact:true}).click();
  await dialog.getByLabel("Lý do hủy / ghi chú đối soát").fill("Không rảnh cùng giờ, bàn giao cho Staff");
  await dialog.getByRole("button",{name:"Hủy lịch",exact:true}).click();await expect(dialog.getByText("Đã hủy",{exact:true})).toBeVisible();
  expect(cancelled).toMatchObject({action:"CANCEL",version:2});await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Điều chỉnh quyết định",exact:true}).click();
  await page.getByRole("button",{name:"Chuyển sang custody",exact:true}).click();
  const custody=page.getByRole("dialog",{name:"Yêu cầu Bàn giao cho Quầy Staff (Custody)"});
  await custody.getByLabel("Ghi chú / Lời nhắn cho Staff").fill("Không rảnh cùng giờ");
  await custody.getByRole("button",{name:"Gửi Yêu cầu Bàn giao"}).click();
  await expect(custody).toHaveCount(0);expect(transfer).toMatchObject({decision:"ESCALATE_TO_CUSTODY",correctsEventId:"accepted-event",handoverPointId:"desk-a"});
  await expect(page.getByText("Đã gửi yêu cầu chuyển sang custody",{exact:true})).toBeVisible();
  await expect(page).toHaveURL(`/claims/${directLostClaim.id}`);
  await page.getByRole("button",{name:"Lịch hẹn",exact:true}).click();
  await expect(dialog.getByLabel("Thời gian hẹn")).toHaveCount(0);await expect(dialog.getByRole("status")).toContainText("Vật phẩm đang chuyển sang kho");
  await page.keyboard.press("Escape");
});

test("the owner accepts the counterpart proposal inside chat without Finder correction controls",async({page})=>{
  await setupChatAppointments(page);
  await page.route(`**/api/claims/${directLostClaim.id}`,route=>fulfillJson(route,{...directLostClaim,status:"ACCEPTED",finderId:"other-finder",claimantId:session.user.id,
    finder:{id:"other-finder",fullName:"Finder"},claimant:{id:session.user.id,fullName:session.user.fullName}}));
  await page.route(`**/api/claims/${directLostClaim.id}/verification`,route=>fulfillJson(route,{...meetupVerification,participantRole:"CLAIMANT"}));
  let a=chatAppointment({finderId:"other-finder",proposerId:"other-finder",ownerId:session.user.id});let action:Record<string,unknown>|null=null;
  await page.route(/\/api\/appointments(?:\?.*)?$/,route=>fulfillJson(route,{results:[a],total:1}));
  await page.route("**/api/appointments/chat-appointment",route=>fulfillJson(route,a));
  await page.route("**/api/appointments/chat-appointment/actions",route=>{action=route.request().postDataJSON();a={...a,status:"ACCEPTED",version:2};return fulfillJson(route,a);});
  await page.goto(`/claims/${directLostClaim.id}`);await expect(page.getByRole("button",{name:"Điều chỉnh quyết định",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Lịch hẹn",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Lịch hẹn trả đồ",exact:true});
  await dialog.getByRole("button",{name:"Xem lịch hẹn Balo bị mất",exact:true}).click();
  await dialog.getByRole("button",{name:"Chấp nhận lịch",exact:true}).click();
  await expect(dialog.getByText("Đã chấp nhận",{exact:true})).toBeVisible();expect(action).toMatchObject({action:"ACCEPT",version:1});
  await expect(dialog.getByRole("button",{name:"Xác nhận đã nhận đồ",exact:true})).toBeDisabled();await expect(page).toHaveURL(`/claims/${directLostClaim.id}`);
  await page.keyboard.press("Escape");
});

test("closing and reopening the popup ignores the earlier list response",async({page})=>{
  await setupChatAppointments(page);let reads=0;let finish:()=>void=()=>{};
  await page.route(/\/api\/appointments(?:\?.*)?$/,async route=>{
    if(++reads===1){await new Promise<void>(resolve=>{finish=resolve;});return fulfillJson(route,{results:[chatAppointment({title:"Obsolete response"})],total:1});}
    return fulfillJson(route,{results:[],total:0});
  });
  await page.goto(`/claims/${directLostClaim.id}`);const open=page.getByRole("button",{name:"Lịch hẹn",exact:true});
  await open.click();await expect.poll(()=>reads).toBe(1);await page.keyboard.press("Escape");await open.click();
  await expect(page.getByRole("dialog").getByLabel("Thời gian hẹn")).toBeVisible();finish();
  await expect.poll(()=>reads).toBe(2);await expect(page.getByText("Obsolete response",{exact:true})).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("verification failure is red, stops automatic retries and recovers without losing the message draft", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await setupDirectLostRoom(page);
  let requests = 0;
  await page.route(`**/api/claims/${directLostClaim.id}/verification`, async route => {
    requests++;
    if (requests === 1) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Verification temporarily unavailable" }) });
    await fulfillJson(route, directLostVerification);
  });
  await page.goto(`/claims/${directLostClaim.id}`);
  await expect(page.locator(".review-load-error")).toContainText("Verification temporarily unavailable");
  await expect(page.locator(".review-load-error")).toHaveCSS("color", "rgb(180, 35, 24)");
  await expect(page.getByText("Đang tải trạng thái xác minh...")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("verification-error-mobile.png"), fullPage: true });
  await page.getByLabel("Tin nhắn riêng").fill("Draft kept after verification failure");
  await page.clock.fastForward(15000);
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.locator(".review-actions button")).toHaveCount(4);
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("Draft kept after verification failure");
  expect(requests).toBe(2);
});

test("a late verification response cannot replace another room's error state", async ({ page }) => {
  const second = { ...directLostClaim, id: claimB.id, posts: { lost: null, found: { id: claimB.foundPostId, title: "Balo phòng B" } }, item: { ...directLostClaim.item, title: "Balo phòng B" } };
  await setupDirectLostRoom(page, [directLostClaim, second]);
  let firstStarted = false;
  await page.route(`**/api/claims/${directLostClaim.id}/verification`, async route => {
    firstStarted = true;
    await new Promise(resolve => setTimeout(resolve, 700));
    await fulfillJson(route, directLostVerification);
  });
  await page.route(`**/api/claims/${second.id}/verification`, route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Room B verification unavailable" }) }));
  await page.goto(`/claims/${directLostClaim.id}`);
  await expect.poll(() => firstStarted).toBe(true);
  await page.getByRole("button", { name: /Balo phòng B/ }).click();
  await expect(page.locator(".review-load-error")).toContainText("Room B verification unavailable");
  await page.waitForTimeout(850);
  await expect(page.locator(".review-load-error")).toContainText("Room B verification unavailable");
  await expect(page.locator(".review-actions button")).toHaveCount(0);
});

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
  await expect(page.locator(".claim-messages .claim-message").getByText("Thông tin của phòng B", { exact: true })).toBeVisible();
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
  await expect(page.getByText("Xác minh vật phẩm", { exact: true })).toBeVisible();
  await expect(page.getByText("Có thể đưa ra quyết định", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đề xuất gặp mặt" }).click();
  await page.getByLabel("Lý do / nhận xét").fill("Các câu trả lời riêng phù hợp với vật phẩm");
  await page.getByRole("button", { name: "Xác nhận quyết định" }).click();

  await expect(page.getByText("Đủ điều kiện đặt lịch")).toBeVisible();
  expect(decisionRequest).not.toBeNull();
  expect(decisionRequest!.header).toBeTruthy();
  expect(decisionRequest!.body.decision).toBe("VERIFY_FOR_MEETUP");
  expect(decisionRequest!.body).not.toHaveProperty("idempotencyKey");
});

test("Finder can request custody from chat without closing or deciding the claim", async ({ page }) => {
  const finderSession = { ...session, user: { ...session.user, id: "finder-a", fullName: "Finder A" } };
  const finderClaim = {
    ...claimA,
    claimantId: "claimant-a",
    finderId: "finder-a",
    appointmentEligible: false,
    conversationDecision: "OPEN_CONVERSATION"
  };
  const initialVerification = {
    claimId: finderClaim.id,
    status: "CONVERSATION_OPEN",
    appointmentEligible: false,
    participantRole: "FINDER",
    roomEscalation: null,
    policy: { templateId: "wallet-bag", templateVersion: 1, minimumAnswers: 1, answeredCount: 0, matchedCount: 0, readyForDecision: false },
    questions: [],
    history: []
  };
  const reason = "I cannot safely keep the item any longer";
  const handoverPointId = "66666666-6666-4666-8666-666666666666";
  let decisionBody: Record<string, unknown> | null = null;

  await page.route("**/api/auth/refresh", (route) => fulfillJson(route, finderSession));
  await page.route("**/api/handover-points", (route) => fulfillJson(route, {
    handoverPoints: [{ id: handoverPointId, name: "Campus Lost & Found Desk - Phòng CTSV", address: "Tòa Alpha", isActive: true }]
  }));
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
  await page.route(`**/api/claims/${finderClaim.id}/verification`, (route) => fulfillJson(route, initialVerification));
  await page.route(`**/api/claims/${finderClaim.id}/verification/decision`, async (route) => {
    decisionBody = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillJson(route, {
      claim: finderClaim,
      verification: {
        ...initialVerification,
        roomEscalation: { escalatedAt: "2026-09-18T02:00:00.000Z", escalatedBy: "finder-a", reason }
      },
      message: {
        id: "custody-message", roomId: "room-a", sender: { id: "finder-a", fullName: "Finder A" },
        clientMessageId: "verification-decision-custody-key", content: "Custody request sent to Staff",
        messageType: "SYSTEM", isRead: false, readAt: null, createdAt: "2026-09-18T02:00:00.000Z"
      }
    });
  });

  await page.goto(`/claims/${finderClaim.id}`);
  await page.getByRole("button", { name: /custody/i }).click();
  await expect(page.getByRole("heading", { name: "Yêu cầu Bàn giao cho Quầy Staff (Custody)" })).toBeVisible();
  await expect(page.locator(".claim-custody-hours")).toContainText("08:00/08:15–12:00");
  await page.locator("#claim-custody-handover-point").selectOption(handoverPointId);
  await page.locator("#claim-custody-reason").fill(reason);
  await page.getByRole("button", { name: "Gửi Yêu cầu Bàn giao" }).click();

  await expect(page.getByText("Đã gửi yêu cầu chuyển sang custody")).toBeVisible();
  await expect(page.getByText("Yêu cầu đang chờ Staff xử lý.")).toBeVisible();
  await expect(page.getByRole("button", { name: /custody/i })).toHaveCount(0);
  await expect(page.getByLabel("Tin nhắn riêng")).toBeEnabled();
  expect(decisionBody?.decision).toBe("ESCALATE_TO_CUSTODY");
  expect(decisionBody?.reason).toBe(reason);
  expect(decisionBody?.handoverPointId).toBe(handoverPointId);
});

function secondMutationRoom() {
  return { ...directLostClaim, id: claimB.id, roomId: "room-b", posts: { lost: null, found: { id: claimB.foundPostId, title: "Mutation room B" } }, item: { ...directLostClaim.item, title: "Mutation room B" } };
}

for (const outcome of ["success", "failure"] as const) test(`a delayed chat image ${outcome} cannot affect another room`, async ({ page }) => {
  const second = await setupMutationRooms(page);
  let started = false;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/claims/${directLostClaim.id}/messages/images`, async route => {
    started = true; await held;
    if (outcome === "failure") return route.fulfill({ status: 503, json: { message: "Room A image failed" } });
    await route.fulfill({ json: { id: "image-room-a", roomId: directLostClaim.roomId, sender: session.user,
      content: "ROOM_A_IMAGE", messageType: "IMAGE", mediaUrl: `/api/claims/${directLostClaim.id}/evidence/photo-a`, createdAt: "2026-10-06T00:00:00Z" } });
  });
  await page.goto(`/claims/${directLostClaim.id}`);
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await page.getByRole("button", { name: "Ảnh", exact: true }).click();
  await page.getByLabel("Ảnh gửi trong chat").setInputFiles({ name: "a.png", mimeType: "image/png", buffer: Buffer.from([137,80,78,71]) });
  await page.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByRole("button", { name: /Mutation room B/ }).click();
  await expect(page).toHaveURL(new RegExp(`/claims/${second.id}$`));
  await expect(page.getByRole("heading", { name: "Mutation room B" })).toBeVisible();
  await page.getByLabel("Tin nhắn riêng").fill("B image draft");
  await settleMutation(page, `/claims/${directLostClaim.id}/messages/images`, release);
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("B image draft");
  await expect(page.locator(".claim-alert")).toHaveCount(0);
  await expect(page.getByAltText("Ảnh chờ gửi")).toHaveCount(0);
  await expect(page.locator(".claim-messages")).not.toContainText("ROOM_A_IMAGE");
  await expect(page.getByRole("button", { name: "Gửi tin nhắn", exact: true })).toBeEnabled();
});

async function setupMutationRooms(page: Page, role = "FINDER") {
  const second = secondMutationRoom();
  await setupDirectLostRoom(page, [directLostClaim, second]);
  for (const claim of [directLostClaim, second]) {
    await page.route(`**/api/claims/${claim.id}/verification`, route => fulfillJson(route, { ...directLostVerification, claimId: claim.id, participantRole: role }));
  }
  return second;
}

async function settleMutation(page: Page, url: string, release: () => void) {
  const response = page.waitForResponse(result => result.url().endsWith(url) && result.request().method() === "POST");
  release();
  await (await response).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

for (const outcome of ["success", "failure"] as const) test(`a delayed message ${outcome} cannot alter another room or its draft`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const second = await setupMutationRooms(page);
  let started = false;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/claims/${directLostClaim.id}/messages`, async route => {
    if (route.request().method() !== "POST") return route.fallback();
    started = true;
    await held;
    if (outcome === "failure") return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Room A send failed" }) });
    await fulfillJson(route, { id: "late-room-a", roomId: directLostClaim.roomId, sender: { id: session.user.id, fullName: session.user.fullName }, content: "ROOM_A_MESSAGE", messageType: "TEXT", createdAt: "2026-10-05T01:00:00Z" });
  });
  await page.goto(`/claims/${directLostClaim.id}`);
  await page.getByLabel("Tin nhắn riêng").fill("ROOM_A_MESSAGE");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByRole("button", { name: /Cuộc trò chuyện \(/ }).click();
  await page.getByRole("button", { name: /Mutation room B/ }).click();
  await expect(page).toHaveURL(new RegExp(`/claims/${second.id}$`));
  await expect(page.getByRole("heading", { name: "Mutation room B" })).toBeVisible();
  await page.getByLabel("Tin nhắn riêng").fill("ROOM_B_DRAFT");
  await expect(page.getByRole("button", { name: "Gửi tin nhắn" })).toBeEnabled();
  await settleMutation(page, `/claims/${directLostClaim.id}/messages`, release);
  await expect(page.locator(".claim-messages")).not.toContainText("ROOM_A_MESSAGE");
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("ROOM_B_DRAFT");
  await expect(page.locator(".claim-alert")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath(`room-switch-send-${outcome}.png`), fullPage: true });
});

test("a late verification decision cannot replace the next room's claim or review", async ({ page }) => {
  const second = await setupMutationRooms(page);
  let started = false;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/claims/${directLostClaim.id}/verification/decision`, async route => {
    started = true;
    await held;
    await fulfillJson(route, {
      claim: { ...directLostClaim, status: "REJECTED" }, verification: { ...directLostVerification, status: "REJECTED" },
      message: { id: "late-decision-a", roomId: directLostClaim.roomId, sender: { id: session.user.id, fullName: session.user.fullName }, content: "ROOM_A_DECISION", messageType: "SYSTEM", createdAt: "2026-10-05T01:00:00Z" }
    });
  });
  await page.goto(`/claims/${second.id}`);
  await page.getByRole("button", { name: /Balo bị mất/ }).click();
  await page.getByRole("button", { name: "Từ chối", exact: true }).click();
  await page.getByLabel("Lý do / nhận xét").fill("Room A verification declined");
  await page.getByRole("button", { name: "Xác nhận quyết định" }).click();
  await expect.poll(() => started).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/claims/${second.id}$`));
  await expect(page.getByRole("heading", { name: "Mutation room B" })).toBeVisible();
  await page.getByLabel("Tin nhắn riêng").fill("B decision draft");
  await settleMutation(page, `/claims/${directLostClaim.id}/verification/decision`, release);
  await expect(page.getByRole("heading", { name: "Mutation room B" })).toBeVisible();
  await expect(page.locator(".review-actions button")).toHaveCount(4);
  await expect(page.locator(".claim-messages")).not.toContainText("ROOM_A_DECISION");
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("B decision draft");
});

test("a late evidence upload stays with the original room and resets upload UI", async ({ page }) => {
  const second = await setupMutationRooms(page, "CLAIMANT");
  let started = false;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/claims/${directLostClaim.id}/evidence`, async route => {
    if (route.request().method() !== "POST") return route.fallback();
    started = true;
    await held;
    await fulfillJson(route, { id: "evidence-a", claimId: directLostClaim.id, evidenceType: "PHOTO", description: "ROOM_A_EVIDENCE", url: `/api/claims/${directLostClaim.id}/evidence/evidence-a/media`, uploadedBy: { id: session.user.id, fullName: session.user.fullName }, createdAt: "2026-10-05T01:00:00Z" });
  });
  await page.goto(`/claims/${directLostClaim.id}`);
  await page.getByRole("button", { name: "Thêm evidence" }).click();
  await page.locator(".evidence-upload-compact input[type=file]").setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: Buffer.from("synthetic-browser-fixture") });
  await page.getByRole("button", { name: "Tải lên", exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByRole("button", { name: /Mutation room B/ }).click();
  await expect(page).toHaveURL(new RegExp(`/claims/${second.id}$`));
  await expect(page.getByRole("heading", { name: "Mutation room B" })).toBeVisible();
  await page.getByLabel("Tin nhắn riêng").fill("B upload draft");
  await settleMutation(page, `/claims/${directLostClaim.id}/evidence`, release);
  await expect(page.locator(".evidence-count")).toContainText("0 private evidence items");
  await expect(page.locator(".evidence-thumbnails")).toHaveCount(0);
  await expect(page.locator(".evidence-upload-compact")).toHaveCount(0);
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("B upload draft");
});

test("returning to the same claim does not revive an old mutation generation", async ({ page }) => {
  const second = await setupMutationRooms(page);
  let started = false;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/claims/${directLostClaim.id}/messages`, async route => {
    if (route.request().method() !== "POST") return route.fallback();
    started = true;
    await held;
    await fulfillJson(route, { id: "old-generation-a", roomId: directLostClaim.roomId, sender: { id: session.user.id, fullName: session.user.fullName }, content: "OLD_A_GENERATION", messageType: "TEXT", createdAt: "2026-10-05T01:00:00Z" });
  });
  await page.goto(`/claims/${directLostClaim.id}`);
  await page.getByLabel("Tin nhắn riêng").fill("OLD_A_GENERATION");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByRole("button", { name: /Mutation room B/ }).click();
  await expect(page.getByRole("heading", { name: "Mutation room B" })).toBeVisible();
  await page.getByRole("button", { name: /Balo bị mất/ }).click();
  await expect(page.getByRole("heading", { name: "Balo bị mất", exact: true })).toBeVisible();
  await page.getByLabel("Tin nhắn riêng").fill("NEW_A_GENERATION_DRAFT");
  await settleMutation(page, `/claims/${directLostClaim.id}/messages`, release);
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("NEW_A_GENERATION_DRAFT");
  await expect(page.locator(".claim-messages")).not.toContainText("OLD_A_GENERATION");
  await expect(page).not.toHaveURL(new RegExp(`/claims/${second.id}$`));
});

test("finishing the previous room's send cannot unlock a pending send in the current room", async ({ page }) => {
  const second = await setupMutationRooms(page);
  const releases = new Map<string, () => void>();
  for (const claim of [directLostClaim, second]) {
    await page.route(`**/api/claims/${claim.id}/messages`, async route => {
      if (route.request().method() !== "POST") return route.fallback();
      await new Promise<void>(resolve => releases.set(claim.id, resolve));
      await fulfillJson(route, { id: `message-${claim.id}`, roomId: claim.roomId, sender: { id: session.user.id, fullName: session.user.fullName }, content: route.request().postDataJSON().content, messageType: "TEXT", createdAt: "2026-10-05T01:00:00Z" });
    });
  }
  await page.goto(`/claims/${directLostClaim.id}`);
  await page.getByLabel("Tin nhắn riêng").fill("PENDING_A");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect.poll(() => releases.has(directLostClaim.id)).toBe(true);
  await page.getByRole("button", { name: /Mutation room B/ }).click();
  await expect(page.getByRole("heading", { name: "Mutation room B" })).toBeVisible();
  await page.getByLabel("Tin nhắn riêng").fill("PENDING_B");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect.poll(() => releases.has(second.id)).toBe(true);
  await settleMutation(page, `/claims/${directLostClaim.id}/messages`, releases.get(directLostClaim.id)!);
  await expect(page.getByRole("button", { name: "Gửi tin nhắn" })).toBeDisabled();
  await expect(page.getByLabel("Tin nhắn riêng")).toHaveValue("PENDING_B");
  await settleMutation(page, `/claims/${second.id}/messages`, releases.get(second.id)!);
  await expect(page.locator(".claim-messages")).toContainText("PENDING_B");
  await expect(page.locator(".claim-messages")).not.toContainText("PENDING_A");
});
