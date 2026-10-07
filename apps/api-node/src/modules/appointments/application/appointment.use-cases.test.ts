import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createAppointmentUseCases } from "./appointment.use-cases.js";
import type { Appointment, AppointmentRepository } from "./appointment.repository.port.js";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { NotificationEmailQueue, NotificationRepository } from "../../notifications/application/index.js";

function fixture() {
  let time=new Date("2026-10-06T01:00:00Z");let safe=true;let ready=true;let inTransaction=false;
  const a:Appointment={id:"appointment",claimId:"claim",postId:"post",title:"Keys",finderId:"finder",ownerId:"owner",proposerId:"finder",status:"ACCEPTED",
    proposedAt:"2026-10-06T00:30:00Z",handoverPointId:"point",location:"Desk",itemImageUrl:null,version:1,finderResponse:"PENDING",ownerResponse:"PENDING",noShowUserId:null,custodyAuthorized:false,completedAt:null,events:[]};
  const requests=new Map<string,{appointmentId:string;hash:string}>();let updates=0;let reminders=0;const emails:string[]=[];
  const repo:AppointmentRepository={schemaReady:async()=>ready,context:async()=>({claimId:"claim",postId:"post",finderId:"finder",ownerId:"owner",eligible:true,blocked:false}),assertSafe:async()=>safe,
    find:async(_id,tx)=>{assert.ok(!inTransaction||tx,"Never reacquire a pool connection while holding a transaction");return structuredClone(a);},list:async()=>({results:[a],total:1}),replay:async(user,key)=>requests.get(`${user}:${key}`)??null,
    create:async()=>{},active:async()=>false,pointExists:async()=>true,
    update:async(value)=>{Object.assign(a,value);updates++;},event:async e=>{if(e.key)requests.set(`${e.actorId}:${e.key}`,{appointmentId:e.appointmentId,hash:e.hash!});a.events.push({id:e.id,action:e.action,actorId:e.actorId,createdAt:time.toISOString()});},
    dueReminders:async()=>[a.id],markReminded:async()=>{if(reminders)return false;reminders++;return true;}};
  const notifications:NotificationRepository={create:async input=>({id:randomUUID(),type:input.type,title:input.title,body:null,entityType:input.entityType!,entityId:input.entityId!,isRead:false,readAt:null,createdAt:time.toISOString()}),
    listForUser:async()=>[],countUnreadForUser:async()=>0,markRead:async()=>true,markAllRead:async()=>0};
  const emailQueue:NotificationEmailQueue={enqueue:async input=>{emails.push(input.recipientUserId);},cancelForNotification:async()=>0,cancelForRoom:async()=>0,cancelForUser:async()=>0};
  const service=createAppointmentUseCases({repository:repo,transaction:async work=>{inTransaction=true;try{return await work({} as TransactionContext);}finally{inTransaction=false;}},id:randomUUID,hash:x=>x,notifications,emails:emailQueue,now:()=>time});
  return {service,a,repo,emails,updates:()=>updates,setSafe:(v:boolean)=>{safe=v;},setReady:(v:boolean)=>{ready=v;},setTime:(v:string)=>{time=new Date(v);}};
}
test("Only the actual Finder/owner can acknowledge; Staff is not a substitute",async()=>{const f=fixture();await assert.rejects(f.service.act("staff",f.a.id,{action:"CONFIRM",version:1,requestKey:randomUUID(),physicallyChecked:true}),{code:"forbidden"});assert.equal(f.updates(),0);});
test("Finder alone cannot resolve the item; both physical confirmations are required",async()=>{const f=fixture();const first=await f.service.act("finder",f.a.id,{action:"CONFIRM",version:1,requestKey:randomUUID(),physicallyChecked:true});assert.equal(first.status,"ACCEPTED");const second=await f.service.act("owner",f.a.id,{action:"CONFIRM",version:2,requestKey:randomUUID(),physicallyChecked:true});assert.equal(second.status,"COMPLETED");assert.ok(second.events.some(e=>e.action==="RETURN_COMPLETED"));});
test("Conflicting confirmations stay active and preserve the correction history",async()=>{const f=fixture();await f.service.act("finder",f.a.id,{action:"CONFIRM",version:1,requestKey:randomUUID(),physicallyChecked:true});await f.service.act("owner",f.a.id,{action:"DISPUTE",version:2,requestKey:randomUUID()});assert.equal(f.a.status,"ACCEPTED");assert.equal(f.a.completedAt,null);await f.service.act("owner",f.a.id,{action:"CONFIRM",version:3,requestKey:randomUUID(),physicallyChecked:true});assert.equal(f.a.status,"COMPLETED");assert.ok(f.a.events.some(e=>e.action==="OWNER_DISPUTE"));});
test("Lost acknowledgement retry replays one operation without duplicate notification",async()=>{const f=fixture();const input={action:"CONFIRM" as const,version:1,requestKey:randomUUID(),physicallyChecked:true};await f.service.act("finder",f.a.id,input);await f.service.act("finder",f.a.id,input);assert.equal(f.updates(),1);assert.equal(f.emails.length,2);await assert.rejects(f.service.act("finder",f.a.id,{...input,action:"DISPUTE"}),{code:"conflict"});});
test("Stale versions cannot change another participant's decision",async()=>{const f=fixture();f.a.version=2;await assert.rejects(f.service.act("owner",f.a.id,{action:"CONFIRM",version:1,requestKey:randomUUID(),physicallyChecked:true}),{code:"conflict"});assert.equal(f.updates(),0);});
test("No-show is a one-sided observation after grace, not a completed return",async()=>{const f=fixture();f.setTime("2026-10-06T00:40:00Z");await assert.rejects(f.service.act("owner",f.a.id,{action:"NO_SHOW",version:1,requestKey:randomUUID()}),{code:"conflict"});f.setTime("2026-10-06T01:00:00Z");await f.service.act("owner",f.a.id,{action:"NO_SHOW",version:1,requestKey:randomUUID()});assert.equal(f.a.status,"CANCELLED");assert.equal(f.a.noShowUserId,"finder");assert.equal(f.a.completedAt,null);});
test("Custody, legal hold, competing claims or disputes block direct completion",async()=>{const f=fixture();f.setSafe(false);await assert.rejects(f.service.act("finder",f.a.id,{action:"CONFIRM",version:1,requestKey:randomUUID(),physicallyChecked:true}),{code:"conflict"});assert.equal(f.updates(),0);});
test("Confirmed handover cannot be silently cancelled or marked no-show",async()=>{const f=fixture();f.a.finderResponse="CONFIRMED";for(const action of ["CANCEL","NO_SHOW"] as const)await assert.rejects(f.service.act("owner",f.a.id,{action,version:1,requestKey:randomUUID()}),{code:"conflict"});});
test("Photo eligibility does not replace physical review or the appointment time gate",async()=>{const f=fixture();await assert.rejects(f.service.act("finder",f.a.id,{action:"CONFIRM",version:1,requestKey:randomUUID()}),{code:"invalid_input"});f.a.proposedAt="2026-10-07T00:30:00Z";await assert.rejects(f.service.act("finder",f.a.id,{action:"CONFIRM",version:1,requestKey:randomUUID(),physicallyChecked:true}),{code:"conflict"});});
test("Only the counterpart accepts the proposal",async()=>{const f=fixture();f.a.status="PENDING";f.a.proposedAt="2026-10-07T00:30:00Z";await assert.rejects(f.service.act("finder",f.a.id,{action:"ACCEPT",version:1,requestKey:randomUUID()}),{code:"conflict"});const a=await f.service.act("owner",f.a.id,{action:"ACCEPT",version:1,requestKey:randomUUID()});assert.equal(a.status,"ACCEPTED");});
test("Reminder is queued once for both participants, never after completion",async()=>{const f=fixture();f.a.proposedAt="2026-10-06T01:20:00Z";assert.equal((await f.service.queueReminders()).queued,1);assert.equal((await f.service.queueReminders()).queued,0);assert.deepEqual(f.emails,["finder","owner"]);f.a.status="COMPLETED";assert.equal((await f.service.queueReminders()).queued,0);});
test("Missing forward schema is reported as actionable 503, not ignored",async()=>{const f=fixture();f.setReady(false);await assert.rejects(f.service.list("finder"),{code:"unavailable"});});

test("Legacy appointments cannot be modified through a forged API action",async()=>{const f=fixture();f.a.version=0;
  await assert.rejects(f.service.act("finder",f.a.id,{action:"CANCEL",version:0,requestKey:randomUUID(),reason:"Legacy cancellation"}),{code:"conflict"});assert.equal(f.updates(),0);
});
test("Mutual negative review may cancel with reason without fabricating physical receipt",async()=>{const f=fixture();f.a.finderResponse="DISPUTED";f.a.ownerResponse="DISPUTED";
  await f.service.act("owner",f.a.id,{action:"CANCEL",version:1,requestKey:randomUUID(),reason:"Both reviewed: no valid handover"});assert.equal(f.a.status,"CANCELLED");assert.equal(f.a.completedAt,null);
});
