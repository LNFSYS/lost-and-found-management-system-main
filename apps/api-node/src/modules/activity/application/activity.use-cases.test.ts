import assert from "node:assert/strict";
import test from "node:test";
import { createActivityUseCases } from "./activity.use-cases.js";
import type { AccessTokenPayload } from "../../../shared/domain/auth.js";
function fixture(){let count=1;const actions:string[]=[];const service=createActivityUseCases({id:()=>"export",transaction:work=>work({} as import("../../../shared/application/transaction.js").TransactionContext),audit:{record:async e=>{actions.push(e.action);}},
  repository:{journey:async()=>null,audit:async()=>({total:count,results:[{id:"entry",source:"ADMIN",action:"=malicious",targetId:"id",targetType:"USER",actorId:null,createdAt:"2026-10-06T00:00:00Z",fromStatus:null,toStatus:null}]})}});
  return {service,actions,setCount:(n:number)=>{count=n;}};}
const admin:AccessTokenPayload={sub:"admin",roles:["ADMIN"],email:"fixture@example.invalid",sessionVersion:0};
test("Audit search and export reject Staff and normal users",async()=>{const f=fixture();for(const roles of [["STAFF"],["USER"]] as const){const viewer={...admin,roles:[...roles]};await assert.rejects(f.service.audit(viewer,{page:1}),{code:"forbidden"});await assert.rejects(f.service.exportAudit(viewer,{page:1},"json"),{code:"forbidden"});}assert.equal(f.actions.length,0);});
test("Audit CSV neutralizes formulas and records the export",async()=>{const f=fixture();const csv=await f.service.exportAudit(admin,{page:1},"csv");assert.ok(csv.includes("'=malicious"));assert.deepEqual(f.actions,["EXPORT_ACTIVITY"]);});
test("Oversized audit export fails explicitly, not silently truncated",async()=>{const f=fixture();f.setCount(5001);await assert.rejects(f.service.exportAudit(admin,{page:1},"csv"),{code:"invalid_input"});assert.equal(f.actions.length,0);});
test("Journey ACL denial does not reveal a foreign title or item",async()=>{const f=fixture();await assert.rejects(f.service.journey(admin,"foreign"),{code:"not_found"});});
