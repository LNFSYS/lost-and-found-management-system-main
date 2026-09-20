import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";

export function id() {
  return randomUUID();
}

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomOtp() {
  return randomInt(100000, 1_000_000).toString();
}

export function randomToken() {
  return randomBytes(48).toString("base64url");
}

export { normalizeEmail } from "../domain/text.js";
