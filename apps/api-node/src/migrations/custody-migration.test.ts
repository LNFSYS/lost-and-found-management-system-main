import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("custody migration adds each warehouse foreign key only once", () => {
  const sql = readFileSync(new URL("./053_custody_and_guarded_disposition.sql", import.meta.url), "utf8");
  for (const constraint of ["fk_warehouse_custody_req", "fk_warehouse_disp_order"]) {
    assert.equal((sql.match(new RegExp(`ADD CONSTRAINT ${constraint} FOREIGN KEY`, "g")) ?? []).length, 1);
  }
  assert.match(sql, /UNIQUE INDEX uq_custody_active_post/);
});
