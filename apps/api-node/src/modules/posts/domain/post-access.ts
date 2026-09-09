import type { AccessTokenPayload } from "../../../shared/domain/auth.js";

export interface PostReadScope {
  allPrivate: boolean;
  privateOwnerId?: string;
}

export function canReview(viewer?: AccessTokenPayload) {
  return Boolean(viewer?.roles.some(role => role === "STAFF" || role === "ADMIN"));
}

export function postReadScope(viewer?: AccessTokenPayload): PostReadScope {
  return { allPrivate: canReview(viewer), privateOwnerId: viewer?.sub };
}
