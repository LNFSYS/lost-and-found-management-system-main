import nodemailer from "nodemailer";
import { AppError } from "../../../shared/domain/app-error.js";
import type { EmailDelivery } from "../application/email.port.js";

export function createEmailDelivery(options: {
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string; from: string; };
  otpTtlMinutes: number;
}): EmailDelivery {
  const transport = nodemailer.createTransport({ host: options.smtp.host, port: options.smtp.port, secure: options.smtp.secure, auth: { user: options.smtp.user, pass: options.smtp.pass } });

  function escapeHtml(value: string) {
    return value.replace(/[&<>\"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character] ?? character);
  }

  async function sendOtp(email: string, otp: string, purpose: "registration" | "password reset") {
    const registration = purpose === "registration";
    const title = registration ? "Xác thực email của bạn" : "Đặt lại mật khẩu";
    const badge = registration ? "XÁC THỰC TÀI KHOẢN" : "BẢO MẬT TÀI KHOẢN";
    const intro = registration
      ? "Dùng mã bên dưới để hoàn tất việc tạo tài khoản FPTU Lost & Found."
      : "Dùng mã bên dưới để tạo mật khẩu mới cho tài khoản FPTU Lost & Found.";
    const safeOtp = escapeHtml(otp);
    const safeTtl = escapeHtml(String(options.otpTtlMinutes));
    try {
      await transport.sendMail({
        from: options.smtp.from,
        to: email,
        subject: registration ? "Mã xác thực email | FPTU Lost & Found" : "Mã đặt lại mật khẩu | FPTU Lost & Found",
        text: `${title}\n\n${intro}\n\nMÃ OTP: ${otp}\nMã có hiệu lực trong ${options.otpTtlMinutes} phút và chỉ dùng được một lần.\n\nNếu bạn không thực hiện yêu cầu này, hãy bỏ qua email. Không chia sẻ mã với bất kỳ ai.`,
        html: `<!doctype html>
<html lang="vi"><head><meta name="x-apple-disable-message-reformatting"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#243d4a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(title)} · Mã có hiệu lực trong ${safeTtl} phút.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4f8;padding:30px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #d8e4eb;border-radius:14px;overflow:hidden;">
      <tr><td style="background:#0b5cab;padding:24px 30px;color:#fff;"><div style="font-size:21px;font-weight:800;">FPTU Lost &amp; Found</div><div style="margin-top:5px;color:#d9edff;font-size:11px;letter-spacing:1px;">${badge}</div></td></tr>
      <tr><td style="padding:32px 34px 12px;"><h1 style="margin:0 0 10px;color:#243d4a;font-size:24px;line-height:1.3;">${escapeHtml(title)}</h1><p style="margin:0;color:#5c7481;font-size:15px;line-height:1.65;">${escapeHtml(intro)}</p></td></tr>
      <tr><td style="padding:20px 34px 26px;"><div style="padding:20px;text-align:center;border:1px solid #cfe1ed;border-radius:10px;background:#f3f9fc;"><div style="color:#6c8491;font-size:11px;font-weight:800;letter-spacing:1.4px;">MÃ OTP CỦA BẠN</div><div style="margin-top:10px;color:#0b5cab;font-size:34px;font-weight:800;letter-spacing:9px;">${safeOtp}</div><div style="margin-top:10px;color:#718692;font-size:12px;">Có hiệu lực trong ${safeTtl} phút · chỉ dùng một lần</div></div></td></tr>
      <tr><td style="padding:0 34px 28px;"><div style="padding:13px 14px;border-left:3px solid #f97316;border-radius:4px;background:#fff7ef;color:#6e5b4e;font-size:12px;line-height:1.6;">Vì an toàn, không chia sẻ mã này qua tin nhắn, điện thoại hoặc với bất kỳ ai. Nếu bạn không yêu cầu mã, hãy bỏ qua email này.</div></td></tr>
      <tr><td style="padding:18px 34px 24px;border-top:1px solid #e5edf1;color:#9aabb3;font-size:11px;line-height:1.6;">FPTU Lost &amp; Found · Email bảo mật tự động, vui lòng không trả lời.</td></tr>
    </table>
  </td></tr></table>
</body></html>`
      });
    } catch {
      throw new AppError("unavailable", "Không thể gửi email OTP. Vui lòng kiểm tra cấu hình SMTP và thử lại.");
    }
  }

  return { sendRegistrationOtp: (email: string, otp: string) => sendOtp(email, otp, "registration"), sendPasswordResetOtp: (email: string, otp: string) => sendOtp(email, otp, "password reset") };
}
