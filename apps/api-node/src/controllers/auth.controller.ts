import type { Request, Response } from "express";
import { ZodError } from "zod";
import { authService } from "../services/auth.service.js";
import { HttpError } from "../utils/http-error.js";
import { forgotPasswordSchema, loginSchema, registerSchema, requestOtpSchema, resetPasswordSchema, updateProfileSchema } from "../validators/auth.validator.js";

const refreshCookie = "lnfs_refresh";

function meta(request: Request) { return { userAgent: request.header("user-agent") ?? undefined, ipAddress: request.ip }; }
function setRefreshCookie(response: Response, token: string, expiresAt: Date) {
  response.cookie(refreshCookie, token, { httpOnly: true, secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production", sameSite: "lax", expires: expiresAt, path: "/api/auth" });
}
function clearRefreshCookie(response: Response) { response.clearCookie(refreshCookie, { httpOnly: true, sameSite: "lax", path: "/api/auth" }); }
function toClientSession(result: Awaited<ReturnType<typeof authService.login>>) { return { user: result.user, accessToken: result.accessToken, accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m" }; }

export const authController = {
  async requestRegistrationOtp(request: Request, response: Response) {
    response.status(200).json(await authService.requestRegistrationOtp(requestOtpSchema.parse(request.body)));
  },
  async register(request: Request, response: Response) {
    const result = await authService.register(registerSchema.parse(request.body), meta(request));
    setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
    response.status(201).json(toClientSession(result));
  },
  async login(request: Request, response: Response) {
    const result = await authService.login(loginSchema.parse(request.body), meta(request));
    setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
    response.json(toClientSession(result));
  },
  async refresh(request: Request, response: Response) {
    const result = await authService.refresh(request.cookies?.[refreshCookie], meta(request));
    setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
    response.json(toClientSession(result));
  },
  async logout(request: Request, response: Response) {
    await authService.logout(request.cookies?.[refreshCookie]);
    clearRefreshCookie(response);
    response.status(204).send();
  },
  async forgotPassword(request: Request, response: Response) {
    await authService.requestPasswordReset(forgotPasswordSchema.parse(request.body));
    response.json({ delivered: true, message: "Nếu email tồn tại, mã đặt lại mật khẩu đã được gửi." });
  },
  async resetPassword(request: Request, response: Response) {
    await authService.resetPassword(resetPasswordSchema.parse(request.body));
    clearRefreshCookie(response);
    response.json({ reset: true });
  },
  async me(request: Request, response: Response) {
    response.json({ user: await authService.getCurrentUser(request.auth!.sub) });
  },
  async updateProfile(request: Request, response: Response) {
    response.json({ user: await authService.updateProfile(request.auth!.sub, updateProfileSchema.parse(request.body)) });
  }
};

export function errorHandler(error: unknown, _request: Request, response: Response, _next: unknown) {
  if (error instanceof ZodError) return response.status(422).json({ message: "Dữ liệu nhập chưa hợp lệ", errors: error.flatten().fieldErrors });
  if (error instanceof HttpError) return response.status(error.status).json({ message: error.message });
  console.error("Unhandled API error", error instanceof Error ? error.message : "unknown error");
  return response.status(500).json({ message: "Máy chủ gặp lỗi, vui lòng thử lại." });
}
