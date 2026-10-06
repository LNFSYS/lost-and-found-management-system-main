import { expect, test, type Page } from "@playwright/test";
import type { Appointment } from "../src/services/workflow-types";

const finder="11111111-1111-4111-8111-111111111111";
const owner="22222222-2222-4222-8222-222222222222";
const claim="33333333-3333-4333-8333-333333333333";
const id="44444444-4444-4444-8444-444444444444";
const post="55555555-5555-4555-8555-555555555555";
const point="66666666-6666-4666-8666-666666666666";
function appointment(overrides:Partial<Appointment>={}):Appointment{return {id,claimId:claim,postId:post,title:"Điện thoại Apple iPhone màu đỏ mận",proposerId:finder,finderId:finder,ownerId:owner,
  status:"ACCEPTED",proposedAt:new Date(Date.now()-40*60000).toISOString(),handoverPointId:point,location:"Campus Lost & Found Desk",version:2,finderResponse:"PENDING",ownerResponse:"PENDING",noShowUserId:null,custodyAuthorized:false,completedAt:null,
  events:[{id:"proposal",action:"PROPOSED",actorId:finder,createdAt:new Date().toISOString()}],...overrides};}
async function prepare(page:Page,userId=finder,admin=false){
  await page.route("**/api/**",async route=>{const path=new URL(route.request().url()).pathname;
    if(path==="/api/auth/refresh")return route.fulfill({json:{accessToken:"fixture-token",accessTokenExpiresIn:"15m",user:{id:userId,email:"fixture@example.invalid",fullName:"Người dùng thử",roles:admin?["USER","ADMIN"]:["USER"],status:"ACTIVE",studentCode:null,phoneNumber:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}});
    if(path==="/api/notifications")return route.fulfill({json:{items:[],unreadTotal:0}});
    if(path==="/api/handover-points")return route.fulfill({json:{handoverPoints:[{id:point,name:"Campus Lost & Found Desk",address:"Sảnh A",isActive:true}]}});
    if(path==="/api/appointments")return route.fulfill({json:{results:[appointment()],total:1}});
    if(path.startsWith("/api/appointments/"))return route.fulfill({json:appointment()});
    return route.fulfill({status:404,json:{message:"Fixture route missing"}});
  });
}
test("proposal opens from claim context and keyboard submits a stable retry key",async({page})=>{
  await prepare(page);const calls:Array<Record<string,unknown>>=[];
  await page.route("**/api/appointments",async route=>{if(route.request().method()!=="POST")return route.fallback();calls.push(route.request().postDataJSON());
    if(calls.length===1)return route.fulfill({status:503,json:{message:"Kết nối tạm thời lỗi, thử lại"}});return route.fulfill({status:201,json:appointment({status:"PENDING"})});});
  await page.goto(`/appointments?claimId=${claim}`);await page.getByLabel("Thời gian hẹn").fill(new Date(Date.now()+86400000).toISOString().slice(0,16));await page.getByLabel("Điểm hẹn").selectOption(point);
  await page.getByRole("button",{name:"Gửi đề xuất"}).focus();await page.keyboard.press("Enter");await expect(page.getByRole("alert")).toContainText("Kết nối tạm thời");
  await page.getByRole("button",{name:"Gửi đề xuất"}).click();await expect(page).toHaveURL(`/appointments/${id}`);expect(calls[0].requestKey).toBe(calls[1].requestKey);expect(calls[1].claimId).toBe(claim);
});
test("Finder physical acknowledgement does not pretend the owner received the item",async({page})=>{
  await prepare(page);let saved:Record<string,unknown>|null=null;
  await page.route(`**/api/appointments/${id}/actions`,async route=>{saved=route.request().postDataJSON();return route.fulfill({json:appointment({version:3,finderResponse:"CONFIRMED"})});});
  await page.goto(`/appointments/${id}`);const button=page.getByRole("button",{name:"Xác nhận đã giao đồ",exact:true});await expect(button).toBeDisabled();await page.getByRole("checkbox").check();await button.click();
  await expect(page.getByText("Đã chấp nhận",{exact:true})).toBeVisible();await expect(page.getByText("Đã trả đồ",{exact:true})).toHaveCount(0);
  expect(saved).toMatchObject({action:"CONFIRM",version:2,physicallyChecked:true});await expect(page.getByRole("link",{name:"Báo cáo vấn đề bàn giao"})).toHaveAttribute("href",`/reports?targetType=HANDOVER&targetId=${id}`);
});
test("Owner acknowledgement and disagreement controls remain distinct",async({page})=>{
  await prepare(page,owner);await page.route(`**/api/appointments/${id}`,route=>route.fulfill({json:appointment({finderResponse:"CONFIRMED",ownerResponse:"DISPUTED"})}));
  await page.goto(`/appointments/${id}`);await expect(page.getByRole("alert")).toContainText("Vật phẩm chưa được đánh dấu đã trả");await expect(page.getByRole("button",{name:"Xác nhận đã nhận đồ",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Báo bên còn lại không đến"})).toBeDisabled();await page.getByRole("checkbox").check();await expect(page.getByRole("button",{name:"Xác nhận đã nhận đồ",exact:true})).toBeEnabled();
});
test("cancel requires a reason and no-show uses the correct participant action",async({page})=>{
  await prepare(page);let saved:Record<string,unknown>|null=null;await page.route(`**/api/appointments/${id}/actions`,route=>{saved=route.request().postDataJSON();return route.fulfill({json:appointment({status:"CANCELLED",noShowUserId:owner})});});
  await page.goto(`/appointments/${id}`);await page.getByRole("button",{name:"Hủy lịch",exact:true}).click();await expect(page.getByRole("alert")).toContainText("Nhập lý do hủy");expect(saved).toBeNull();
  await page.getByRole("button",{name:"Báo bên còn lại không đến"}).click();await expect(page.getByText("Đây là ghi nhận một phía",{exact:false})).toBeVisible();expect(saved).toMatchObject({action:"NO_SHOW"});
});
for(const viewport of [{width:1440,height:900},{width:390,height:844}])test(`appointment and complete journey fit ${viewport.width}px`,async({page},info)=>{
  await page.setViewportSize(viewport);await prepare(page);await page.goto(`/appointments/${id}`);await expect(page.getByRole("heading",{name:"Lịch hẹn trả đồ"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`appointment-${viewport.width}.png`),fullPage:true});
  await page.route(`**/api/posts/${post}/journey*`,route=>route.fulfill({json:{title:"Điện thoại Apple iPhone màu đỏ mận",status:"RESOLVED",total:4,page:1,hasMore:false,asOf:new Date().toISOString(),summary:{custodian:"OWNER",locationClass:"RETURNED",receivedAt:new Date(Date.now()-7200000).toISOString(),returnedAt:new Date().toISOString(),custodyHours:2,feedbackEligible:true},results:[
    {id:"p",source:"POST",action:"POST_CREATED"},{id:"c",source:"CLAIM",action:"CONVERSATION_OPENED"},{id:"w",source:"WAREHOUSE",action:"RECEIVED"},{id:"r",source:"RETURN",action:"RETURN_COMPLETED"}
  ].map((e,i)=>({...e,targetType:e.source,targetId:post,actorId:null,createdAt:new Date(Date.now()-(4-i)*60000).toISOString(),fromStatus:null,toStatus:null}))}}));
  await page.goto(`/posts/${post}/journey`);await expect(page.getByRole("list").getByText("Đăng bài",{exact:true})).toBeVisible();await expect(page.getByRole("list").getByText("Tiếp nhận vào kho",{exact:true})).toBeVisible();await expect(page.getByRole("list").getByText("Hoàn tất trả đồ",{exact:true})).toBeVisible();
  await expect(page.getByText("Đủ điều kiện gửi đánh giá",{exact:true})).toBeVisible();await expect(page.getByText("2 giờ",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`journey-${viewport.width}.png`),fullPage:true});
});
test("Admin filters global audit, downloads CSV and has a separate sidebar entry",async({page},info)=>{
  await prepare(page,finder,true);let filtered=false;
  await page.route(/\/api\/admin\/audit(?:\/export)?(?:\?.*)?$/,route=>{const url=new URL(route.request().url());if(url.pathname.endsWith("/export"))return route.fulfill({contentType:"text/csv",headers:{"content-disposition":"attachment; filename=lnfs-audit.csv"},body:"id,action\r\nentry,RETURN_COMPLETED"});
    if(url.searchParams.get("query")==="RETURN")filtered=true;return route.fulfill({json:{total:1,results:[{id:"entry",source:"WAREHOUSE",action:"RETURN_COMPLETED",targetType:"WAREHOUSE",targetId:post,actorId:finder,createdAt:new Date().toISOString(),fromStatus:"RECEIVED",toStatus:"RETURNED"}]}});});
  await page.goto("/admin/audit");await page.getByLabel("Từ khóa").fill("RETURN");await page.getByRole("button",{name:"Tìm kiếm",exact:true}).click();await expect(page.getByRole("cell",{name:"RETURN_COMPLETED",exact:false})).toBeVisible();await expect.poll(()=>filtered).toBe(true);
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Xuất nhật ký"}).click();expect((await download).suggestedFilename()).toBe("lnfs-audit.csv");
  await page.screenshot({path:info.outputPath("admin-audit.png"),fullPage:true});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath("admin-audit-mobile.png"),fullPage:true});
});
test("late acknowledgement from A cannot replace B or unlock B's pending action",async({page})=>{
  await prepare(page);const b="77777777-7777-4777-8777-777777777777";const other=appointment({id:b,title:"Ví da màu đen"});
  await page.route(/\/api\/appointments(?:\?.*)?$/,route=>route.fulfill({json:{results:[other],total:1}}));
  await page.route(`**/api/appointments/${b}`,route=>route.fulfill({json:other}));
  let releaseA!:()=>void;let releaseB!:()=>void;const heldA=new Promise<void>(r=>{releaseA=r;});const heldB=new Promise<void>(r=>{releaseB=r;});let startedA=false;let startedB=false;
  await page.route("**/api/appointments/*/actions",async route=>{const isB=route.request().url().includes(b);if(isB){startedB=true;await heldB;}else{startedA=true;await heldA;}
    return route.fulfill({json:isB?{...other,version:3,finderResponse:"CONFIRMED"}:appointment({status:"COMPLETED",version:4})});});
  try{
  await page.goto(`/appointments/${id}`);await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Xác nhận đã giao đồ",exact:true}).click();await expect.poll(()=>startedA).toBe(true);
  await page.getByRole("link",{name:"Tất cả lịch",exact:true}).click();await page.getByRole("link",{name:other.title,exact:true}).click();await page.getByRole("checkbox").check();await page.getByLabel("Lý do hủy / ghi chú đối soát").fill("Ghi chú phòng B");
  await page.getByRole("button",{name:"Xác nhận đã giao đồ",exact:true}).click();await expect.poll(()=>startedB).toBe(true);releaseA();await page.waitForTimeout(100);
  await expect(page.getByRole("heading",{name:other.title,exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Xác nhận đã giao đồ",exact:true})).toBeDisabled();await expect(page.getByLabel("Lý do hủy / ghi chú đối soát")).toHaveValue("Ghi chú phòng B");
  releaseB();await expect(page.getByRole("checkbox")).toBeEnabled();await expect(page.getByText("Đã trả đồ",{exact:true})).toHaveCount(0);
  }finally{releaseA();releaseB();}
});
test("User cannot open the Admin audit workspace",async({page})=>{await prepare(page);let called=false;await page.route("**/api/admin/audit*",route=>{called=true;return route.fulfill({status:403,json:{message:"Không được phép"}});});await page.goto("/admin/audit");await expect(page).not.toHaveURL("/admin/audit");expect(called).toBe(false);});
