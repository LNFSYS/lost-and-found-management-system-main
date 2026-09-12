import type { AccessTokenPayload, User } from "../../../shared/domain/auth.js";

export function isAccessSessionValid(user: (User & { sessionVersion: number; }) | null, payload: AccessTokenPayload) {
  return Boolean(user && user.status === "ACTIVE" && user.sessionVersion === payload.sessionVersion);
}

export function isUsable(row: { consumed_at: Date | null; expires_at: Date; attempt_count: number; max_attempts: number; }) {
  return !row.consumed_at && row.expires_at.getTime() > Date.now() && row.attempt_count < row.max_attempts;
}
