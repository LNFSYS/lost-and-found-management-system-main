import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionCustodyStatus, isCustodyTerminal } from "../domain/custody-request-policy.js";

test("allows PENDING → ACCEPTED transition", () => {
  assert.equal(canTransitionCustodyStatus("PENDING", "ACCEPTED"), true);
});

test("allows PENDING → REJECTED transition", () => {
  assert.equal(canTransitionCustodyStatus("PENDING", "REJECTED"), true);
});

test("allows PENDING → CANCELLED transition", () => {
  assert.equal(canTransitionCustodyStatus("PENDING", "CANCELLED"), true);
});

test("blocks PENDING → INTAKED direct transition", () => {
  assert.equal(canTransitionCustodyStatus("PENDING", "INTAKED"), false);
});

test("allows ACCEPTED → INTAKED transition", () => {
  assert.equal(canTransitionCustodyStatus("ACCEPTED", "INTAKED"), true);
});

test("allows ACCEPTED → CANCELLED transition", () => {
  assert.equal(canTransitionCustodyStatus("ACCEPTED", "CANCELLED"), true);
});

test("blocks REJECTED → ACCEPTED transition", () => {
  assert.equal(canTransitionCustodyStatus("REJECTED", "ACCEPTED"), false);
});

test("blocks REJECTED → INTAKED transition", () => {
  assert.equal(canTransitionCustodyStatus("REJECTED", "INTAKED"), false);
});

test("blocks CANCELLED → ACCEPTED transition", () => {
  assert.equal(canTransitionCustodyStatus("CANCELLED", "ACCEPTED"), false);
});

test("blocks CANCELLED → INTAKED transition", () => {
  assert.equal(canTransitionCustodyStatus("CANCELLED", "INTAKED"), false);
});

test("blocks INTAKED → any transition (terminal)", () => {
  assert.equal(canTransitionCustodyStatus("INTAKED", "PENDING"), false);
  assert.equal(canTransitionCustodyStatus("INTAKED", "ACCEPTED"), false);
  assert.equal(canTransitionCustodyStatus("INTAKED", "CANCELLED"), false);
});

test("identifies terminal states correctly", () => {
  assert.equal(isCustodyTerminal("REJECTED"), true);
  assert.equal(isCustodyTerminal("CANCELLED"), true);
  assert.equal(isCustodyTerminal("INTAKED"), true);
  assert.equal(isCustodyTerminal("PENDING"), false);
  assert.equal(isCustodyTerminal("ACCEPTED"), false);
});
