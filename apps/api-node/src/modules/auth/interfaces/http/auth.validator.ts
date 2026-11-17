import { z } from "zod";

const email = z.string().trim().email().max(255);
const weakPasswords = new Set(["12345678", "123456789", "87654321", "abcdefgh", "00000000"]);
const password = z
  .string()
  .min(8, "Mật khẩu tối thiểu 8 ký tự")
  .max(72)
  .refine((val) => /[A-Za-z]/.test(val) && /[\d\W_]/.test(val), "Mật khẩu phải chứa ít nhất một chữ cái và một chữ số hoặc ký tự đặc biệt")
  .refine((val) => !weakPasswords.has(val.toLowerCase()), "Mật khẩu quá đơn giản, vui lòng chọn mật khẩu khác");
const otp = z.string().trim().regex(/^\d{6}$/, "OTP gồm 6 chữ số");

export const requestOtpSchema = z.object({ email });
export const registerSchema = z.object({
  email,
  otp,
  password,
  fullName: z.string().trim().min(2).max(160),
  audienceRole: z.enum(["STUDENT", "LECTURER"]).default("STUDENT"),
  studentCode: z.string().trim().max(40).optional(),
  phoneNumber: z.string().trim().max(30).optional()
});
export const loginSchema = z.object({ email, password: z.string().min(1).max(72) });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({ email, token: otp, newPassword: password });
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(160).optional(),
  studentCode: z.string().trim().max(40).nullable().optional(),
  phoneNumber: z.string().trim().max(30).nullable().optional()
}).refine((value) => Object.keys(value).length > 0, "Cần ít nhất một trường để cập nhật");

export type { ForgotPasswordInput, LoginInput, RegisterInput, RequestOtpInput, ResetPasswordInput, UpdateProfileInput } from "../../application/auth.dto.js";
