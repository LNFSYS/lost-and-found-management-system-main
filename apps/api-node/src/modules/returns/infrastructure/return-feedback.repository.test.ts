import assert from "node:assert/strict";
import test from "node:test";
import type { SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import { createReturnFeedbackRepository } from "./return-feedback.repository.js";

test("completed returns bind the viewer in both participant roles and expose only list fields", async () => {
  const pool = { execute: async (sql: string, values: unknown[]) => {
    assert.deepEqual(values, ["viewer", "viewer", "viewer"]);
    assert.match(sql, /ra.status = 'COMPLETED' AND ra.completed_at IS NOT NULL/);
    assert.match(sql, /rf.reviewer_id = \?/);
    assert.match(sql, /ORDER BY ra.completed_at DESC, ra.id DESC LIMIT 21 OFFSET 20/);
    return [[{ id: "appointment", title: "Wallet", completed_at: new Date("2026-01-01Z"), rating: 4, private_evidence: "secret", contact: "secret" }], []];
  } } as unknown as SqlExecutor;
  assert.deepEqual(await createReturnFeedbackRepository(pool).listCompletedForUser("viewer", 2), [
    { id: "appointment", postTitle: "Wallet", completedAt: "2026-01-01T00:00:00.000Z", rating: 4 }
  ]);
});
