// Public contracts for other business modules.
export type { NotificationRecord, NotificationRepository, NotificationType } from "./notification.repository.port.js";
export type { NotificationEmailQueue } from "./notification-email.queue.js";
export type { NotificationEmailEvent } from "./notification-email.repository.port.js";
