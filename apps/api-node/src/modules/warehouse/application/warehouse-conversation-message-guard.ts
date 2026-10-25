import { AppError } from "../../../shared/domain/app-error.js";
import type { WarehouseConversationMessage } from "./warehouse.dto.js";

const asciiProfanity = new Set(["dm", "dcm", "djt", "duma", "clm", "dit", "vcl", "fuck", "fucking", "shit", "bitch", "asshole", "motherfucker"]);
const accentedProfanity = new Set(["đm", "đcm", "địt", "đụ", "lồn", "cặc", "đéo"]);

export function assertNoProfanity(messages: WarehouseConversationMessage[]) {
  const containsProfanity = (value: string) => (value.normalize("NFC").toLocaleLowerCase("vi").match(/[\p{L}\p{M}\d]+/gu) ?? [])
    .some(token => asciiProfanity.has(token) || accentedProfanity.has(token));
  if (messages.some(message => message.role === "user" && containsProfanity(message.content))) {
    throw new AppError("bad_request", "Tin nhắn có ngôn từ không phù hợp nên chưa được ghi nhận. Vui lòng nhập lại nội dung lịch sự.");
  }
}
