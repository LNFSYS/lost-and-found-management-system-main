import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Journey, JourneyEvent, JourneyImage } from "../src/services/workflow-types";

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

async function prepare(page:Page) {
  const requests:string[]=[];
  await page.route("**/api/**",async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==="/api/auth/refresh")return route.fulfill({json:{accessToken:"fixture-token",accessTokenExpiresIn:"15m",user:{id:owner,email:"fixture@example.invalid",fullName:"Người dùng thử",roles:["USER"],status:"ACTIVE",studentCode:null,phoneNumber:null,createdAt:snapshot,updatedAt:snapshot}}});
    if(url.pathname==="/api/notifications")return route.fulfill({json:{items:[],unreadTotal:0}});
    if(url.pathname===`/api/posts/${post}/journey`)return route.fulfill({json:journey()});
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
  await page.getByRole("button",{name:"Xem tiếp",exact:true}).click();await expect(page.locator(".journey-photo img")).toHaveCount(4);
  expect(snapshots).toEqual([null,snapshot]);await expect(page.getByRole("button",{name:"Xem tiếp",exact:true})).toHaveCount(0);
});

test("journey without stored photos does not invent images or call private storage",async({page})=>{
  const requests=await prepare(page);await page.route(`**/api/posts/${post}/journey*`,route=>route.fulfill({json:journey(events.map(e=>({...e,images:[]})))}));
  await page.goto(`/posts/${post}/journey`);await expect(page.getByText("Hoàn tất trả đồ",{exact:true})).toBeVisible();
  await expect(page.locator(".journey-photo")).toHaveCount(0);expect(requests.length).toBe(0);
});
