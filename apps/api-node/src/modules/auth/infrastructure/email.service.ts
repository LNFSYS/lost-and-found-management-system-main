import nodemailer from "nodemailer";
import { AppError } from "../../../shared/domain/app-error.js";
import type { EmailDelivery } from "../application/email.port.js";

export function createEmailDelivery(options: {
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string; from: string; };
  otpTtlMinutes: number;
}): EmailDelivery {
  const transport = nodemailer.createTransport({ host: options.smtp.host, port: options.smtp.port, secure: options.smtp.secure, auth: { user: options.smtp.user, pass: options.smtp.pass } });

  async function sendOtp(email: string, otp: string, purpose: "registration" | "password reset") {
    try {
      await transport.sendMail({
        from: options.smtp.from,
        to: email,
        subject: purpose === "registration" ? "Mã xác thực FPTU Lost & Found" : "Mã đặt lại mật khẩu FPTU Lost & Found",
        text: `Mã ${purpose === "registration" ? "xác thực" : "đặt lại mật khẩu"} của bạn là ${otp}. Mã có hiệu lực trong ${options.otpTtlMinutes} phút. Không chia sẻ mã này với bất kỳ ai.`
      });
    } catch {
      throw new AppError("unavailable", "Không thể gửi email OTP. Vui lòng kiểm tra cấu hình SMTP và thử lại.");
    }
  }

  return { sendRegistrationOtp: (email: string, otp: string) => sendOtp(email, otp, "registration"), sendPasswordResetOtp: (email: string, otp: string) => sendOtp(email, otp, "password reset") };
}
