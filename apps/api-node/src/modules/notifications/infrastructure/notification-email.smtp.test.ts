import assert from "node:assert/strict";
import test from "node:test";
import nodemailer from "nodemailer";
import { createSmtpNotificationEmailDelivery } from "./notification-email.smtp.js";
import { NotificationEmailDeliveryError } from "../application/notification-email.port.js";

for (const code of ["EAUTH", "ETIMEDOUT", "ECONNRESET", "UNEXPECTED"]) {
  test(`SMTP uses explicit timeouts and classifies ${code} conservatively`, async t => {
    let config: Record<string, unknown> = {};
    t.mock.method(nodemailer, "createTransport", (value: Record<string, unknown>) => {
      config = value;
      return { sendMail: async () => { throw Object.assign(new Error("provider failure"), { code }); } };
    });
    const delivery = createSmtpNotificationEmailDelivery({ smtp: { host: "smtp.example.invalid", port: 587, secure: false, user: "fixture", pass: "fixture", from: "fixture@example.invalid" } });
    assert.equal(config.connectionTimeout, 15_000);
    assert.equal(config.greetingTimeout, 15_000);
    assert.equal(config.socketTimeout, 30_000);
    assert.equal(config.dnsTimeout, 10_000);
    await assert.rejects(delivery.send({ to: "recipient@example.invalid", subject: "Fixture", text: "Fixture", html: "Fixture", idempotencyKey: "fixture" }), error => error instanceof NotificationEmailDeliveryError && error.deliveryState === (code === "EAUTH" ? "NOT_SENT" : "UNKNOWN"));
  });
}
