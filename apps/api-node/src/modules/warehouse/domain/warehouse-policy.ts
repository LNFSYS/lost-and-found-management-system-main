import { normalizeVietnameseText } from "../../../shared/domain/text.js";
export type WarehouseStatus = "EXPIRED" | "PENDING_APPROVAL" | "RECEIVED" | "STORED" | "CLAIMED" | "RETURNED" | "DISPOSED" | "DONATED" | "TRANSFERRED";

export const retentionFallbacks = {
  "warehouse.retention_days_default": 60,
  "warehouse.retention_days_document": 120,
  "warehouse.retention_days_electronic": 90,
  "warehouse.retention_days_perishable": 3
} as const;

export const transitionMap: Record<WarehouseStatus, WarehouseStatus[]> = {
  PENDING_APPROVAL: ["RECEIVED", "DISPOSED"],
  RECEIVED: ["STORED", "CLAIMED", "RETURNED", "EXPIRED", "DISPOSED"],
  STORED: ["CLAIMED", "RETURNED", "EXPIRED"],
  CLAIMED: ["STORED", "RETURNED"],
  RETURNED: [],
  EXPIRED: ["RETURNED", "DISPOSED", "DONATED", "TRANSFERRED"],
  DISPOSED: [],
  DONATED: [],
  TRANSFERRED: []
};

export const warehouseStatusLabels: Record<WarehouseStatus, string> = {
  PENDING_APPROVAL: "Chờ duyệt",
  RECEIVED: "Đã tiếp nhận",
  STORED: "Đang lưu kho",
  CLAIMED: "Đang đợi nhận",
  RETURNED: "Đã trả",
  EXPIRED: "Quá hạn",
  DISPOSED: "Đã xử lý",
  DONATED: "Đã quyên góp",
  TRANSFERRED: "Đã chuyển giao"
};

export function includesKeyword(text: string, keywords: string[]) {
  const words = ` ${text.replace(/[^a-z0-9]+/g, " ").trim()} `;
  return keywords.some((keyword) => words.includes(` ${keyword} `));
}

export function retentionConfigKeyForCategory(category: { name: string; parentName?: string | null; } | null): keyof typeof retentionFallbacks {
  if (!category) return "warehouse.retention_days_default";
  const text = normalizeVietnameseText(`${category.parentName ?? ""} ${category.name}`);
  if (includesKeyword(text, ["giay to", "the sinh vien", "the", "card", "document", "student id", "cccd", "cmnd", "passport", "bang lai", "chia khoa", "key", "keys", "giay to xe"])) {
    return "warehouse.retention_days_document";
  }
  if (includesKeyword(text, ["dien tu", "dien thoai", "phone", "laptop", "tablet", "may tinh", "computer", "tai nghe", "headphone", "sac", "charger"])) {
    return "warehouse.retention_days_electronic";
  }
  if (includesKeyword(text, ["do an", "thuc pham", "food", "drink", "nuoc uong", "do uong", "de hong", "perishable"])) {
    return "warehouse.retention_days_perishable";
  }
  return "warehouse.retention_days_default";
}

export function calculateRetentionDeadline(receivedAt: Date, retentionDays: number) {
  if (!Number.isFinite(receivedAt.getTime()) || !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
    throw new Error("Invalid retention policy");
  }
  const deadline = new Date(receivedAt);
  deadline.setUTCDate(deadline.getUTCDate() + retentionDays);
  return deadline;
}

export function canTransitionWarehouseStatus(from: WarehouseStatus, to: WarehouseStatus) {
  return transitionMap[from].includes(to);
}
