export function nextCustodyIntakeAt(now = new Date()) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCHours(3, 0, 0, 0);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}
