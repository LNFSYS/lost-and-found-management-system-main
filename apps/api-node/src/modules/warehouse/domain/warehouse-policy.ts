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
  const compact = text.replace(/\s+/g, "");
  return keywords.some((keyword) => text.includes(keyword) || compact.includes(keyword.replace(/\s+/g, "")));
}

export function retentionConfigKeyForCategory(category: { name: string; parentName?: string | null; } | null): keyof typeof retentionFallbacks {
  if (!category) return "warehouse.retention_days_default";
  const text = normalizeVietnameseText(`${category.parentName ?? ""} ${category.name}`);
  if (includesKeyword(text, ["giay to", "the", "card", "document", "student id", "cccd", "cmnd", "passport", "bang lai"])) {
    return "warehouse.retention_days_document";
  }
  if (includesKeyword(text, ["dien tu", "dien thoai", "phone", "laptop", "tablet", "may tinh", "computer", "tai nghe", "headphone", "sac", "charger"])) {
    return "warehouse.retention_days_electronic";
  }
  if (includesKeyword(text, ["do an", "thuc pham", "food", "drink", "nuoc", "my pham", "ve sinh", "hygiene"])) {
    return "warehouse.retention_days_perishable";
  }
  return "warehouse.retention_days_default";
}

export function calculateRetentionDeadline(receivedAt: Date, retentionDays: number) {
  const deadline = new Date(receivedAt);
  deadline.setUTCDate(deadline.getUTCDate() + retentionDays);
  return deadline;
}

export function canTransitionWarehouseStatus(from: WarehouseStatus, to: WarehouseStatus) {
  return transitionMap[from].includes(to);
}
