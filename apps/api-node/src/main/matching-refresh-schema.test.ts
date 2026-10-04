import assert from "node:assert/strict";
import test from "node:test";
import { checkMatchingRefreshSchema } from "./matching-refresh-schema.js";

test("refresh waits for the exact additive lease contract without touching business data", async () => {
  const rows = [{ name: "lease_token", type: "char(36)", nullable: "YES" }, { name: "lease_expires_at", type: "datetime(6)", nullable: "YES" }];
  for (const [fixture, expected] of [[[], false], [rows.slice(0, 1), false], [rows, true], [[...rows.slice(0, 1), { ...rows[1], type: "datetime" }], false]] as const) {
    const pool = { query: async (sql: string) => { assert.match(sql, /^SELECT/); assert.match(sql, /information_schema/); return [fixture, []]; } };
    assert.equal(await checkMatchingRefreshSchema(pool as never), expected);
  }
});
