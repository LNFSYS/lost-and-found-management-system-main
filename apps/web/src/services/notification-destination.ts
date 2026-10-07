import type { AppNotification } from "./api";

export function notificationDestination(item: Pick<AppNotification, "entityType" | "entityId">): string {
  if (!item.entityId) return "/notifications";
  const id = encodeURIComponent(item.entityId);
  switch (item.entityType) {
    case "POST_MATCH": return `/posts/${id}/matches`;
    case "POST": return `/posts/${id}`;
    case "CLAIM": return `/claims/${id}`;
    case "APPOINTMENT":
    case "APPOINTMENT_REMINDER": return `/appointments/${id}`;
    case "CUSTODY_REQUEST": return `/notifications?custodyRequestId=${id}`;
    default: return "/notifications";
  }
}
