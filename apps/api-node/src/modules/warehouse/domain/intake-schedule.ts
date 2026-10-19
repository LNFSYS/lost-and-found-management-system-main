import { AppError } from "../../../shared/domain/app-error.js";

export interface CustodyIntakeSchedule {
  timezone: string;
  weeklyHours: Record<string, Array<{ start: string; end: string }>>;
  holidays: string[];
}

const weekdays = ["1", "2", "3", "4", "5"];
const defaultHours = [{ start: "08:00", end: "12:00" }, { start: "13:30", end: "17:00" }];

export const defaultCustodyIntakeSchedule: CustodyIntakeSchedule = {
  timezone: "Asia/Ho_Chi_Minh",
  weeklyHours: Object.fromEntries(weekdays.map(day => [day, defaultHours])),
  holidays: []
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toISOString().slice(0, 10) === value;
}

export function parseCustodyIntakeSchedule(value?: string | null): CustodyIntakeSchedule {
  if (!value) return defaultCustodyIntakeSchedule;
  let parsed: unknown;
  try { parsed = JSON.parse(value); }
  catch { throw new AppError("unavailable", "Lịch tiếp nhận custody chưa được cấu hình hợp lệ"); }
  if (!isRecord(parsed) || typeof parsed.timezone !== "string" || !isRecord(parsed.weeklyHours) || !Array.isArray(parsed.holidays)) {
    throw new AppError("unavailable", "Lịch tiếp nhận custody chưa được cấu hình hợp lệ");
  }
  try { new Intl.DateTimeFormat("en-US", { timeZone: parsed.timezone }); }
  catch { throw new AppError("unavailable", "Múi giờ lịch tiếp nhận custody không hợp lệ"); }

  const weeklyHours: CustodyIntakeSchedule["weeklyHours"] = {};
  for (const [day, windows] of Object.entries(parsed.weeklyHours)) {
    if (!/^[0-6]$/.test(day) || !Array.isArray(windows)) throw new AppError("unavailable", "Lịch tiếp nhận custody chưa được cấu hình hợp lệ");
    const normalized = windows.map(window => {
      if (!isRecord(window) || !isTime(window.start) || !isTime(window.end)
        || window.start >= window.end) throw new AppError("unavailable", "Khung giờ tiếp nhận custody không hợp lệ");
      return { start: window.start, end: window.end };
    });
    weeklyHours[day] = normalized;
  }
  const holidays = parsed.holidays;
  if (!holidays.every(isCalendarDate)) {
    throw new AppError("unavailable", "Danh sách ngày nghỉ custody không hợp lệ");
  }
  return { timezone: parsed.timezone, weeklyHours, holidays: holidays as string[] };
}

export function validateCustodyIntakeTime(value: Date, schedule: CustodyIntakeSchedule, now = Date.now()) {
  if (!Number.isFinite(value.getTime()) || value.getTime() <= now) {
    throw new AppError("invalid_input", "Thời gian dự kiến phải nằm trong tương lai");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: schedule.timezone,
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  if (schedule.holidays.includes(date)) throw new AppError("invalid_input", "Ngày đã chọn là ngày nghỉ tiếp nhận");
  const dayByName: Record<string, string> = { Sun: "0", Mon: "1", Tue: "2", Wed: "3", Thu: "4", Fri: "5", Sat: "6" };
  const day = dayByName[part("weekday")];
  const minute = Number(part("hour")) * 60 + Number(part("minute"));
  const isOpen = (schedule.weeklyHours[day] ?? []).some(window => {
    const [startHour, startMinute] = window.start.split(":").map(Number);
    const [endHour, endMinute] = window.end.split(":").map(Number);
    return minute >= startHour! * 60 + startMinute! && minute < endHour! * 60 + endMinute!;
  });
  if (!isOpen) throw new AppError("invalid_input", "Thời điểm đã chọn nằm ngoài giờ tiếp nhận của quầy; hãy chọn khung giờ đang mở trong lịch hiển thị");
}
