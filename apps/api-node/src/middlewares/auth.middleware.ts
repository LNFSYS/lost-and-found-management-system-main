import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { authService } from "../services/auth.service.js";
import type { AccessTokenPayload, Role } from "../types/auth.js";
import { HttpError } from "../utils/http-error.js";

declare global {
  namespace Express {
    interface Request { auth?: AccessTokenPayload; }
  }
}

export async function requireAuth(request: Request, _response: Response, next: NextFunction) {
  const value = request.header("authorization");
  const token = value?.startsWith("Bearer ") ? value.slice(7) : undefined;
  if (!token) return next(new HttpError(401, "Bạn cần đăng nhập để tiếp tục"));
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
    if (!await authService.validateAccessSession(payload)) return next(new HttpError(401, "Phiên đăng nhập đã hết hạn"));
    request.auth = payload;
    next();
  } catch {
    next(new HttpError(401, "Phiên đăng nhập đã hết hạn"));
  }
}

export function requireAnyRole(...roles: Role[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.auth?.roles.some((role) => roles.includes(role))) return next(new HttpError(403, "Bạn không có quyền thực hiện thao tác này"));
    next();
  };
}
