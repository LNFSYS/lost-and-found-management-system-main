import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { isolatedJourney, withActorJourney } from "../../../test/actor-journey-fixture.js";
import type { AccessTokenPayload } from "../../../shared/domain/auth.js";
import type { JourneyImageKind } from "../application/activity.repository.port.js";

const viewer=(sub:string,roles:AccessTokenPayload["roles"]=["STUDENT"]):AccessTokenPayload=>({sub,roles,email:"fixture@example.invalid",sessionVersion:0});
async function awaitReturnTime(f:Parameters<Parameters<typeof withActorJourney>[0]>[0],itemId:string) {
  const [rows]=await f.pool.query<import("mysql2").RowDataPacket[]>("SELECT completed_at FROM warehouse_completed_returns WHERE warehouse_item_id=?",[itemId]);
  // DATETIME(0) can round a just-written completion up to the next second.
  const delay=new Date(rows[0]!.completed_at).getTime()-Date.now();
  if(delay>=0)await new Promise(resolve=>setTimeout(resolve,delay+1));
}

test("SQL: journey shows committed post/chat/intake/return photos with current participant ACL",isolatedJourney,async()=>{
  await withActorJourney(async f=>{
    const {pool,ids,services}=f;const claimId=randomUUID();
    await pool.execute("UPDATE users SET full_name=CASE WHEN id=? THEN ? WHEN id=? THEN ? ELSE full_name END WHERE id IN (?,?)",
      [ids.owner,"Lost item owner",ids.finder,"Item finder",ids.owner,ids.finder]);
    await pool.execute("INSERT INTO claims (id,post_id,lost_post_id,claimant_id,status,finder_decision) VALUES (?,?,?,?,'ACCEPTED','ACCEPTED')",[claimId,ids.found,ids.lost,ids.owner]);
    await pool.execute("INSERT INTO claim_participants (claim_id,user_id,participant_role,consent_status) VALUES (?,?,'FINDER','ACCEPTED'),(?,?,'CLAIMANT','ACCEPTED')",[claimId,ids.finder,claimId,ids.owner]);
    await pool.execute("INSERT INTO chat_rooms (id,claim_id) VALUES (?,?)",[randomUUID(),claimId]);
    await pool.execute("INSERT INTO match_results (id,lost_post_id,found_post_id,total_score) VALUES (?,?,?,?)",[randomUUID(),ids.lost,ids.found,0.88]);
    const closedFound=randomUUID();
    await pool.execute("INSERT INTO posts (id,user_id,type,status,title,title_normalized,description,description_normalized) VALUES (?,?,'FOUND','CLOSED','Closed match','closed match','Fixture','fixture')",[closedFound,ids.finder]);
    await pool.execute("INSERT INTO match_results (id,lost_post_id,found_post_id,total_score) VALUES (?,?,?,?)",[randomUUID(),ids.lost,closedFound,0.99]);
    const postPhoto=await services.postService.uploadMedia(ids.found,ids.finder,{mediaKind:"ITEM"},f.image,viewer(ids.finder));
    const postEvidence=await services.postService.uploadMedia(ids.found,ids.finder,{mediaKind:"EVIDENCE"},f.image,viewer(ids.finder));
    const chatPhoto=await f.claims.uploadEvidence(claimId,ids.finder,{description:"Fixture photo"},f.image);
    const document=await f.claims.uploadEvidence(claimId,ids.finder,{description:"Private document"},f.image);
    await pool.execute("UPDATE claim_evidence SET evidence_type='ADDITIONAL_DOC' WHERE id=?",[document.id]);
    const intake=await f.evidence();
    await assert.rejects(services.activityService.journeyImage(viewer(ids.owner),ids.lost,"INTAKE",intake.intakeImageIds[0]!),{code:"not_found"});
    const item=await services.warehouseService.createItem({itemName:"Keys",description:"Fixture",handoverPointId:f.point,...intake},ids.staff);
    await pool.execute("UPDATE warehouse_items SET post_id=? WHERE id=?",[ids.found,item.id]);
    const proof=await services.warehouseService.uploadProof(item.id,f.image,ids.staff);
    const unusedProof=await services.warehouseService.uploadProof(item.id,{...f.image,buffer:Buffer.concat([f.image.buffer,Buffer.from([0])]),size:5},ids.staff);
    const beforeReturn=await services.activityService.journey(viewer(ids.owner),ids.lost);
    assert.ok(beforeReturn.results.some(e=>e.action==="PHOTO_SHARED"&&e.images.some(i=>i.id===chatPhoto.id)));
    assert.equal(beforeReturn.results.find(e=>e.action==="CONVERSATION_OPENED")?.conversationWith,"Item finder");
    assert.deepEqual(beforeReturn.results.find(e=>e.source==="MATCHING")?.matchingSuggestions?.map(match=>({title:match.title,score:match.score})),[{title:"Keys",score:0.88}]);
    assert.ok(beforeReturn.results.some(e=>e.action==="RECEIVED"&&e.images.some(i=>i.id===intake.intakeImageIds[0])));
    assert.ok(!beforeReturn.results.flatMap(e=>e.images).some(i=>i.kind==="RETURN"));
    const ownerFile=await services.activityService.journeyImage(viewer(ids.owner),ids.lost,"INTAKE",intake.intakeImageIds[0]!);
    assert.deepEqual(ownerFile.body,f.image.buffer);
    await services.warehouseService.verifyCustodyClaim(item.id,{claimId,recipientId:ids.owner,verified:true,reason:"Compared physical markings"},ids.staff);
    await services.warehouseService.returnItem(item.id,{claimId,recipientId:ids.owner,receiverName:"Fixture",receiverIdentity:"private-identity",receiverPhone:"private-phone",proofImage:proof.id},ids.staff);
    await awaitReturnTime(f,item.id);
    const afterReturn=await services.activityService.journey(viewer(ids.owner),ids.lost);
    const returned=afterReturn.results.find(e=>e.source==="RETURN"&&e.action==="RETURN_COMPLETED");
    assert.equal(returned?.images[0]?.id,proof.id);assert.equal(returned?.images[0]?.kind,"RETURN");
    const text=JSON.stringify(afterReturn);
    for(const secret of ["private://","storage_ref","public_id","private-identity","private-phone","@example.invalid",unusedProof.id,postEvidence.id,document.id])assert.ok(!text.includes(secret));
    const foundJourney=await services.activityService.journey(viewer(ids.finder),ids.found);
    assert.ok(foundJourney.results.find(e=>e.action==="POST_CREATED")?.images.some(i=>i.id===postPhoto.id));
    assert.equal(foundJourney.results.find(e=>e.action==="CONVERSATION_OPENED")?.conversationWith,"Lost item owner");
    assert.equal(foundJourney.results.find(e=>e.source==="MATCHING")?.matchingSuggestions?.[0]?.score,0.88);
    const claimParticipantJourney=await services.activityService.journey(viewer(ids.owner),ids.found);
    assert.equal(claimParticipantJourney.results.find(e=>e.source==="MATCHING")?.matchingSuggestions,undefined);
    for(const [kind,id] of [["CLAIM",chatPhoto.id],["INTAKE",intake.intakeImageIds[0]!],["RETURN",proof.id]] as [JourneyImageKind,string][]){
      assert.deepEqual((await services.activityService.journeyImage(viewer(ids.owner),ids.lost,kind,id)).body,f.image.buffer);
      for(const outsider of [viewer(ids.outsider),viewer(ids.staff,["STAFF"]),viewer(ids.admin,["ADMIN"])])
        await assert.rejects(services.activityService.journeyImage(outsider,ids.lost,kind,id),{code:"not_found"});
    }
    await assert.rejects(services.activityService.journeyImage(viewer(ids.finder),ids.found,"POST",postEvidence.id),{code:"not_found"});
    await assert.rejects(services.activityService.journeyImage(viewer(ids.owner),ids.lost,"CLAIM",document.id),{code:"not_found"});
    await assert.rejects(services.activityService.journeyImage(viewer(ids.owner),ids.lost,"RETURN",unusedProof.id),{code:"not_found"});
    await assert.rejects(services.activityService.journeyImage(viewer(ids.owner),ids.lost,"INTAKE",chatPhoto.id),{code:"not_found"});
    await assert.rejects(services.activityService.journeyImage(viewer(ids.owner),ids.lost,"RETURN",proof.id,"2000-01-01T00:00:00Z"),{code:"not_found"});
    const unrelated=randomUUID();await pool.execute("INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized) VALUES (?,?,'LOST','Other','other','Fixture','fixture')",[unrelated,ids.owner]);
    await assert.rejects(services.activityService.journeyImage(viewer(ids.owner),unrelated,"RETURN",proof.id),{code:"not_found"});
    await pool.execute("UPDATE claim_participants SET consent_status='DECLINED' WHERE claim_id=? AND user_id=?",[claimId,ids.owner]);
    await assert.rejects(services.activityService.journeyImage(viewer(ids.owner),ids.lost,"RETURN",proof.id),{code:"not_found"});
    assert.ok(!(await services.activityService.journey(viewer(ids.owner),ids.lost)).results.flatMap(e=>e.images).length);
  });
});

test("SQL: photo-backed LOST custody has images without a FOUND post; competing claimant has no receipt photo",isolatedJourney,async()=>{
  await withActorJourney(async f=>{
    const {pool,ids,services}=f;
    const approval=await f.contactPhotos.analyze(ids.lost,ids.finder,f.image);assert.equal(approval.approved,true);
    await pool.execute("DELETE FROM posts WHERE id=?",[ids.found]);
    const direct=await f.claims.createDirectMessage(ids.finder,{postId:ids.lost,contactCheckId:approval.checkId!,content:"Found your keys",clientMessageId:randomUUID()});
    const claimId=direct.claim.id,photo={id:approval.checkId!};
    await f.claims.decideVerification(claimId,ids.finder,{decision:"ESCALATE_TO_CUSTODY",reason:"Transfer to Staff",handoverPointId:f.point,idempotencyKey:randomUUID()});
    const [requests]=await pool.query<import("mysql2").RowDataPacket[]>("SELECT id FROM custody_requests WHERE claim_id=?",[claimId]);
    const requestId=String(requests[0]!.id);const intake=await f.evidence(requestId);
    const receipt=await services.custodyRequestService.confirmIntake(requestId,intake,ids.staff);const item={id:receipt!.warehouseItemId!};
    await services.warehouseService.verifyCustodyClaim(item.id,{claimId,recipientId:ids.owner,verified:true,reason:"Compared physical markings"},ids.staff);
    const proof=await services.warehouseService.uploadProof(item.id,f.image,ids.staff);
    await services.warehouseService.returnItem(item.id,{claimId,recipientId:ids.owner,receiverName:"Fixture",receiverIdentity:"private-id",receiverPhone:"private-phone",proofImage:proof.id},ids.staff);
    await awaitReturnTime(f,item.id);
    for(const sub of [ids.owner,ids.finder]){
      const journey=await services.activityService.journey(viewer(sub),ids.lost);
      const images=journey.results.flatMap(e=>e.images);assert.ok(images.some(i=>i.id===photo.id));assert.ok(images.some(i=>i.id===proof.id));
      assert.deepEqual((await services.activityService.journeyImage(viewer(sub),ids.lost,"RETURN",proof.id)).body,f.image.buffer);
    }
    const other=randomUUID();await pool.execute("INSERT INTO claims (id,post_id,claimant_id,status) VALUES (?,?,?,'REJECTED')",[other,ids.lost,ids.outsider]);
    await pool.execute("INSERT INTO claim_participants (claim_id,user_id,participant_role,consent_status) VALUES (?,?,'FINDER','ACCEPTED'),(?,?,'CLAIMANT','ACCEPTED')",[other,ids.outsider,other,ids.owner]);
    assert.ok(!(await services.activityService.journey(viewer(ids.outsider),ids.lost)).results.flatMap(e=>e.images).some(i=>i.id===proof.id||i.id===photo.id));
    await assert.rejects(services.activityService.journeyImage(viewer(ids.outsider),ids.lost,"RETURN",proof.id),{code:"not_found"});
    await pool.execute("UPDATE warehouse_items SET deleted_at=UTC_TIMESTAMP() WHERE id=?",[item.id]);
    for(const kind of ["INTAKE","RETURN"] as const)await assert.rejects(services.activityService.journeyImage(viewer(ids.owner),ids.lost,kind,kind==="RETURN"?proof.id:intake.intakeImageIds[0]!),{code:"not_found"});
  });
});

test("SQL: appointment journey includes scheduled time only for the allowed claim",isolatedJourney,async()=>{
  await withActorJourney(async f=>{
    const {pool,ids,services}=f,claimId=randomUUID(),appointmentId=randomUUID();
    const proposedAt=new Date("2026-12-01T08:30:00.000Z");
    await pool.execute("INSERT INTO claims (id,post_id,lost_post_id,claimant_id,status,finder_decision) VALUES (?,?,?,?,'ACCEPTED','ACCEPTED')",[claimId,ids.found,ids.lost,ids.owner]);
    await pool.execute("INSERT INTO claim_participants (claim_id,user_id,participant_role,consent_status) VALUES (?,?,'FINDER','ACCEPTED'),(?,?,'CLAIMANT','ACCEPTED')",[claimId,ids.finder,claimId,ids.owner]);
    await pool.execute("INSERT INTO return_appointments (id,claim_id,post_id,proposer_id,proposed_at,custom_location) VALUES (?,?,?,?,?,?)",[appointmentId,claimId,ids.found,ids.finder,proposedAt,"private-location"]);
    await pool.execute("INSERT INTO appointment_events (id,appointment_id,actor_id,action,note) VALUES (?,?,?,'PROPOSED',?)",[randomUUID(),appointmentId,ids.finder,"private-note"]);
    for(const userId of [ids.owner,ids.finder]){
      const journey=await services.activityService.journey(viewer(userId),ids.lost);
      const proposal=journey.results.find(e=>e.source==="APPOINTMENT"&&e.action==="PROPOSED");
      assert.deepEqual(proposal?.appointment,{proposedAt:proposedAt.toISOString()});
      assert.ok(!JSON.stringify(journey).includes("private-"));
    }
    await assert.rejects(services.activityService.journey(viewer(ids.outsider),ids.lost),{code:"not_found"});
  });
});
