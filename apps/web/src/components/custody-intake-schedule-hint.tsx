import { useEffect, useState } from "react";
import { api } from "../services/api";

type WindowRange = { start: string; end: string };
type Schedule = { timezone: string; weeklyHours: Record<string, WindowRange[]>; holidays: string[] };

const fallback: Schedule = {
  timezone: "Asia/Ho_Chi_Minh",
  weeklyHours: { "1": [{ start: "08:00", end: "12:00" }, { start: "13:30", end: "17:00" }],
    "2": [{ start: "08:00", end: "12:00" }, { start: "13:30", end: "17:00" }],
    "3": [{ start: "08:00", end: "12:00" }, { start: "13:30", end: "17:00" }],
    "4": [{ start: "08:00", end: "12:00" }, { start: "13:30", end: "17:00" }],
    "5": [{ start: "08:00", end: "12:00" }, { start: "13:30", end: "17:00" }] }, holidays: []
};

const dayNames = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function readSchedule(value: unknown): Schedule | null {
  if (typeof value === "string") {
    try { value = JSON.parse(value) as unknown; } catch { return null; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.timezone !== "string" || !item.weeklyHours || typeof item.weeklyHours !== "object" || Array.isArray(item.weeklyHours)) return null;
  const weeklyHours: Record<string, WindowRange[]> = {};
  for (const [day, ranges] of Object.entries(item.weeklyHours as Record<string, unknown>)) {
    if (!Array.isArray(ranges)) continue;
    weeklyHours[day] = ranges.filter((range): range is WindowRange => Boolean(range && typeof range === "object"
      && typeof (range as WindowRange).start === "string" && typeof (range as WindowRange).end === "string"));
  }
  return { timezone: item.timezone, weeklyHours, holidays: Array.isArray(item.holidays) ? item.holidays.filter((day): day is string => typeof day === "string") : [] };
}

function describe(schedule: Schedule) {
  const groups: Array<{ start: number; end: number; signature: string; windows: WindowRange[] }> = [];
  for (let day = 0; day <= 6; day += 1) {
    const windows = schedule.weeklyHours[String(day)] ?? [];
    if (!windows.length) continue;
    const signature = windows.map((window) => `${window.start}-${window.end}`).join(",");
    const previous = groups[groups.length - 1];
    if (previous && previous.end === day - 1 && previous.signature === signature) previous.end = day;
    else groups.push({ start: day, end: day, signature, windows });
  }
  const hours = groups.map((group) => {
    const days = group.start === group.end ? dayNames[group.start] : `${dayNames[group.start]}–${dayNames[group.end]}`;
    const windows = group.windows.map((window) => `${window.start}–${window.end}`).join(" và ");
    return { days, windows };
  });
  const closedDays = [1, 2, 3, 4, 5, 6, 0]
    .filter((day) => !(schedule.weeklyHours[String(day)] ?? []).length)
    .map((day) => dayNames[day]);
  return { hours, closedDays };
}

export function CustodyIntakeScheduleHint({ className }: { className?: string }) {
  const [schedule, setSchedule] = useState(fallback);
  useEffect(() => {
    let active = true;
    api.getPublicConfig().then((result) => {
      if (!active) return;
      const current = readSchedule(result.values["custody.intake.schedule"]);
      if (current) setSchedule(current);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const description = describe(schedule);
  return <div className={["custody-intake-schedule-hint", className].filter(Boolean).join(" ")}>
    <p className="custody-intake-schedule-hint__title">Giờ tiếp nhận · {schedule.timezone === "Asia/Ho_Chi_Minh" ? "giờ Việt Nam" : schedule.timezone}</p>
    {description.hours.length ? description.hours.map((group) => <div className="custody-intake-schedule-hint__line" key={group.days}>
      <span>{group.days}</span><strong>{group.windows}</strong>
    </div>) : <p className="custody-intake-schedule-hint__empty">Chưa có ngày mở cửa được cấu hình.</p>}
    <div className="custody-intake-schedule-hint__line custody-intake-schedule-hint__line--closed">
      <span>Ngày nghỉ hằng tuần</span><strong>{description.closedDays.length ? description.closedDays.join(", ") : "Không có"}</strong>
    </div>
  </div>;
}
