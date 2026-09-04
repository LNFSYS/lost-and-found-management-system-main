import assert from "node:assert/strict";
import test from "node:test";
import { notificationRepository } from "../repositories/notification.repository.js";
import { notificationService } from "./notification.service.js";

test("notification list clamps polling limits and returns only repository items", async () => {
  const original = notificationRepository.listForUser;
  let requestedLimit = 0;
  notificationRepository.listForUser = async (_userId, limit) => {
    requestedLimit = limit ?? 0;
    return [];
  };
  try {
    assert.deepEqual(await notificationService.list("user-id", 999), { items: [] });
    assert.equal(requestedLimit, 50);
  } finally {
    notificationRepository.listForUser = original;
  }
});

test("notification read is scoped to the authenticated user", async () => {
  const original = notificationRepository.markRead;
  notificationRepository.markRead = async () => false;
  try {
    await assert.rejects(
      () => notificationService.markRead("user-a", "notification-b"),
      (error: unknown) => (error as { status?: number }).status === 404
    );
  } finally {
    notificationRepository.markRead = original;
  }
});
