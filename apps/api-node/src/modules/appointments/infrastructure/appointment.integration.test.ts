import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { RowDataPacket } from "mysql2";
import mysql from "mysql2/promise";
import { createPersistence } from "../../../main/persistence.js";
import { isolatedJourney, withActorJourney } from "../../../test/actor-journey-fixture.js";
import { createAppointmentUseCases } from "../application/appointment.use-cases.js";
import { createNotificationEmailQueue } from "../../notifications/application/notification-email.queue.js";
import type { AccessTokenPayload } from "../../../shared/domain/auth.js";

async function runFixture(run:(f:Parameters<Parameters<typeof withActorJourney>[0]>[0],s:ReturnType<typeof createAppointmentUseCases>,claimId:string,advance:(ms:number)=>void)=>Promise<void>,lost=false){
  await withActorJourney(async f=>{
    const claimId=randomUUID();const {ids,p}=f;
    // Match DATETIME(0) precision and the lease query's authoritative DB clock.
    const [clock]=await f.pool.query<RowDataPacket[]>("SELECT UTC_TIMESTAMP() fixture_time");
    let time=new Date(clock[0].fixture_time);
    await f.pool.execute("INSERT INTO claims (id,post_id,claimant_id,status,finder_decision) VALUES (?,?,?,'ACCEPTED','ACCEPTED')",[claimId,lost?ids.lost:ids.found,lost?ids.finder:ids.owner]);
    await f.pool.execute("INSERT INTO claim_participants (claim_id,user_id,participant_role,consent_status) VALUES (?,?,'FINDER','ACCEPTED'),(?,?,'CLAIMANT','ACCEPTED')",[claimId,ids.finder,claimId,ids.owner]);
    const emails=createNotificationEmailQueue({repository:p.notificationEmailRepository,id:randomUUID,chatDelayMinutes:5,digestDelayMinutes:15,now:()=>time});
    const s=createAppointmentUseCases({repository:p.appointmentRepository,transaction:p.transaction,id:randomUUID,hash:x=>x,notifications:p.notificationRepository,emails,now:()=>time});
    await run(f,s,claimId,ms=>{time=new Date(time.getTime()+ms);});
  });
}
async function schedule(f:Parameters<Parameters<typeof withActorJourney>[0]>[0],s:ReturnType<typeof createAppointmentUseCases>,claimId:string){
  const a=await s.create(f.ids.finder,{claimId,proposedAt:new Date(Date.now()+20*60_000).toISOString(),handoverPointId:f.point,requestKey:randomUUID()});
  return s.act(f.ids.owner,a.id,{action:"ACCEPT",version:a.version,requestKey:randomUUID()});
}
function viewer(id:string,admin=false):AccessTokenPayload{return {sub:id,email:"fixture@example.invalid",roles:[admin?"ADMIN":"STUDENT"],sessionVersion:0};}

test("SQL: appointment actions and reminder enqueue finish with a one-connection pool",isolatedJourney,async()=>runFixture(async(f,_s,c)=>{
  const [rows]=await f.pool.query<RowDataPacket[]>("SELECT DATABASE() name");
  const pool=mysql.createPool({host:"127.0.0.1",port:Number(process.env.LNFS_TEST_DB_PORT),database:rows[0].name,
    user:process.env.LNFS_TEST_DB_USER,password:process.env.LNFS_TEST_DB_PASSWORD,timezone:"Z",connectionLimit:1});
  try{
    const p=createPersistence(pool);const emails=createNotificationEmailQueue({repository:p.notificationEmailRepository,id:randomUUID,chatDelayMinutes:5,digestDelayMinutes:15});
    const s=createAppointmentUseCases({repository:p.appointmentRepository,transaction:p.transaction,id:randomUUID,hash:x=>x,notifications:p.notificationRepository,emails});
    let timer:ReturnType<typeof setTimeout>|undefined;
    const work=async()=>{const a=await schedule(f,s,c);assert.equal(a.status,"ACCEPTED");assert.equal((await s.queueReminders()).queued,1);};
    try{await Promise.race([work(),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error("Appointment pool starvation")),10000);})]);}
    finally{if(timer)clearTimeout(timer);}
  }finally{await pool.end();}
}));

test("SQL: legacy appointment remains read-only without synthesized confirmations",isolatedJourney,async()=>runFixture(async(f,s,c)=>{
  const a=await schedule(f,s,c);await f.pool.execute("DELETE FROM return_appointment_workflows WHERE appointment_id=?",[a.id]);
  assert.equal((await s.get(f.ids.finder,a.id)).version,0);
  await assert.rejects(s.act(f.ids.finder,a.id,{action:"CANCEL",version:0,requestKey:randomUUID(),reason:"Legacy cancellation"}),{code:"conflict"});
  const [rows]=await f.pool.execute<RowDataPacket[]>("SELECT status,finder_confirmed_at,owner_confirmed_at FROM return_appointments WHERE id=?",[a.id]);
  assert.equal(rows[0].status,"ACCEPTED");assert.equal(rows[0].finder_confirmed_at,null);assert.equal(rows[0].owner_confirmed_at,null);
}));
test("SQL: direct LOST without FOUND completes only dual physical confirmations, replay and feedback",isolatedJourney,async()=>runFixture(async(f,s,c,advance)=>{
  const a=await schedule(f,s,c);advance(21*60_000);const input={action:"CONFIRM" as const,version:a.version,requestKey:randomUUID(),physicallyChecked:true};
  const first=await s.act(f.ids.finder,a.id,input);await s.act(f.ids.finder,a.id,input);assert.equal(first.status,"ACCEPTED");
  const eligibilityBefore=await f.services.returnFeedbackService.getEligibility(a.id,viewer(f.ids.finder));assert.equal(eligibilityBefore.eligible,false);
  const completed=await s.act(f.ids.owner,a.id,{...input,version:first.version,requestKey:randomUUID()});assert.equal(completed.status,"COMPLETED");
  assert.equal((await f.services.returnFeedbackService.getEligibility(a.id,viewer(f.ids.finder))).eligible,true);
  const [rows]=await f.pool.execute<RowDataPacket[]>("SELECT status FROM posts WHERE id=?",[f.ids.lost]);assert.equal(rows[0].status,"RESOLVED");
  const [events]=await f.pool.execute<RowDataPacket[]>("SELECT COUNT(*) total FROM appointment_events WHERE appointment_id=? AND action='FINDER_CONFIRM'",[a.id]);assert.equal(Number(events[0].total),1);
  await assert.rejects(s.get(f.ids.outsider,a.id),{code:"forbidden"});
},true));
test("SQL: contradictory acknowledgement keeps the item open and history intact",isolatedJourney,async()=>runFixture(async(f,s,c,advance)=>{
  const a=await schedule(f,s,c);advance(21*60_000);await s.act(f.ids.finder,a.id,{action:"CONFIRM",version:a.version,requestKey:randomUUID(),physicallyChecked:true});
  const disputed=await s.act(f.ids.owner,a.id,{action:"DISPUTE",version:a.version+1,requestKey:randomUUID()});assert.equal(disputed.status,"ACCEPTED");assert.equal(disputed.ownerResponse,"DISPUTED");
  const [rows]=await f.pool.execute<RowDataPacket[]>("SELECT status FROM posts WHERE id=?",[f.ids.found]);assert.equal(rows[0].status,"OPEN");
  await assert.rejects(s.act(f.ids.owner,a.id,{action:"NO_SHOW",version:disputed.version,requestKey:randomUUID()}),{code:"conflict"});
}));
test("SQL: two reminder workers queue exactly two outbox rows; no-show never resolves posts",isolatedJourney,async()=>runFixture(async(f,s,c,advance)=>{
  const a=await schedule(f,s,c);const result=await Promise.all([s.queueReminders(),s.queueReminders()]);assert.equal(result.reduce((sum,r)=>sum+r.queued,0),1);
  const [rows]=await f.pool.execute<RowDataPacket[]>("SELECT COUNT(*) total,SUM(due_at<=UTC_TIMESTAMP()) due FROM notification_email_outbox WHERE entity_type='APPOINTMENT_REMINDER' AND entity_id=?",[a.id]);
  assert.equal(Number(rows[0].total),2);assert.equal(Number(rows[0].due),2);
  advance(36*60_000);const noShow=await s.act(f.ids.owner,a.id,{action:"NO_SHOW",version:a.version,requestKey:randomUUID()});assert.equal(noShow.noShowUserId,f.ids.finder);assert.equal(noShow.completedAt,null);
  const lease=randomUUID();await f.p.notificationEmailRepository.claimDue({limit:50,leaseToken:lease,leaseSeconds:60});
  const reminders=(await f.p.notificationEmailRepository.listLease(lease)).filter(item=>item.entityType==="APPOINTMENT_REMINDER");
  assert.equal(reminders.length,2);assert.ok(reminders.every(item=>!item.entityAccessible));
}));
test("SQL: custody intake and pending disputes prohibit peer acknowledgements",isolatedJourney,async()=>runFixture(async(f,s,c,advance)=>{
  const a=await schedule(f,s,c);advance(21*60_000);
  await f.pool.execute("INSERT INTO custody_requests (id,claim_id,post_id,requester_id,status) VALUES (?,?,?,?,'PENDING')",[randomUUID(),c,f.ids.found,f.ids.finder]);
  await assert.rejects(s.act(f.ids.finder,a.id,{action:"CONFIRM",version:a.version,requestKey:randomUUID(),physicallyChecked:true}),{code:"conflict"});
}));
test("SQL: journey joins custody/warehouse across a LOST conversation and redacts private metadata",isolatedJourney,async()=>runFixture(async(f,s,c)=>{
  const item=await f.services.warehouseService.createItem({itemName:"Keys",description:"Fixture",handoverPointId:f.point,...await f.evidence()},f.ids.staff);
  const custodyId=randomUUID();await f.pool.execute("INSERT INTO custody_requests (id,claim_id,requester_id,status,warehouse_item_id) VALUES (?,?,?,'INTAKED',?)",[custodyId,c,f.ids.finder,item.id]);
  await f.pool.execute("INSERT INTO claim_audit_events (id,claim_id,actor_id,action,metadata_json) VALUES (?,?,?,'PRIVATE_FIXTURE',?)",[randomUUID(),c,f.ids.finder,JSON.stringify({phone:"secret-phone",privateAnswer:"secret-answer"})]);
  const journey=await f.services.activityService.journey(viewer(f.ids.owner),f.ids.lost);assert.ok(journey.results.some(e=>e.source==="WAREHOUSE"));assert.ok(!JSON.stringify(journey).includes("secret-"));
  assert.equal(journey.summary.custodian,"STAFF");assert.equal(journey.summary.locationClass,"WAREHOUSE");assert.ok(journey.summary.receivedAt);assert.equal(journey.summary.feedbackEligible,false);
  await assert.rejects(f.services.activityService.journey(viewer(f.ids.outsider),f.ids.lost),{code:"not_found"});
  const audit=await f.services.activityService.audit(viewer(f.ids.admin,true),{page:1,source:"CLAIM"});assert.ok(audit.total>0);assert.ok(!JSON.stringify(audit).includes("secret-"));
  const csv=await f.services.activityService.exportAudit(viewer(f.ids.admin,true),{page:1,source:"CLAIM"},"csv");assert.ok(!csv.includes("secret-"));
},true));

test("SQL: paired LOST journey exposes valid FOUND warehouse events, never rejected candidate stock",isolatedJourney,async()=>runFixture(async(f,_s,c)=>{
  await f.pool.execute("UPDATE claims SET lost_post_id=? WHERE id=?",[f.ids.lost,c]);
  const item=await f.services.warehouseService.createItem({itemName:"Keys",description:"Fixture",handoverPointId:f.point,...await f.evidence()},f.ids.staff);
  await f.pool.execute("UPDATE warehouse_items SET post_id=? WHERE id=?",[f.ids.found,item.id]);
  const allowed=await f.services.activityService.journey(viewer(f.ids.owner),f.ids.lost);
  assert.ok(allowed.results.some(e=>e.source==="WAREHOUSE"&&e.targetId===item.id));
  assert.equal(allowed.summary.custodian,"STAFF");
  await f.pool.execute("UPDATE claims SET status='REJECTED',finder_decision='DECLINED' WHERE id=?",[c]);
  const rejected=await f.services.activityService.journey(viewer(f.ids.owner),f.ids.lost);
  assert.ok(!rejected.results.some(e=>e.source==="WAREHOUSE"));
  assert.equal(rejected.summary.custodian,"UNKNOWN");assert.equal(rejected.summary.receivedAt,null);
}));

test("SQL: lost COMMIT acknowledgement replays the persisted proposal, not a second appointment",isolatedJourney,async()=>runFixture(async(f,_s,c)=>{
  let fail=true;const emails=createNotificationEmailQueue({repository:f.p.notificationEmailRepository,id:randomUUID,chatDelayMinutes:5,digestDelayMinutes:15});
  const s=createAppointmentUseCases({repository:f.p.appointmentRepository,transaction:async work=>{const result=await f.p.transaction(work);if(fail){fail=false;throw Object.assign(new Error("Lost commit acknowledgement"),{code:"ECONNRESET"});}return result;},
    id:randomUUID,hash:x=>x,notifications:f.p.notificationRepository,emails});
  const input={claimId:c,proposedAt:new Date(Date.now()+30*60_000).toISOString(),handoverPointId:f.point,requestKey:randomUUID()};
  await assert.rejects(s.create(f.ids.finder,input),{code:"ECONNRESET"});const a=await s.create(f.ids.finder,input);
  const [rows]=await f.pool.execute<RowDataPacket[]>("SELECT COUNT(*) total FROM return_appointments WHERE claim_id=?",[c]);assert.equal(Number(rows[0].total),1);
  const [messages]=await f.pool.execute<RowDataPacket[]>("SELECT COUNT(*) total FROM notifications WHERE entity_id=?",[a.id]);assert.equal(Number(messages[0].total),2);
}));
test("SQL: late competing claim/dispute and disabled participants cannot complete direct handover",isolatedJourney,async()=>runFixture(async(f,s,c,advance)=>{
  const a=await schedule(f,s,c);advance(21*60_000);const input={action:"CONFIRM" as const,version:a.version,requestKey:randomUUID(),physicallyChecked:true};
  await f.pool.execute("UPDATE users SET status='DISABLED' WHERE id=?",[f.ids.owner]);await assert.rejects(s.act(f.ids.finder,a.id,input),{code:"conflict"});await f.pool.execute("UPDATE users SET status='ACTIVE' WHERE id=?",[f.ids.owner]);
  const other=randomUUID();await f.pool.execute("INSERT INTO claims (id,post_id,claimant_id,status,finder_decision) VALUES (?,?,?,'REJECTED','DECLINED')",[other,f.ids.found,f.ids.outsider]);
  const report=randomUUID();await f.pool.execute("INSERT INTO reports (id,reporter_id,entity_type,entity_id,reason,status) VALUES (?,?,'CLAIM',?,'Fixture dispute','PENDING')",[report,f.ids.outsider,other]);
  await assert.rejects(s.act(f.ids.finder,a.id,input),{code:"conflict"});await f.pool.execute("UPDATE reports SET status='DISMISSED' WHERE id=?",[report]);
  await f.pool.execute("UPDATE claims SET status='CONVERSATION_OPEN',finder_decision='ACCEPTED' WHERE id=?",[other]);await assert.rejects(s.act(f.ids.finder,a.id,input),{code:"conflict"});
  const [rows]=await f.pool.execute<RowDataPacket[]>("SELECT finder_confirmed_at,status FROM return_appointments WHERE id=?",[a.id]);assert.equal(rows[0].finder_confirmed_at,null);assert.equal(rows[0].status,"ACCEPTED");
}));
