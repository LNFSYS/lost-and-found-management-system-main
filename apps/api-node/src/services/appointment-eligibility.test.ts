import assert from "node:assert/strict";
import test from "node:test";
import { isAppointmentEligible, requireAppointmentEligible } from "./appointment-eligibility.js";

test("only the authoritative verified-for-meetup outcome permits appointment", () => {
  assert.equal(isAppointmentEligible({ claimStatus: "CONVERSATION_OPEN", latestDecisionAction: "FINDER_OPENED_CONVERSATION" }), false);
  assert.equal(isAppointmentEligible({ claimStatus: "ACCEPTED", latestDecisionAction: "FINDER_VERIFIED_FOR_MEETUP" }), true);
  assert.equal(isAppointmentEligible({ claimStatus: "ACCEPTED", latestDecisionAction: "FINDER_OPENED_CONVERSATION" }), false);
});

test("appointment guard rejects stale or ineligible state", () => {
  assert.throws(() => requireAppointmentEligible({ claimStatus: "CONVERSATION_OPEN", latestDecisionAction: "FINDER_OPENED_CONVERSATION" }), (error: unknown) => (error as { status?: number }).status === 409);
});
