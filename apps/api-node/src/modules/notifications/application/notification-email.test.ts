import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationEmailQueue } from "./notification-email.queue.js";
import { createNotificationEmailWorker, quietHoursEnd } from "./notification-email.worker.js";
import type { NotificationEmailRepository } from "./notification-email.repository.port.js";
import type { NotificationRecord } from "./notification.repository.port.js";

const preferences = {
  userId: "user-a",
  chatMode: "DELAYED_UNREAD" as const,
  claimMode: "IMMEDIATE" as const,
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: "Asia/Ho_Chi_Minh",
  updatedAt: "2026-09-23T00:00:00.000Z"
};

const notification: NotificationRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "CHAT_MESSAGE_RECEIVED",
  title: "New private message",
  body: "Do not put this private body in email",
  entityType: "CLAIM",
  entityId: "22222222-2222-4222-8222-222222222222",
  isRead: false,
  readAt: null,
  createdAt: "2026-09-23T00:00:00.000Z"
};

function repository(overrides: Partial<NotificationEmailRepository> = {}) {
  return {
    getPreferences: async () => preferences,
    updatePreferences: async () => preferences,
    enqueue: async () => undefined,
    cancelForNotification: async () => 0,
    cancelForRoom: async () => 0,
    cancelForUser: async () => 0,
    claimDue: async () => [],
    claimCoalesced: async () => undefined,
    listLease: async () => [],
    markSent: async () => undefined,
    cancelLease: async () => undefined,
    deferLease: async () => undefined,
    releaseLeaseForRetry: async () => undefined,
    ...overrides
  } satisfies NotificationEmailRepository;
}

test("notification email queue clamps chat delay to the required five-to-ten minute window", async () => {
  let dueAt: Date | undefined;
  const queue = createNotificationEmailQueue({
    repository: repository({ enqueue: async (input) => { dueAt = input.dueAt; } }),
    id: () => "33333333-3333-4333-8333-333333333333",
    chatDelayMinutes: 99,
    digestDelayMinutes: 60,
    now: () => new Date("2026-09-23T00:00:00.000Z")
  });
  await queue.enqueue({ notification, recipientUserId: "user-a", eventType: "CHAT", roomId: "room-a" }, Object.freeze({}) as never);
  assert.equal(dueAt?.toISOString(), "2026-09-23T00:10:00.000Z");
});

test("disabled optional preference does not create an outbox row", async () => {
  let enqueued = false;
  const queue = createNotificationEmailQueue({
    repository: repository({ getPreferences: async () => ({ ...preferences, chatMode: "DISABLED" }), enqueue: async () => { enqueued = true; } }),
    id: () => "44444444-4444-4444-8444-444444444444",
    chatDelayMinutes: 7,
    digestDelayMinutes: 60
  });
  await queue.enqueue({ notification, recipientUserId: "user-a", eventType: "CHAT" }, Object.freeze({}) as never);
  assert.equal(enqueued, false);
});

test("worker sends one generic email for eligible unread delivery and never includes private message content", async () => {
  let sent: { subject: string; text: string; html: string; idempotencyKey: string } | undefined;
  let markedSent = false;
  let claimed = false;
  const outbox = {
    id: "55555555-5555-4555-8555-555555555555",
    notificationId: notification.id,
    recipientUserId: "user-a",
    eventType: "CHAT" as const,
    entityType: "CLAIM",
    entityId: notification.entityId,
    roomId: "room-a",
    deliveryMode: "DELAYED_UNREAD" as const,
    idempotencyKey: "notification-email:stable",
    attemptCount: 1
  };
  const worker = createNotificationEmailWorker({
    repository: repository({
      claimDue: async () => { if (claimed) return []; claimed = true; return [outbox]; },
      listLease: async () => [{ ...outbox, email: "verified@example.com", emailVerified: true, accountActive: true, notificationUnread: true, entityAccessible: true }],
      markSent: async () => { markedSent = true; }
    }),
    emailDelivery: { send: async (input) => { sent = { subject: input.subject, text: input.text, html: input.html, idempotencyKey: input.idempotencyKey }; return {}; } },
    id: () => "66666666-6666-4666-8666-666666666666",
    frontendUrl: "https://lnfs.example",
    logger: { warn: () => undefined }
  });
  const result = await worker.runOnce();
  assert.equal(result.sent, 1);
  assert.equal(markedSent, true);
  assert.equal(sent?.idempotencyKey, "notification-email:stable");
  assert.match(sent?.subject ?? "", /Tin nhắn mới/);
  assert.match(sent?.html ?? "", /TIN NHẮN MỚI/);
  assert.match(sent?.html ?? "", /TRUY CẬP TRANG WEB/);
  assert.match(sent?.html ?? "", /href="https:\/\/lnfs\.example\/claims\//);
  assert.doesNotMatch(sent?.text ?? "", /https:\/\/lnfs\.example\/claims\//);
  assert.doesNotMatch(sent?.text ?? "", /Do not put this private body/);
});

test("quiet hours calculate a future retry time in the user's timezone", () => {
  const end = quietHoursEnd({ ...preferences, quietHoursStart: "22:00", quietHoursEnd: "07:00" }, new Date("2026-09-23T17:30:00.000Z"));
  assert.ok(end);
  assert.equal(end?.toISOString(), "2026-09-24T00:00:00.000Z");
});
