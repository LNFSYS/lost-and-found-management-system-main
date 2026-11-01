import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Journey, JourneyEvent, JourneyImage } from "../src/services/workflow-types";
import { displayTime } from "../src/services/workflow-types";

const post="55555555-5555-4555-8555-555555555555";
const owner="22222222-2222-4222-8222-222222222222";
const itemImage=readFileSync(new URL("./fixtures/appointment-item.png",import.meta.url));
const snapshot="2026-10-10T10:00:00.000Z";
function image(kind:JourneyImage["kind"],id:string):JourneyImage {
  return {id,kind,createdAt:snapshot,url:`/api/posts/${post}/journey/images/${kind}/${id}?asOf=${encodeURIComponent(snapshot)}`};
}
function event(source:string,action:string,images:JourneyImage[]=[]):JourneyEvent {
  return {id:`${source}:${action}`,source,action,targetId:post,targetType:"POST",actorId:null,createdAt:snapshot,fromStatus:null,toStatus:null,images};
}
const events=[event("POST","POST_CREATED",[image("POST","post-image")]),event("CHAT","PHOTO_SHARED",[image("CLAIM","contact-photo")]),
  event("WAREHOUSE","RECEIVED",[image("INTAKE","intake-image")]),event("RETURN","RETURN_COMPLETED",[image("RETURN","return-proof")]),event("FEEDBACK","FEEDBACK_RECORDED")];
const journey=(results=events):Journey=>({title:"Điện thoại Apple iPhone màu đỏ mận",status:"RESOLVED",results,total:results.length,page:1,asOf:snapshot,hasMore:false});

async function prepare(page:Page,results=events) {
  const requests:string[]=[];
  await page.route("**/api/**",async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==="/api/auth/refresh")return route.fulfill({json:{accessToken:"fixture-token",accessTokenExpiresIn:"15m",user:{id:owner,email:"fixture@example.invalid",fullName:"Người dùng thử",roles:["USER"],status:"ACTIVE",studentCode:null,phoneNumber:null,createdAt:snapshot,updatedAt:snapshot}}});
    if(url.pathname==="/api/notifications")return route.fulfill({json:{items:[],unreadTotal:0}});
    if(url.pathname===`/api/posts/${post}/journey`)return route.fulfill({json:journey(results)});
    if(url.pathname.includes("/journey/images/")){
      expect(route.request().headers().authorization).toBe("Bearer fixture-token");expect(url.searchParams.get("asOf")).toBe(snapshot);
      requests.push(url.pathname);return route.fulfill({contentType:"image/png",body:itemImage});
    }
    return route.fulfill({status:404,json:{message:"Fixture route missing"}});
  });
  return requests;
}

for(const width of [1440,768,390,320])test(`journey photos render at their milestones with keyboard preview (${width}px)`,async({page},info)=>{
  await page.setViewportSize({width,height:900});const requests=await prepare(page);await page.goto(`/posts/${post}/journey`);
  const timeline=page.locator(".workflow-timeline");await expect(timeline.locator("img")).toHaveCount(4);
  const labels=["Ảnh bài đăng 1","Ảnh trao đổi 1","Ảnh tiếp nhận 1","Ảnh bàn giao 1"];
  for(let i=0;i<labels.length;i++){
    const milestone=timeline.locator("li").nth(i);await expect(milestone.getByRole("img",{name:labels[i],exact:true})).toBeVisible();
    await expect.poll(()=>milestone.locator("img").evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth===600)).toBe(true);
  }
  await expect(timeline.locator("li").nth(4).locator(".journey-images")).toHaveCount(0);
  expect(requests.length).toBe(4);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const overlappingHeaders=await timeline.locator("article").evaluateAll(cards=>cards.flatMap(card=>{
    const title=card.querySelector("h3")!.getBoundingClientRect();
    const labels=card.querySelectorAll(".item-journey-event__meta time,.workflow-source,.item-journey-latest");
    return Array.from(labels).some(label=>label.getBoundingClientRect().bottom>title.top)?[card.textContent]:[];
  }));
  expect(overlappingHeaders).toEqual([]);
  await page.screenshot({path:info.outputPath(`journey-photos-${width}.png`),fullPage:true});
  const open=page.getByRole("button",{name:"Xem Ảnh bàn giao 1",exact:true});await open.focus();await page.keyboard.press("Enter");
  const dialog=page.getByRole("dialog",{name:"Ảnh bàn giao 1",exact:true});await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img",{name:"Ảnh bàn giao 1",exact:true})).toBeVisible();
  await page.keyboard.press("Tab");await expect(dialog.getByRole("button",{name:"Đóng ảnh"})).toBeFocused();
  await page.keyboard.press("Shift+Tab");await expect(dialog.getByRole("button",{name:"Đóng ảnh"})).toBeFocused();
  await page.screenshot({path:info.outputPath(`journey-photo-preview-${width}.png`),animations:"disabled"});
  await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await expect(open).toBeFocused();
});

test("journey photo failure is recoverable and unavailable photos do not break the timeline",async({page})=>{
  await prepare(page);let attempts=0;
  await page.route("**/api/posts/*/journey/images/RETURN/**",route=>++attempts===1?route.fulfill({status:404,json:{message:"Not found"}}):route.fulfill({contentType:"image/png",body:itemImage}));
  await page.goto(`/posts/${post}/journey`);await expect(page.getByText("Không tải được ảnh",{exact:true})).toBeVisible();
  await expect(page.getByText("Hoàn tất trả đồ",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Tải lại Ảnh bàn giao 1",exact:true}).click();
  await expect(page.getByRole("button",{name:"Xem Ảnh bàn giao 1",exact:true})).toBeVisible();expect(attempts).toBe(2);
});

test("journey pagination preserves snapshot and existing photo galleries",async({page})=>{
  await prepare(page);const snapshots:Array<string|null>=[];
  await page.route(`**/api/posts/${post}/journey*`,route=>{
    const url=new URL(route.request().url());if(url.pathname.includes("/images/"))return route.fallback();
    snapshots.push(url.searchParams.get("asOf"));const next=url.searchParams.get("page")==="2";
    return route.fulfill({json:{...journey(next?events.slice(3):events.slice(0,3)),total:5,page:next?2:1,hasMore:!next}});
  });
  await page.goto(`/posts/${post}/journey`);await expect(page.locator(".journey-photo img")).toHaveCount(3);
  await page.getByRole("button",{name:"Xem thêm sự kiện",exact:true}).click();await expect(page.locator(".journey-photo img")).toHaveCount(4);
  expect(snapshots).toEqual([null,snapshot]);await expect(page.getByRole("button",{name:"Xem thêm sự kiện",exact:true})).toHaveCount(0);
});

test("journey shows safe matching, conversation, status transitions and appointment time",async({page},info)=>{
  const proposedAt="2026-10-12T08:30:00.000Z";
  const results:JourneyEvent[]=[
    {...event("MATCHING","MATCHING_AVAILABLE"),matchingSuggestions:[
      {postId:"77777777-7777-4777-8777-777777777777",title:"Balo xanh dương quai cam",type:"FOUND",status:"OPEN",score:0.83}
    ]},
    {...event("CHAT","CONVERSATION_OPENED"),conversationWith:"Nguyễn An"},
    {...event("CLAIM","VERIFICATION_ACCEPTED"),fromStatus:"PENDING",toStatus:"CONVERSATION_OPEN"},
    event("CLAIM","CLAIM_CREATED"),
    {...event("CUSTODY","STATUS_CHANGED"),fromStatus:"PENDING",toStatus:"INTAKED"},
    {...event("APPOINTMENT","PROPOSED"),appointment:{proposedAt}},
    event("CLAIM","MESSAGE_SENT")
  ];
  await prepare(page,results);await page.goto(`/posts/${post}/journey`);
  await expect(page.getByRole("link",{name:/Balo xanh dương quai cam/})).toBeVisible();
  await expect(page.getByText("83%",{exact:true})).toBeVisible();
  await expect(page.getByText("Trao đổi với:")).toBeVisible();
  await expect(page.getByText(/Nguyễn An/)).toBeVisible();
  await expect(page.getByText(/Trạng thái xác minh/)).toBeVisible();
  const verification=page.locator(".item-journey-event").filter({has:page.getByRole("heading",{name:"Đồng ý gặp để đối chiếu",exact:true})});
  await expect(verification.getByText("Từ trạng thái",{exact:true})).toBeVisible();
  await expect(verification.getByText("Đến trạng thái",{exact:true})).toBeVisible();
  await expect(verification.getByText("Đang chờ",{exact:true})).toBeVisible();
  await expect(verification.getByText("Đang trao đổi",{exact:true})).toBeVisible();
  await expect(page.getByText("Yêu cầu đối chiếu đã được gửi.",{exact:false})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Trạng thái: Đang chờ → Đã nhập kho",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Gửi tin nhắn",exact:true})).toBeVisible();
  await expect(page.getByText("Ngày giờ hẹn",{exact:true})).toBeVisible();
  await expect(page.locator(".item-journey-event__appointment time")).toHaveText(displayTime(proposedAt));
  await expect(page.locator(".item-journey-event__appointment time")).toHaveAttribute("datetime",proposedAt);
  await page.screenshot({path:info.outputPath("journey-event-details.png"),fullPage:true});
});

test("wide journey timeline alternates direction and connects each row with arrows",async({page},info)=>{
  const results=Array.from({length:13},(_,index)=>event("CHAT",`TIMELINE_${index+1}`,
    index===0?[1,2,3].map(photo=>image("CLAIM",`row-one-${photo}`)):
      index===7?[1,2].map(photo=>image("CLAIM",`row-two-${photo}`)):index===8?[image("CLAIM","row-three-1")]:[]));
  await page.setViewportSize({width:1440,height:900});await prepare(page,results);
  await page.goto(`/posts/${post}/journey`);
  await expect(page.locator(".item-journey-timeline > li")).toHaveCount(13);
  const boxes=await page.locator(".item-journey-timeline > li").evaluateAll(items=>items.map(item=>{
    const {x,y}=item.getBoundingClientRect();return {x,y};
  }));
  expect(boxes).toHaveLength(13);
  expect(boxes[0].x).toBeLessThan(boxes[3].x);
  expect(boxes[4].x).toBeGreaterThan(boxes[7].x);
  expect(boxes[8].x).toBeLessThan(boxes[11].x);
  expect(boxes[12].x).toBe(boxes[3].x);
  expect(boxes[12].y).toBeGreaterThan(boxes[11].y);
  const items=page.locator(".item-journey-timeline > li");
  const cards=await items.locator("article").evaluateAll(elements=>elements.map(element=>{
    const {x,y}=element.getBoundingClientRect();return {x,y};
  }));
  expect(cards[0].y).toBe(cards[1].y);
  expect(cards[4].y).toBe(cards[7].y);
  expect(cards[8].y).toBe(cards[11].y);
  const titles=await items.locator("h3").evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().top));
  expect(new Set(titles.slice(0,4)).size).toBe(1);
  expect(new Set(titles.slice(4,8)).size).toBe(1);
  expect(new Set(titles.slice(8,12)).size).toBe(1);
  const firstGallery=items.nth(0).locator(".journey-images");
  await expect(firstGallery).toHaveCSS("display","flex");
  const firstPhotoBasis=await firstGallery.locator(".journey-photo").first().evaluate(element=>getComputedStyle(element).flexBasis);
  expect(firstPhotoBasis).toBe("88px");
  const cardHeights=await items.locator("article").evaluateAll(elements=>elements.map(element=>Math.round(element.getBoundingClientRect().height)));
  expect(new Set(cardHeights).size).toBe(1);
  expect(cardHeights[0]).toBe(190);
  await expect(items.nth(0).locator(".item-journey-connector--right")).toHaveCount(1);
  await expect(items.nth(3).locator(".item-journey-connector--down")).toHaveCount(1);
  await expect(items.nth(4).locator(".item-journey-connector--left")).toHaveCount(1);
  await expect(items.nth(7).locator(".item-journey-connector--down")).toHaveCount(1);
  await expect(items.nth(8).locator(".item-journey-connector--right")).toHaveCount(1);
  await expect(items.nth(11).locator(".item-journey-connector--down")).toHaveCount(1);
  await expect(items.nth(12).locator(".item-journey-connector")).toHaveCount(0);
  await page.screenshot({path:info.outputPath("journey-zigzag-1440.png"),fullPage:true});
});

test("journey without stored photos does not invent images or call private storage",async({page})=>{
  const requests=await prepare(page);await page.route(`**/api/posts/${post}/journey*`,route=>route.fulfill({json:journey(events.map(e=>({...e,images:[]})))}));
  await page.goto(`/posts/${post}/journey`);await expect(page.getByText("Hoàn tất trả đồ",{exact:true})).toBeVisible();
  await expect(page.locator(".journey-photo")).toHaveCount(0);expect(requests.length).toBe(0);
});
