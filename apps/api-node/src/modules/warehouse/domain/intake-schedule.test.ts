import assert from "node:assert/strict";
import test from "node:test";
import { defaultCustodyIntakeSchedule, parseCustodyIntakeSchedule, validateCustodyIntakeTime } from "./intake-schedule.js";

const now = Date.parse("2026-10-19T00:00:00.000Z");

test("intake policy keeps Vietnam opening boundaries without repository access", () => {
  for (const time of ["2026-10-20T01:00:00.000Z", "2026-10-20T06:30:00.000Z"]) {
    assert.doesNotThrow(() => validateCustodyIntakeTime(new Date(time), defaultCustodyIntakeSchedule, now));
  }
  for (const time of ["2026-10-20T05:00:00.000Z", "2026-10-20T10:00:00.000Z", "2026-10-24T02:00:00.000Z"]) {
    assert.throws(() => validateCustodyIntakeTime(new Date(time), defaultCustodyIntakeSchedule, now), { code: "invalid_input" });
  }
});

test("intake policy rejects holidays, invalid dates and non-future appointments", () => {
  const schedule = { ...defaultCustodyIntakeSchedule, holidays: ["2026-10-20"] };
  assert.throws(() => validateCustodyIntakeTime(new Date("2026-10-20T02:00:00.000Z"), schedule, now), { code: "invalid_input" });
  for (const time of [new Date(now), new Date(now - 1), new Date("invalid")]) {
    assert.throws(() => validateCustodyIntakeTime(time, defaultCustodyIntakeSchedule, now), { code: "invalid_input" });
  }
});

test("intake configuration rejects invalid timezones, reversed windows and impossible holidays", () => {
  for (const schedule of [
    { ...defaultCustodyIntakeSchedule, timezone: "Invalid/Zone" },
    { ...defaultCustodyIntakeSchedule, weeklyHours: { "1": [{ start: "17:00", end: "08:00" }] } },
    { ...defaultCustodyIntakeSchedule, holidays: ["2026-02-30"] }
  ]) {
    assert.throws(() => parseCustodyIntakeSchedule(JSON.stringify(schedule)), { code: "unavailable" });
  }
});
