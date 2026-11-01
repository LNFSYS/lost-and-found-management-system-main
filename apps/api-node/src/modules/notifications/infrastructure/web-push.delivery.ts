import webpush from "web-push";
import type { NotificationPushDelivery } from "../application/notification-push.worker.js";

export function createWebPushDelivery(config: { publicKey: string; privateKey: string; subject: string; }): NotificationPushDelivery {
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return {
    async send(input) {
      await webpush.sendNotification({ endpoint: input.endpoint, keys: { p256dh: input.p256dh, auth: input.auth } },
        input.payload, { TTL: 120, urgency: "normal" });
    }
  };
}
