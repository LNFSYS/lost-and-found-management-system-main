import assert from "node:assert/strict";
import test from "node:test";
import { createActivityUseCases } from "./activity.use-cases.js";
import type { AccessTokenPayload } from "../../../shared/domain/auth.js";
import type { JourneyImageFile } from "./activity.repository.port.js";
function fixture(){let count=1;const actions:string[]=[];const service=createActivityUseCases({id:()=>"export",transaction:work=>work({} as import("../../../shared/application/transaction.js").TransactionContext),audit:{record:async e=>{actions.push(e.action);}},
  media:{post:{resolve:async()=>{throw new Error("Unauthorized storage read");}},claim:{resolve:async()=>{throw new Error("Unauthorized storage read");}},warehouse:{resolve:async()=>{throw new Error("Unauthorized storage read");}}},
  repository:{journey:async()=>null,journeyImage:async()=>null,audit:async()=>({total:count,results:[{id:"entry",source:"ADMIN",action:"=malicious",targetId:"id",targetType:"USER",actorId:null,createdAt:"2026-10-06T00:00:00Z",fromStatus:null,toStatus:null}]})}});
  return {service,actions,setCount:(n:number)=>{count=n;}};}
const admin:AccessTokenPayload={sub:"admin",roles:["ADMIN"],email:"fixture@example.invalid",sessionVersion:0};
test("Audit search and export reject Staff and normal users",async()=>{const f=fixture();for(const roles of [["STAFF"],["USER"]] as const){const viewer={...admin,roles:[...roles]};await assert.rejects(f.service.audit(viewer,{page:1}),{code:"forbidden"});await assert.rejects(f.service.exportAudit(viewer,{page:1},"json"),{code:"forbidden"});}assert.equal(f.actions.length,0);});
test("Audit CSV neutralizes formulas and records the export",async()=>{const f=fixture();const csv=await f.service.exportAudit(admin,{page:1},"csv");assert.ok(csv.includes("'=malicious"));assert.deepEqual(f.actions,["EXPORT_ACTIVITY"]);});
test("Oversized audit export fails explicitly, not silently truncated",async()=>{const f=fixture();f.setCount(5001);await assert.rejects(f.service.exportAudit(admin,{page:1},"csv"),{code:"invalid_input"});assert.equal(f.actions.length,0);});
test("Journey ACL denial does not reveal a foreign title or item",async()=>{const f=fixture();await assert.rejects(f.service.journey(admin,"foreign"),{code:"not_found"});});

function imageFixture() {
  const reads:string[]=[];const lookups:unknown[][]=[];
  let image:JourneyImageFile|null=null,contentType="image/jpeg";
  const storage=(name:string)=>({resolve:async(ref:string)=>{reads.push(`${name}:${ref}`);return {body:Buffer.from("photo"),contentType};}});
  const service=createActivityUseCases({id:()=>"id",transaction:async()=>{throw new Error("Read-only operation");},audit:{record:async()=>{}},
    now:()=>new Date("2026-10-10T12:00:00Z"),media:{post:storage("post"),claim:storage("claim"),warehouse:storage("warehouse")},
    repository:{journey:async()=>null,audit:async()=>({results:[],total:0}),journeyImage:async(...args)=>{lookups.push(args);return image;}}});
  return {service,reads,lookups,setImage:(value:JourneyImageFile|null)=>{image=value;},setType:(type:string)=>{contentType=type;}};
}
test("Journey photos revalidate scoped access before storage, even for an Admin",async()=>{
  const f=imageFixture();
  for(const roles of [["USER"],["STAFF"],["ADMIN"]] as const) await assert.rejects(f.service.journeyImage({...admin,roles:[...roles]},"post","RETURN","photo"),{code:"not_found"});
  assert.deepEqual(f.reads,[]);assert.deepEqual(f.lookups[0],["post","admin","RETURN","photo","2026-10-10T12:00:00.000Z"]);
});
test("Journey photos resolve the authorized namespace and do not expose a storage reference",async()=>{
  const f=imageFixture();
  for(const kind of ["POST","CLAIM","INTAKE","RETURN"] as const){
    f.setImage({storageRef:"private://image",format:"jpg",kind});
    const file=await f.service.journeyImage(admin,"post",kind,"photo");
    assert.equal(file.contentType,"image/jpeg");assert.equal(file.body.toString(),"photo");assert.ok(!("storageRef" in file));
  }
  assert.deepEqual(f.reads,["post:private://image","claim:private://image","warehouse:private://image","warehouse:private://image"]);
});
test("Journey photo snapshots reject future/invalid dates without querying or delivering",async()=>{
  const f=imageFixture();
  for(const date of ["not-a-date","2026-10-11T00:00:00Z"])await assert.rejects(f.service.journeyImage(admin,"post","POST","photo",date),{code:"invalid_input"});
  assert.deepEqual(f.lookups,[]);assert.deepEqual(f.reads,[]);
});
test("Journey does not deliver documents or HTML disguised as an image",async()=>{
  const f=imageFixture();f.setImage({kind:"RETURN",storageRef:"private://document",format:"jpg"});
  for(const type of ["application/pdf","text/html","image/svg+xml"]){f.setType(type);await assert.rejects(f.service.journeyImage(admin,"post","RETURN","photo"),{code:"not_found"});}
});
