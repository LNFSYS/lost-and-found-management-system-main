import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { createApp } from "../main/app.js";
import { createAuthSecurity } from "../modules/auth/infrastructure/auth-security.js";
import { env } from "../shared/infrastructure/config/env.js";
import { isolatedJourney, withActorJourney } from "../test/actor-journey-fixture.js";

test("legacy GET endpoints never repair consent, status or rooms, including outsider HTTP reads", isolatedJourney, async () => withActorJourney(async f => {
  const claimId = randomUUID();
  await f.pool.execute("INSERT INTO claims (id,post_id,claimant_id,status,finder_decision) VALUES (?,?,?,'PENDING','PENDING')", [claimId,f.ids.found,f.ids.owner]);
  await f.pool.execute("INSERT INTO claim_participants (claim_id,user_id,participant_role,consent_status) VALUES (?,?,'CLAIMANT','ACCEPTED'), (?,?,'FINDER','PENDING')", [claimId,f.ids.owner,claimId,f.ids.finder]);
  async function snapshot() {
    const [claim] = await f.pool.query<RowDataPacket[]>("SELECT * FROM claims WHERE id = ?", [claimId]);
    const [participants] = await f.pool.query<RowDataPacket[]>("SELECT * FROM claim_participants WHERE claim_id = ? ORDER BY user_id", [claimId]);
    const [rooms] = await f.pool.query<RowDataPacket[]>("SELECT * FROM chat_rooms WHERE claim_id = ?", [claimId]);
    const [audit] = await f.pool.query<RowDataPacket[]>("SELECT * FROM claim_audit_events WHERE claim_id = ?", [claimId]);
    return { claim, participants, rooms, audit };
  }
  const original = await snapshot();
  const server = createApp({ services: f.services, checkReadiness: async () => {} }).listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/claims/${claimId}`;
    for (const actor of [f.ids.outsider, f.ids.staff, f.ids.admin]) {
      const roles = actor === f.ids.staff ? ["STAFF" as const] : actor === f.ids.admin ? ["ADMIN" as const] : ["STUDENT" as const];
      const token = createAuthSecurity(env).signAccessToken({ sub: actor, email: `${actor}@example.invalid`, roles, sessionVersion: 0 });
      for (const route of ["", "/verification", "/verification/templates"]) {
        const response = await fetch(base + route, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(response.status, 404);
        assert.deepEqual(await snapshot(), original);
      }
    }
    assert.equal((await f.claims.getClaim(claimId, f.ids.owner)).status, "PENDING");
    assert.equal((await f.claims.getClaim(claimId, f.ids.finder)).canSend, false);
    assert.equal((await f.claims.getVerification(claimId, f.ids.finder)).status, "PENDING");
    await assert.rejects(f.claims.getVerificationTemplates(claimId, f.ids.finder));
    assert.deepEqual(await snapshot(), original);
    await assert.rejects(f.claims.createDirectMessage(f.ids.owner, { postId: f.ids.found, content: "Do not approve Finder consent" }));
    assert.equal((await f.claims.createClaim(f.ids.owner, { postId: f.ids.found })).status, "PENDING");
    assert.deepEqual(await snapshot(), original);
    await f.claims.decide(claimId, f.ids.finder, { decision: "ACCEPT", note: "I agree to this conversation", idempotencyKey: randomUUID() });
    assert.equal((await f.claims.getClaim(claimId, f.ids.owner)).status, "CONVERSATION_OPEN");
    assert.equal((await f.claims.getVerificationTemplates(claimId, f.ids.finder)).category, "journey keys");
    const accepted = await snapshot();
    assert.equal(accepted.rooms.length, 1);
    assert.ok(accepted.audit.some(event => event.action === "CONVERSATION_OPENED" && event.actor_id === f.ids.finder));
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
}));
