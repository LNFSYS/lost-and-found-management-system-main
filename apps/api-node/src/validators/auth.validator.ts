import { z } from "zod";

const email = z.string().trim().email().max(255);
const password = z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(72);
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

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
