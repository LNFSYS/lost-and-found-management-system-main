import type { CookieOptions } from "express";
import { env } from "../config/env.js";

export const refreshCookieName = "lnfs_refresh";

export function refreshCookieOptions(expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax",
    path: "/api/auth",
    ...(expiresAt ? { expires: expiresAt } : {})
  };
}
