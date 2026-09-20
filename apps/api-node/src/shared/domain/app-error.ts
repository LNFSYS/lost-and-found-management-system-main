export type AppErrorCode =
  | "bad_request" | "unauthenticated" | "forbidden" | "not_found"
  | "conflict" | "payload_too_large" | "unsupported_media" | "invalid_input" | "rate_limited"
  | "internal" | "upstream_failure" | "unavailable" | "upstream_timeout";

export class AppError extends Error {
  constructor(public readonly code: AppErrorCode, message: string) {
    super(message);
    this.name = "AppError";
  }
}
