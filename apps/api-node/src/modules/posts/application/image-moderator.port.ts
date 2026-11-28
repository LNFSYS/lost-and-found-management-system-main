import type { ImageUpload } from "../../../shared/domain/upload.js";

export interface ImageModerator {
  /** Must throw on blocked, uncertain, or unavailable checks. */
  assertAllowed(files: ImageUpload[], signal?: AbortSignal): Promise<void | { sensitiveDocument: boolean }>;
}
