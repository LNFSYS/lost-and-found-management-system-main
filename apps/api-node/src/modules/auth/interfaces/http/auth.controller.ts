import type { CookieOptions, Request, Response } from "express";
import { refreshCookieName } from "../../../../shared/interfaces/http/auth-cookie.js";
import { HttpError } from "../../../../shared/interfaces/http/http-error.js";
import type { AuthUseCases } from "../../application/auth.use-cases.js";
import { forgotPasswordSchema, loginSchema, registerSchema, requestOtpSchema, resetPasswordSchema, updateProfileSchema } from "./auth.validator.js";

export function createAuthController({ authService, refreshCookieOptions, accessTokenExpiresIn }: {
  authService: AuthUseCases;
  refreshCookieOptions: (expiresAt?: Date) => CookieOptions;
  accessTokenExpiresIn: string;
}) {
  function meta(request: Request) { return { userAgent: request.header("user-agent") ?? undefined, ipAddress: request.ip }; }
  function setRefreshCookie(response: Response, token: string, expiresAt: Date) {
    response.cookie(refreshCookieName, token, refreshCookieOptions(expiresAt));
  }
  function clearRefreshCookie(response: Response) { response.clearCookie(refreshCookieName, refreshCookieOptions()); }
  function toClientSession(result: Awaited<ReturnType<typeof authService.login>>) { return { user: result.user, accessToken: result.accessToken, accessTokenExpiresIn: accessTokenExpiresIn }; }
  const authController = {
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
      const result = await authService.refresh(request.cookies?.[refreshCookieName], meta(request));
      setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
      response.json(toClientSession(result));
    },
    async logout(request: Request, response: Response) {
      await authService.logout(request.cookies?.[refreshCookieName]);
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
    },
    async updateAvatar(request: Request, response: Response) {
      if (!request.file) throw new HttpError(400, "Can gui anh dai dien voi field name la file");
      response.status(201).json({ user: await authService.updateAvatar(request.auth!.sub, request.file) });
    },
    async getAvatar(request: Request, response: Response) {
      const avatar = await authService.getAvatarFile(request.auth!.sub);
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      if (avatar.updatedAt) response.setHeader("Last-Modified", new Date(avatar.updatedAt).toUTCString());
      response.type(avatar.contentType).send(avatar.body);
    },
    async activity(request: Request, response: Response) {
      response.json(await authService.getActivitySummary(request.auth!.sub));
    }
  };
  return authController;
}
export type AuthController = ReturnType<typeof createAuthController>;
