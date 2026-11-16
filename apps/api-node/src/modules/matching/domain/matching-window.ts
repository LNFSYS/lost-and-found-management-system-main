import { normalizeVietnameseText } from "../../../shared/domain/text.js";

export const MATCHING_WINDOW_DAYS = {
  S0_STANDARD: 90,
  S1_S2_SENSITIVE: 180
} as const;

export type SensitivityLevel = "S0" | "S1_S2";

const SENSITIVE_KEYWORDS = [
  "cccd",
  "can cuoc",
  "cmnd",
  "chung minh nhan dan",
  "the sv",
  "the sinh vien",
  "the hoc vien",
  "mssv",
  "bang lai",
  "giay phep lai xe",
  "gplx",
  "ca vet",
  "cavet",
  "dang ky xe",
  "giay to xe",
  "ho chieu",
  "passport",
  "the ngan hang",
  "the atm",
  "atm",
  "visa",
  "mastercard",
  "the tin dung",
  "the ghi no",
  "laptop",
  "may tinh xach tay",
  "macbook",
  "thinkpad",
  "dien thoai",
  "smartphone",
  "iphone",
  "samsung",
  "xiaomi",
  "oppo",
  "vi tien",
  "bop tien",
  "bop vi",
  "may tinh bang",
  "ipad",
  "tablet",
  "usb",
  "o cung",
  "token"
];

// Special short words that require exact boundary matching to avoid false positives (e.g., "vi" in "vi trí")
const BOUNDARY_SENSITIVE_WORDS = ["vi", "bop", "the"];

export function classifySensitivityLevel(source: {
  title?: string | null;
  text?: string | null;
  description?: string | null;
  categoryName?: string | null;
  imageText?: string | null;
  ocrText?: string | null;
}): SensitivityLevel {
  const combined = [
    source.title ?? "",
    source.text ?? "",
    source.description ?? "",
    source.categoryName ?? "",
    source.imageText ?? "",
    source.ocrText ?? ""
  ].join(" ");

  const normalized = normalizeVietnameseText(combined);

  for (const keyword of SENSITIVE_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return "S1_S2";
    }
  }

  const words = normalized.split(/\s+/);
  for (const boundaryWord of BOUNDARY_SENSITIVE_WORDS) {
    if (words.includes(boundaryWord)) {
      return "S1_S2";
    }
  }

  return "S0";
}

export function resolveSensitivityMatchingWindow(source: {
  title?: string | null;
  text?: string | null;
  description?: string | null;
  categoryName?: string | null;
  imageText?: string | null;
  ocrText?: string | null;
}): number {
  const level = classifySensitivityLevel(source);
  return level === "S1_S2" ? MATCHING_WINDOW_DAYS.S1_S2_SENSITIVE : MATCHING_WINDOW_DAYS.S0_STANDARD;
}
