import type { Logger } from "../../../shared/application/logger.port.js";
import type { NotificationEmailDelivery } from "./notification-email.port.js";
import type { NotificationEmailEvent, NotificationEmailPreferences, NotificationEmailRepository } from "./notification-email.repository.port.js";

function localMinutes(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function clockMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function quietHoursEnd(preferences: NotificationEmailPreferences, now: Date) {
  if (!preferences.quietHoursStart || !preferences.quietHoursEnd) return null;
  const current = localMinutes(now, preferences.timezone);
  const start = clockMinutes(preferences.quietHoursStart);
  const end = clockMinutes(preferences.quietHoursEnd);
  const within = start < end ? current >= start && current < end : current >= start || current < end;
  if (!within) return null;
  const minutes = current >= start ? 1_440 - current + end : end - current;
  return new Date(now.getTime() + Math.max(1, minutes) * 60_000);
}

function safeErrorCode(error: unknown) {
  const code = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string; }).code : "SMTP_SEND_FAILED";
  return code.replace(/[^A-Z0-9_]/gi, "_").slice(0, 80) || "SMTP_SEND_FAILED";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

function eventCopy(eventType: NotificationEmailEvent, count: number) {
  const countLabel = count > 1 ? `${count} ` : "một ";
  switch (eventType) {
    case "CHAT": return { badge: "TIN NHẮN MỚI", title: `Bạn có ${countLabel}tin nhắn mới`, description: "Có tin nhắn mới trong phòng trao đổi riêng của bạn." };
    case "CLAIM": return { badge: "CẬP NHẬT CLAIM", title: `Bạn có ${countLabel}cập nhật về yêu cầu trao đổi`, description: "Yêu cầu trao đổi riêng của bạn vừa có thay đổi cần xem." };
    case "APPOINTMENT": return { badge: "CẬP NHẬT LỊCH HẸN", title: `Bạn có ${countLabel}cập nhật về lịch hẹn`, description: "Lịch hẹn trao nhận của bạn vừa được cập nhật." };
    case "HANDOVER": return { badge: "CẬP NHẬT BÀN GIAO", title: `Bạn có ${countLabel}cập nhật bàn giao`, description: "Có thông tin mới về quá trình bàn giao vật phẩm." };
    case "CUSTODY": return { badge: "CẬP NHẬT LƯU GIỮ", title: `Bạn có ${countLabel}cập nhật lưu giữ`, description: "Có thông tin mới về việc chuyển hoặc lưu giữ vật phẩm." };
    case "OVERDUE": return { badge: "CẦN XỬ LÝ", title: `Bạn có ${countLabel}công việc cần xử lý`, description: "Một công việc vận hành đang cần được bạn kiểm tra." };
    case "FEEDBACK": return { badge: "PHẢN HỒI MỚI", title: `Bạn có ${countLabel}thông báo phản hồi`, description: "Có phản hồi mới liên quan đến quá trình trao trả." };
  }
}

function genericContent(count: number, entityId: string | null, frontendUrl: string, eventType: NotificationEmailEvent) {
  const deepLink = entityId ? new URL(`/claims/${entityId}`, frontendUrl).toString() : new URL("/home", frontendUrl).toString();
  const copy = eventCopy(eventType, count);
  const safeDeepLink = escapeHtml(deepLink);
  return {
    subject: `${copy.badge[0] + copy.badge.slice(1).toLowerCase()} | FPTU Lost & Found`,
    text: `${copy.title} trên FPTU Lost & Found. Mở email HTML và bấm "TRUY CẬP TRANG WEB" để xem thông tin.\n\nEmail này không chứa nội dung trao đổi riêng hoặc thông tin nhạy cảm.`,
    html: `<!doctype html>
<html lang="vi">
  <head><meta name="x-apple-disable-message-reformatting"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#243d4a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.title)} trên FPTU Lost &amp; Found.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef4f8;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #d8e4eb;border-radius:14px;overflow:hidden;">
          <tr><td style="background:#0b5cab;padding:24px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:22px;font-weight:800;letter-spacing:.2px;color:#ffffff;">FPTU Lost &amp; Found</td>
              <td align="right" style="font-size:12px;color:#d9edff;white-space:nowrap;">THÔNG BÁO</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:34px 34px 10px;">
            <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#fff3e8;color:#df650e;font-size:11px;font-weight:800;letter-spacing:.6px;">${escapeHtml(copy.badge)}</div>
            <h1 style="margin:16px 0 10px;color:#243d4a;font-size:24px;line-height:1.3;">${escapeHtml(copy.title)}</h1>
            <p style="margin:0;color:#5c7481;font-size:15px;line-height:1.65;">${escapeHtml(copy.description)}</p>
          </td></tr>
          <tr><td style="padding:22px 34px 30px;" align="center">
            <a href="${safeDeepLink}" style="display:inline-block;min-width:220px;padding:14px 24px;background:#f97316;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:800;letter-spacing:.2px;">TRUY CẬP TRANG WEB</a>
            <p style="margin:18px 0 0;color:#718692;font-size:12px;line-height:1.55;">Đăng nhập để xem thông báo trong không gian an toàn của bạn.</p>
          </td></tr>
          <tr><td style="padding:0 34px;"><div style="height:1px;background:#e5edf1;"></div></td></tr>
          <tr><td style="padding:20px 34px 26px;">
            <p style="margin:0;color:#78909c;font-size:12px;line-height:1.6;">Email này chỉ dùng để thông báo. Nội dung trao đổi riêng và thông tin nhạy cảm không được đưa vào email.</p>
            <p style="margin:12px 0 0;color:#9aabb3;font-size:11px;">FPTU Lost &amp; Found · Email tự động, vui lòng không trả lời.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
  };
}

export function createNotificationEmailWorker(options: {
  repository: NotificationEmailRepository;
  emailDelivery: NotificationEmailDelivery;
  id: () => string;
  frontendUrl: string;
  logger: Logger;
  now?: () => Date;
  maxAttempts?: number;
  leaseSeconds?: number;
}) {
  const now = options.now ?? (() => new Date());
  const maxAttempts = options.maxAttempts ?? 5;
  const leaseSeconds = options.leaseSeconds ?? 60;

  async function processOne(item: Awaited<ReturnType<NotificationEmailRepository["claimDue"]>>[number], leaseToken: string) {
    // claimDue reserves the primary row; attach every eligible sibling to its lease.
    await options.repository.claimCoalesced({ item, leaseToken, leaseSeconds });
    const leased = await options.repository.listLease(leaseToken);
    if (!leased.length) return { sent: 0, skipped: 1 };
    const preferences = await options.repository.getPreferences(item.recipientUserId);
    const mode = item.eventType === "CHAT" ? preferences.chatMode : preferences.claimMode;
    if (mode === "DISABLED") {
      await options.repository.cancelLease(leaseToken);
      return { sent: 0, skipped: leased.length };
    }
    const quietEnd = quietHoursEnd(preferences, now());
    if (quietEnd) {
      await options.repository.deferLease(leaseToken, quietEnd);
      return { sent: 0, deferred: leased.length };
    }
    const eligible = leased.filter((entry) => entry.accountActive && entry.emailVerified
      && (entry.notificationUnread || item.deliveryMode === "IMMEDIATE") && entry.entityAccessible);
    if (!eligible.length) {
      await options.repository.cancelLease(leaseToken);
      return { sent: 0, skipped: leased.length };
    }
    const content = genericContent(eligible.length, eligible[0]!.entityId, options.frontendUrl, item.eventType);
    try {
      await options.emailDelivery.send({
        to: eligible[0]!.email,
        ...content,
        // Stable across retry; SMTP adapters expose this to providers as Message-ID/header.
        idempotencyKey: eligible[0]!.idempotencyKey
      });
      await options.repository.markSent(leaseToken);
      return { sent: eligible.length };
    } catch (error) {
      const attempt = Math.max(...leased.map((entry) => entry.attemptCount));
      const errorCode = safeErrorCode(error);
      if (attempt >= maxAttempts) await options.repository.cancelLease(leaseToken);
      else {
        const delayMinutes = Math.min(60, 2 ** Math.max(0, attempt - 1));
        await options.repository.releaseLeaseForRetry({ leaseToken, dueAt: new Date(now().getTime() + delayMinutes * 60_000), errorCode });
      }
      options.logger.warn(JSON.stringify({ event: "notification_email_delivery_failed", eventType: item.eventType, attempt, errorCode, deliveryCount: leased.length }));
      return { sent: 0, failed: leased.length };
    }
  }

  return {
    async runOnce(limit = 20) {
      const results = [];
      const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
      for (let index = 0; index < safeLimit; index += 1) {
        const leaseToken = options.id();
        const due = await options.repository.claimDue({ limit: 1, leaseToken, leaseSeconds });
        if (!due[0]) break;
        results.push(await processOne(due[0], leaseToken));
      }
      return results.reduce((summary, result) => ({
        sent: summary.sent + (result.sent ?? 0),
        skipped: summary.skipped + (result.skipped ?? 0),
        deferred: summary.deferred + (result.deferred ?? 0),
        failed: summary.failed + (result.failed ?? 0)
      }), { sent: 0, skipped: 0, deferred: 0, failed: 0 });
    }
  };
}
