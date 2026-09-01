import assert from "node:assert/strict";
import test from "node:test";
import { adminUserRepository } from "./admin-user.repository.js";

test("active admin guard uses a deterministic locking read", async () => {
  const sqlCalls: string[] = [];
  const connection = {
    async execute(sql: string) {
      sqlCalls.push(sql);
      return [[{ id: "admin-id" }], []];
    }
  } as never;

  const count = await adminUserRepository.lockActiveAdmins(connection);

  assert.equal(count, 1);
  assert.match(sqlCalls[0] ?? "", /WHERE u\.status = 'ACTIVE'/);
  assert.match(sqlCalls[0] ?? "", /ORDER BY u\.id/);
  assert.match(sqlCalls[0] ?? "", /FOR UPDATE/);
});
