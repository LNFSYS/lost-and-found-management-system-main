import assert from "node:assert/strict";
import test from "node:test";
import type { SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import { createMySqlCustodyRepository } from "./mysql-custody.repository.js";
import { createMySqlDispositionRepository } from "./mysql-disposition.repository.js";

test("staff recipient query reads user_roles instead of a nonexistent users.role", async () => {
  let query = "";
  const db = { execute: async (sql: string) => { query = sql; return [[{ id: "staff-1" }], []]; } } as unknown as SqlExecutor;
  const ids = await createMySqlCustodyRepository(db).findStaffAndAdminUserIds();
  assert.deepEqual(ids, ["staff-1"]);
  assert.match(query, /JOIN user_roles/);
  assert.match(query, /role_code/);
  assert.doesNotMatch(query, /users\.role/);
});

test("disposition SQL constrains the order, hold, retention and active cases", async () => {
  let query = "";
  let params: unknown[] = [];
  const db = { execute: async (sql: string, values: unknown[]) => {
    query = sql;
    params = values;
    return [{ affectedRows: 1 }, []];
  } } as unknown as SqlExecutor;
  const changed = await createMySqlDispositionRepository(db).updateWarehouseItemsStatus("order-1", ["item-1"], "DISPOSED");
  assert.equal(changed, 1);
  assert.deepEqual(params, ["DISPOSED", "item-1", "order-1", "order-1"]);
  for (const guard of ["wi.disposition_order_id = ?", "wi.legal_hold_count = 0", "legal_holds", "retention_deadline < NOW()", "disposition_order_items", "CONVERSATION_OPEN", "NEED_MORE_INFO", "return_appointments", "escalated_at"]) {
    assert.ok(query.includes(guard), `Missing SQL guard: ${guard}`);
  }
});
