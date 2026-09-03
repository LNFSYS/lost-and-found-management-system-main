import type { Express } from "express";
import { HttpError } from "./http-error.js";

export const mediaPolicy = {
  maxBytes: 10 * 1024 * 1024,
  maxPerPost: 5,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const
};

export const avatarMediaPolicy = {
  maxBytes: 1 * 1024 * 1024,
  allowedMimeTypes: mediaPolicy.allowedMimeTypes
};

export type ImageFormat = "jpg" | "png" | "webp";

export interface ValidatedImage {
  mimeType: (typeof mediaPolicy.allowedMimeTypes)[number];
  format: ImageFormat;
  extension: ImageFormat;
  bytes: number;
}

function startsWith(buffer: Buffer, signature: number[]) {
  return signature.every((byte, index) => buffer[index] === byte);
}

export function detectImageFormat(buffer: Buffer): ImageFormat | null {
  if (buffer.length >= 3 && startsWith(buffer, [0xff, 0xd8, 0xff])) return "jpg";
  if (buffer.length >= 8 && startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export function validateImageUpload(file: Express.Multer.File): ValidatedImage {
  if (!file?.buffer?.length) throw new HttpError(400, "File anh khong hop le");
  if (file.size > mediaPolicy.maxBytes) throw new HttpError(413, "Anh vuot qua gioi han 10MB");
  if (!mediaPolicy.allowedMimeTypes.includes(file.mimetype as ValidatedImage["mimeType"])) {
    throw new HttpError(415, "Chi ho tro anh JPEG, PNG hoac WEBP");
  }

  const format = detectImageFormat(file.buffer);
  const expectedByMime: Record<ValidatedImage["mimeType"], ImageFormat> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  if (!format || format !== expectedByMime[file.mimetype as ValidatedImage["mimeType"]]) {
    throw new HttpError(415, "Chu ky file khong khop dinh dang anh");
  }

  return {
    mimeType: file.mimetype as ValidatedImage["mimeType"],
    format,
    extension: format,
    bytes: file.size
  };
}

export function validateAvatarUpload(file: Express.Multer.File): ValidatedImage {
  const image = validateImageUpload(file);
  if (image.bytes > avatarMediaPolicy.maxBytes) throw new HttpError(413, "Anh dai dien vuot qua gioi han 1MB");
  return image;
}

export function mediaContentType(format: ImageFormat) {
  if (format === "jpg") return "image/jpeg";
  if (format === "png") return "image/png";
  return "image/webp";
}
