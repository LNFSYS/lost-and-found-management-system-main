import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

const transport = nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.secure, auth: { user: env.smtp.user, pass: env.smtp.pass } });

async function sendOtp(email: string, otp: string, purpose: "registration" | "password reset") {
  try {
    await transport.sendMail({
      from: env.smtp.from,
      to: email,
      subject: purpose === "registration" ? "Mã xác thực FPTU Lost & Found" : "Mã đặt lại mật khẩu FPTU Lost & Found",
      text: `Mã ${purpose === "registration" ? "xác thực" : "đặt lại mật khẩu"} của bạn là ${otp}. Mã có hiệu lực trong ${env.otpTtlMinutes} phút. Không chia sẻ mã này với bất kỳ ai.`
    });
  } catch {
    throw new HttpError(503, "Không thể gửi email OTP. Vui lòng kiểm tra cấu hình SMTP và thử lại.");
  }
}

export const emailService = { sendRegistrationOtp: (email: string, otp: string) => sendOtp(email, otp, "registration"), sendPasswordResetOtp: (email: string, otp: string) => sendOtp(email, otp, "password reset") };
