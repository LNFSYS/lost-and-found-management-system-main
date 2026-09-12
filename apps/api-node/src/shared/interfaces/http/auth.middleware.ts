import type { NextFunction, Request, Response } from "express";

import type { AccessTokenPayload, Role } from "../../domain/auth.js";

import { HttpError } from "./http-error.js";

declare global {
  namespace Express {
    interface Request { auth?: AccessTokenPayload; }
  }
}

export function createAuthMiddleware({ authService, verifyAccessToken }: { authService: { validateAccessSession(payload: AccessTokenPayload): Promise<boolean>; }; verifyAccessToken: (token: string) => AccessTokenPayload; }) {

  async function requireAuth(request: Request, _response: Response, next: NextFunction) {
    const value = request.header("authorization");
    const token = value?.startsWith("Bearer ") ? value.slice(7) : undefined;
    if (!token) return next(new HttpError(401, "Bạn cần đăng nhập để tiếp tục"));
    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token) as AccessTokenPayload;
    } catch {
      next(new HttpError(401, "Phiên đăng nhập đã hết hạn"));
      return;
    }
    try {
      if (!await authService.validateAccessSession(payload)) return next(new HttpError(401, "Phiên đăng nhập đã hết hạn"));
      request.auth = payload;
      next();
    } catch (error) {
      next(error);
    }
  }

  async function optionalAuth(request: Request, _response: Response, next: NextFunction) {
    const value = request.header("authorization");
    if (!value) return next();
    const token = value.startsWith("Bearer ") ? value.slice(7) : undefined;
    if (!token) return next(new HttpError(401, "Phien dang nhap khong hop le"));
    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token) as AccessTokenPayload;
    } catch {
      next(new HttpError(401, "Phien dang nhap da het han"));
      return;
    }
    try {
      if (!await authService.validateAccessSession(payload)) return next(new HttpError(401, "Phien dang nhap da het han"));
      request.auth = payload;
      next();
    } catch (error) {
      next(error);
    }
  }

  function requireAnyRole(...roles: Role[]) {
    return (request: Request, _response: Response, next: NextFunction) => {
      if (!request.auth?.roles.some((role) => roles.includes(role))) return next(new HttpError(403, "Bạn không có quyền thực hiện thao tác này"));
      next();
    };
  }

  return { requireAuth, optionalAuth, requireAnyRole };

}

export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;
