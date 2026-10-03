import assert from "node:assert/strict";
import test from "node:test";
import { createWarehouseMaintenanceTask } from "./warehouse-maintenance.js";
import { checkWarehouseMaintenanceSchema, warehouseMaintenanceColumns } from "./warehouse-maintenance-schema.js";
import type { SqlExecutor } from "../shared/infrastructure/transaction-context.js";

function log() {
  const warnings: unknown[][] = [], infos: unknown[][] = [];
  return { warnings, infos, logger: { warn: (...args: unknown[]) => { warnings.push(args); }, info: (...args: unknown[]) => { infos.push(args); } } };
}

test("maintenance pauses without writes until schema appears, without repeated warnings", async () => {
  let ready = false, runs = 0;
  const logs = log();
  const task = createWarehouseMaintenanceTask({ checkSchema: async () => ({ ready, missing: ready ? [] : ["warehouse_private_proofs"] }), runOnce: async () => { runs++; }, logger: logs.logger });
  await task.tick(); await task.tick();
  assert.equal(runs,0);
  assert.equal(logs.warnings.length,1);
  assert.match(JSON.stringify(logs.warnings), /WAREHOUSE_SCHEMA_NOT_READY/);
  ready = true;
  await task.tick(); await task.tick();
  assert.equal(runs,2);
  assert.equal(logs.infos.length,1);
  await task.stop(); await task.tick();
  assert.equal(runs,2);
});

test("schema and maintenance failures expose safe codes, never SQL or private values", async () => {
  const logs = log();
  let checkingFails = true, runs = 0;
  const failure = Object.assign(new Error("secret evidence"), { code: "ER_NO_SUCH_TABLE", errno: 1146, sqlState: "42S02", sql: "secret SQL", sqlMessage: "private value" });
  const task = createWarehouseMaintenanceTask({ checkSchema: async () => { if (checkingFails) throw failure; return { ready: true, missing: [] }; }, runOnce: async () => { runs++; throw failure; }, logger: logs.logger });
  await task.tick(); await task.tick();
  assert.equal(runs,0);
  assert.equal(logs.warnings.length,1);
  checkingFails = false;
  await task.tick(); await task.tick();
  assert.equal(runs,2);
  assert.equal(logs.warnings.length,2);
  const output = JSON.stringify(logs.warnings);
  assert.match(output, /ER_NO_SUCH_TABLE/);
  assert.match(output, /1146/);
  assert.match(output, /SCHEMA_CHECK/);
  assert.match(output, /MAINTENANCE/);
  assert.doesNotMatch(output, /secret|private value/);
});

test("maintenance does not overlap and stop waits for the current tick", async () => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let runs = 0;
  const task = createWarehouseMaintenanceTask({ checkSchema: async () => ({ ready: true, missing: [] }), runOnce: async () => { runs++; await waiting; }, logger: log().logger });
  const first = task.tick(), second = task.tick();
  assert.equal(first,second);
  await Promise.resolve();
  assert.equal(runs,1);
  let stopped = false;
  const stopping = task.stop().then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(stopped,false);
  release(); await first; await stopping;
  assert.equal(stopped,true);
  await task.tick(); assert.equal(runs,1);
});

test("maintenance schema probe detects absent tables and partial columns using SELECT only", async () => {
  const rows = Object.entries(warehouseMaintenanceColumns).flatMap(([table,columns]) => columns.map(column => ({ table_name: table, column_name: column })));
  let current = rows;
  const sql: string[] = [];
  const database = { execute: async (query: string) => { sql.push(query); return [current,[]]; } } as unknown as SqlExecutor;
  assert.deepEqual(await checkWarehouseMaintenanceSchema(database), { ready: true, missing: [] });
  current = rows.filter(row => row.table_name !== "warehouse_private_proofs" && !(row.table_name === "claims" && row.column_name === "source_found_post_id"));
  assert.deepEqual(await checkWarehouseMaintenanceSchema(database), { ready: false, missing: ["warehouse_private_proofs","claims.source_found_post_id"] });
  assert.ok(sql.every(query => /^SELECT\b/.test(query.trim()) && !/\b(INSERT|UPDATE|DELETE|ALTER|CREATE)\b/.test(query)));
});
