import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { NotificationEmailDeliveryError, type NotificationEmailDelivery } from "../application/notification-email.port.js";

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
      try {
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
      } catch (error) {
        const providerCode = typeof (error as { code?: unknown })?.code === "string"
          ? (error as { code: string }).code : undefined;
        const uncertain = new Set(["ETIMEDOUT", "ESOCKET", "ECONNRESET", "EPIPE"]).has(providerCode ?? "");
        throw new NotificationEmailDeliveryError(
          uncertain ? "SMTP provider response is uncertain" : "SMTP provider rejected delivery",
          uncertain ? "UNKNOWN" : "NOT_SENT",
          providerCode
        );
      }
    }
  };
}
