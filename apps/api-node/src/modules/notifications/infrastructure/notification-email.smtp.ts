import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import type { NotificationEmailDelivery } from "../application/notification-email.port.js";

export function createSmtpNotificationEmailDelivery(options: {
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string; from: string; };
}): NotificationEmailDelivery {
  const transport = nodemailer.createTransport({
    host: options.smtp.host, port: options.smtp.port, secure: options.smtp.secure,
    auth: { user: options.smtp.user, pass: options.smtp.pass }
  });
  return {
    async send(input) {
      const stableMessageId = `${createHash("sha256").update(input.idempotencyKey).digest("hex")}@lnfs.notification`;
      const result = await transport.sendMail({
        from: options.smtp.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        messageId: `<${stableMessageId}>`,
        headers: { "X-LNFS-Notification-Idempotency-Key": input.idempotencyKey }
      });
      return { providerMessageId: result.messageId ?? null };
    }
  };
}
