import assert from "node:assert/strict";
import test from "node:test";
import type { SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import { createAppointmentRepository } from "./appointment.repository.js";

test("appointment list embeds only an ITEM image proxy in the existing participant-scoped query", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const pool = { execute: async (sql: string, values: unknown[]) => {
    queries.push({ sql, values });
    return sql.includes("COUNT(*)") ? [[{ total: 1 }], []] : [[{
      id: "appointment", claim_id: "claim", post_id: "post", item_post_id: "post", item_media_id: "image",
      title: "Keys", proposed_at: "2026-10-07T08:00:00Z", version: 1,
      secure_url: "never-expose-storage-reference", public_id: "never-expose-provider-id"
    }], []];
  } } as unknown as SqlExecutor;
  const result = await createAppointmentRepository(pool).list("owner", 2, "claim");
  assert.equal(queries.length, 2);
  assert.match(queries[1].sql, /pm\.media_kind='ITEM' AND pm\.resource_type='image'/);
  assert.match(queries[1].sql, /identity_post\.visibility_mode='PUBLIC'/);
  assert.match(queries[1].sql, /identity_post\.status<>'HIDDEN' AND identity_post\.deleted_at IS NULL/);
  assert.match(queries[1].sql, /ORDER BY pm\.sort_order,pm\.created_at,pm\.id LIMIT 1/);
  assert.match(queries[1].sql, /LIMIT 20 OFFSET 20/);
  assert.deepEqual(queries[1].values, ["owner", "owner", "claim"]);
  assert.equal(result.results[0].itemImageUrl, "/api/posts/post/media/image");
  assert.ok(!JSON.stringify(result).includes("never-expose"));
});

test("appointment without a permitted item image returns null, not a fabricated URL", async () => {
  const pool = { execute: async () => [[{ id: "appointment", proposed_at: "2026-10-07T08:00:00Z", item_media_id: null }], []] } as unknown as SqlExecutor;
  const result = await createAppointmentRepository(pool).find("appointment");
  assert.equal(result?.itemImageUrl, null);
});
