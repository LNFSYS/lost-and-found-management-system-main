export type RequestOtpInput = { email: string; };

export type RegisterInput = { email: string; password: string; fullName: string; audienceRole: "STUDENT" | "LECTURER"; otp: string; studentCode?: string | undefined; phoneNumber?: string | undefined; };

export type LoginInput = { email: string; password: string; };

export type ForgotPasswordInput = { email: string; };

export type ResetPasswordInput = { email: string; token: string; newPassword: string; };

export type UpdateProfileInput = { fullName?: string | undefined; studentCode?: string | null | undefined; phoneNumber?: string | null | undefined; };
