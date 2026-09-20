import type { CookieOptions } from "express";

export const refreshCookieName = "lnfs_refresh";

export function refreshCookieOptions(secure: boolean, expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/auth",
    ...(expiresAt ? { expires: expiresAt } : {})
  };
}
