import assert from "node:assert/strict";
import test from "node:test";
import { notificationRepository, notificationService } from "../../../test/use-case-fixtures.js";
import { createNotificationUseCases } from "./notification.use-cases.js";
import type { NotificationEmailRepository } from "./notification-email.repository.port.js";

test("notification list clamps polling limits and returns a database-backed unread total", async () => {
  const original = notificationRepository.listForUser;
  const originalCountUnread = notificationRepository.countUnreadForUser;
  let requestedLimit = 0;
  notificationRepository.listForUser = async (_userId, limit) => {
    requestedLimit = limit ?? 0;
    return [];
  };
  notificationRepository.countUnreadForUser = async () => 3;
  try {
    assert.deepEqual(await notificationService.list("user-id", 999), { items: [], unreadTotal: 3 });
    assert.equal(requestedLimit, 50);
  } finally {
    notificationRepository.listForUser = original;
    notificationRepository.countUnreadForUser = originalCountUnread;
  }
});

test("notification read is scoped to the authenticated user", async () => {
  const original = notificationRepository.markRead;
  notificationRepository.markRead = async () => false;
  try {
    await assert.rejects(
      () => notificationService.markRead("user-a", "notification-b"),
      (error: unknown) => (error as { code?: string; }).code === "not_found"
    );
  } finally {
    notificationRepository.markRead = original;
  }
});

test("email preference updates are scoped to the authenticated subject", async () => {
  let updatedUserId = "";
  const emailRepository = {
    updatePreferences: async (userId: string, input: Parameters<NotificationEmailRepository["updatePreferences"]>[1]) => {
      updatedUserId = userId;
      return { userId, ...input, updatedAt: new Date().toISOString() };
    }
  } as Pick<NotificationEmailRepository, "updatePreferences"> as NotificationEmailRepository;
  const service = createNotificationUseCases({ notificationRepository, notificationEmailRepository: emailRepository });
  await service.updateEmailPreferences("user-a", {
    chatMode: "IMMEDIATE", claimMode: "DISABLED", quietHoursStart: null, quietHoursEnd: null, timezone: "UTC"
  });
  assert.equal(updatedUserId, "user-a");
});
