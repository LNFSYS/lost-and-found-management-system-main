import type { Logger } from "../../../shared/application/logger.port.js";
import type { NotificationEmailRepository } from "./notification-email.repository.port.js";

export interface NotificationPushDelivery {
  send(input: { endpoint: string; p256dh: string; auth: string; payload: string; }): Promise<void>;
}

function errorCode(error: unknown) {
  const code = typeof (error as { statusCode?: unknown })?.statusCode === "number"
    ? `HTTP_${(error as { statusCode: number }).statusCode}`
    : typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "PUSH_SEND_FAILED";
  return code.replace(/[^A-Z0-9_]/gi, "_").slice(0, 80) || "PUSH_SEND_FAILED";
}

export function createNotificationPushWorker(options: {
  repository: NotificationEmailRepository;
  delivery: NotificationPushDelivery;
  id: () => string;
  logger: Logger;
  maxAttempts?: number;
  leaseSeconds?: number;
  now?: () => Date;
}) {
  const now = options.now ?? (() => new Date());
  const maxAttempts = options.maxAttempts ?? 4;
  const leaseSeconds = options.leaseSeconds ?? 45;
  let stopped = false;
  let running: Promise<{ sent: number; skipped: number; failed: number; }> | null = null;

  async function processBatch(limit: number) {
    const repository = options.repository;
    if (!repository.claimPushDue || !repository.markPushSent || !repository.releasePushForRetry || !repository.cancelPushLease) {
      return { sent: 0, skipped: 0, failed: 0 };
    }
    const summary = { sent: 0, skipped: 0, failed: 0 };
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    for (let index = 0; index < safeLimit; index += 1) {
      if (stopped) break;
      const leaseToken = options.id();
      const items = await repository.claimPushDue({ limit: 1, leaseToken, leaseSeconds });
      const item = items[0];
      if (!item) break;
      try {
        // Never put a claim, chat, appointment, or evidence detail on a lock screen.
        await options.delivery.send({ endpoint: item.endpoint, p256dh: item.p256dh, auth: item.auth,
          payload: JSON.stringify({ title: "FPTU Lost & Found", body: "Bạn có thông báo mới. Mở ứng dụng để xem.", url: "/notifications" }) });
      } catch (error) {
        const code = errorCode(error);
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await repository.cancelPushLease(leaseToken, item.id, "PUSH_SUBSCRIPTION_EXPIRED");
          await repository.deletePushSubscription?.(item.recipientUserId, item.endpoint);
          summary.skipped += 1;
          continue;
        }
        if (item.attemptCount >= maxAttempts) {
          await repository.cancelPushLease(leaseToken, item.id, code);
          summary.failed += 1;
          continue;
        }
        const delayMinutes = Math.min(60, 2 ** Math.max(0, item.attemptCount - 1));
        await repository.releasePushForRetry({ leaseToken, outboxId: item.id,
          dueAt: new Date(now().getTime() + delayMinutes * 60_000), errorCode: code });
        summary.failed += 1;
        options.logger.warn(JSON.stringify({ event: "notification_push_delivery_failed", attempt: item.attemptCount, errorCode: code }));
        continue;
      }
      try {
        await repository.markPushSent(leaseToken, item.id);
        summary.sent += 1;
      } catch (error) {
        const code = errorCode(error);
        await repository.cancelPushLease(leaseToken, item.id, "PUSH_ACK_NOT_RECORDED");
        summary.failed += 1;
        options.logger.warn(JSON.stringify({ event: "notification_push_ack_uncertain", errorCode: code }));
      }
    }
    return summary;
  }

  return {
    runOnce(limit = 20) {
      if (stopped) return Promise.resolve({ sent: 0, skipped: 0, failed: 0 });
      if (!running) running = processBatch(limit).finally(() => { running = null; });
      return running;
    },
    async stop() {
      stopped = true;
      await running;
    }
  };
}

export type NotificationPushWorker = ReturnType<typeof createNotificationPushWorker>;
