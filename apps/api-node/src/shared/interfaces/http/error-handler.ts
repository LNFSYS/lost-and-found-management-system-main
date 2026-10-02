import type { Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, type AppErrorCode } from "../../domain/app-error.js";
import { HttpError } from "./http-error.js";

export const applicationErrorStatus: Record<AppErrorCode, number> = {
  bad_request: 400, unauthenticated: 401, forbidden: 403, not_found: 404,
  conflict: 409, payload_too_large: 413, unsupported_media: 415,
  invalid_input: 422, rate_limited: 429, internal: 500,
  upstream_failure: 502, unavailable: 503, upstream_timeout: 504
};

export function errorHandler(error: unknown, _request: Request, response: Response, _next: unknown) {
  const parserError = error as SyntaxError & { type?: string; status?: number; };
  if (error instanceof SyntaxError && parserError.type === "entity.parse.failed") {
    return response.status(400).json({ message: "Nội dung JSON không hợp lệ" });
  }
  if (parserError.type === "entity.too.large" || parserError.status === 413 || (error instanceof AppError && error.code === "payload_too_large")) {
    return response.status(413).json({ code: "PAYLOAD_TOO_LARGE", message: "Nội dung gửi lên vượt quá giới hạn cho phép" });
  }
  if (error instanceof ZodError) return response.status(422).json({ message: "Dữ liệu nhập chưa hợp lệ", errors: error.flatten().fieldErrors });
  if (error instanceof HttpError) return response.status(error.status).json({ message: error.message });
  if (error instanceof AppError) return response.status(applicationErrorStatus[error.code]).json({ message: error.message });
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown; }).code ?? "")
    : "";
  if (code === "ER_DUP_ENTRY") return response.status(409).json({ message: "Dữ liệu đã tồn tại" });
  if (["ER_ROW_IS_REFERENCED_2", "ER_ROW_IS_REFERENCED", "ER_NO_REFERENCED_ROW_2", "ER_NO_REFERENCED_ROW"].includes(code)) {
    return response.status(409).json({ message: "Dữ liệu đang được sử dụng hoặc liên kết không hợp lệ" });
  }
  const errorMessage = error instanceof Error ? error.message : "";
  if (["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST", "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR"].includes(code)
    || /connection is in closed state|connection lost|closed state/i.test(errorMessage)) {
    console.error("Database connection unavailable", { code: code || undefined, message: errorMessage });
    return response.status(503).json({ message: "Kết nối cơ sở dữ liệu tạm thời gián đoạn, vui lòng thử lại." });
  }
  const databaseError = typeof error === "object" && error !== null
    ? {
        errno: "errno" in error ? Number((error as { errno?: unknown }).errno) || undefined : undefined,
        sqlState: "sqlState" in error ? String((error as { sqlState?: unknown }).sqlState ?? "") || undefined : undefined
      }
    : {};
  const missingField = errorMessage.match(/Field '([^']+)' doesn't have a default value/i)?.[1];
  console.error("Unhandled API error", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    code: code || undefined,
    missingField,
    ...databaseError
  });
  return response.status(500).json({ message: "Máy chủ gặp lỗi, vui lòng thử lại." });
}
