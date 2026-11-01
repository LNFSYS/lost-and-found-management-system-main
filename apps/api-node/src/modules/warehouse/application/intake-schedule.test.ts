import assert from "node:assert/strict";
import test from "node:test";
import type { SystemConfigRepository } from "../../system-config/application/index.js";
import { loadCustodyIntakeSchedule } from "./intake-schedule.js";
import { defaultCustodyIntakeSchedule } from "../domain/intake-schedule.js";

function scheduleRepository(value: string | null): Pick<SystemConfigRepository, "findByKey"> {
  return {
    async findByKey(key) {
      assert.equal(key, "custody.intake.schedule");
      return value === null ? null : {
        id: "schedule-config", configKey: key, configValue: value, valueType: "JSON",
        description: null, isPublic: true, updatedBy: null, updatedAt: "2026-10-20T00:00:00.000Z"
      };
    }
  };
}

test("intake schedule uses the default only when the reader or setting is absent", async () => {
  assert.deepEqual(await loadCustodyIntakeSchedule(), defaultCustodyIntakeSchedule);
  assert.deepEqual(await loadCustodyIntakeSchedule(scheduleRepository(null)), defaultCustodyIntakeSchedule);
});

test("intake schedule loads custom hours and holidays through the application reader", async () => {
  const schedule = { timezone: "Asia/Ho_Chi_Minh", weeklyHours: { "2": [{ start: "09:00", end: "11:00" }] }, holidays: ["2026-11-02"] };
  assert.deepEqual(await loadCustodyIntakeSchedule(scheduleRepository(JSON.stringify(schedule))), schedule);
});

test("intake schedule does not fall back on invalid configuration or a failed read", async () => {
  await assert.rejects(loadCustodyIntakeSchedule(scheduleRepository("not-json")), { code: "unavailable" });
  const failure = new Error("Configuration reader unavailable");
  await assert.rejects(loadCustodyIntakeSchedule({ async findByKey() { throw failure; } }), error => error === failure);
});
