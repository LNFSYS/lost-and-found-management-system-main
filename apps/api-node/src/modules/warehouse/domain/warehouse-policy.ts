import { normalizeVietnameseText } from "../../../shared/domain/text.js";

export type WarehouseStatus =
  | "EXPIRED"
  | "PENDING_APPROVAL"
  | "RECEIVED"
  | "STORED"
  | "CLAIMED"
  | "RETURNED"
  | "DISPOSED"
  | "DONATED"
  | "TRANSFERRED";

export type CustodyRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED"
  | "INTAKED";

export type CustodyReason =
  | "INACTIVITY"
  | "SAFETY_CONCERN"
  | "DISPUTE"
  | "SENSITIVE_ITEM"
  | "VOLUNTARY";

export type DispositionType = "DISPOSAL" | "DONATION" | "TRANSFER";

export type DispositionOrderStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export const retentionFallbacks = {
  "warehouse.retention_days_default": 60,
  "warehouse.retention_days_document": 120,
  "warehouse.retention_days_electronic": 90,
  "warehouse.retention_days_perishable": 3,
  "warehouse.disposition_grace_days": 7
} as const;

export const transitionMap: Record<WarehouseStatus, WarehouseStatus[]> = {
  PENDING_APPROVAL: ["RECEIVED", "DISPOSED"],
  RECEIVED: ["STORED", "CLAIMED", "RETURNED", "EXPIRED"],
  STORED: ["CLAIMED", "RETURNED", "EXPIRED"],
  CLAIMED: ["STORED", "RETURNED"],
  RETURNED: [],
  EXPIRED: ["RETURNED"], // DISPOSED, DONATED, TRANSFERRED are strictly guarded via Disposition Orders
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
  DISPOSED: "Đã xử lý tiêu hủy",
  DONATED: "Đã quyên góp",
  TRANSFERRED: "Đã chuyển giao"
};

export const custodyReasonLabels: Record<CustodyReason, string> = {
  INACTIVITY: "Không hoạt động quá lâu",
  SAFETY_CONCERN: "Có vấn đề an toàn / nghi ngờ lừa đảo",
  DISPUTE: "Có tranh chấp giữa các bên",
  SENSITIVE_ITEM: "Đồ vật giá trị cao / nhạy cảm",
  VOLUNTARY: "Finder tự nguyện chuyển giao cho trường"
};

export const custodyStatusLabels: Record<CustodyRequestStatus, string> = {
  PENDING: "Chờ Staff tiếp nhận",
  ACCEPTED: "Staff đã đồng ý tiếp nhận",
  REJECTED: "Staff từ chối tiếp nhận",
  CANCELLED: "Đã hủy yêu cầu",
  INTAKED: "Đã nhập kho thành công"
};

export const dispositionTypeLabels: Record<DispositionType, string> = {
  DISPOSAL: "Tiêu hủy vật phẩm",
  DONATION: "Quyên góp từ thiện",
  TRANSFER: "Chuyển giao cơ quan chức năng"
};

export const dispositionOrderStatusLabels: Record<DispositionOrderStatus, string> = {
  PENDING_APPROVAL: "Chờ Admin phê duyệt",
  APPROVED: "Đã duyệt - Chờ Staff xử lý",
  REJECTED: "Admin từ chối",
  CANCELLED: "Đã hủy lệnh",
  COMPLETED: "Đã hoàn tất xử lý"
};

export function includesKeyword(text: string, keywords: string[]) {
  const compact = text.replace(/\s+/g, "");
  return keywords.some((keyword) => text.includes(keyword) || compact.includes(keyword.replace(/\s+/g, "")));
}

export function retentionConfigKeyForCategory(category: { name: string; parentName?: string | null } | null): keyof typeof retentionFallbacks {
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

export function isItemOverdue(retentionDeadline: Date | null | undefined): boolean {
  if (!retentionDeadline) return false;
  return new Date(retentionDeadline).getTime() < Date.now();
}

export function canTransitionWarehouseStatus(from: WarehouseStatus, to: WarehouseStatus) {
  return transitionMap[from]?.includes(to) ?? false;
}

export function checkDispositionEligibility(item: {
  status: WarehouseStatus;
  retentionDeadline: Date | null;
  legalHoldCount: number;
  dispositionOrderId?: string | null;
  activeClaimsCount?: number;
}): { eligible: boolean; blockers: string[] } {
  const blockers: string[] = [];

  if (item.legalHoldCount > 0) {
    blockers.push("Vật phẩm đang có lệnh Tạm giữ pháp lý (Legal Hold)");
  }
  if (!item.retentionDeadline || !isItemOverdue(item.retentionDeadline)) {
    blockers.push("Vật phẩm chưa hết hạn thời gian lưu kho (Retention Period)");
  }
  if (item.status === "RETURNED" || item.status === "DISPOSED" || item.status === "DONATED" || item.status === "TRANSFERRED") {
    blockers.push(`Vật phẩm đã ở trạng thái kết thúc (${warehouseStatusLabels[item.status]})`);
  }
  if (item.dispositionOrderId) {
    blockers.push("Vật phẩm đã được gán vào một lệnh xử lý kho khác");
  }
  if ((item.activeClaimsCount ?? 0) > 0) {
    blockers.push("Vật phẩm đang có Claim của người nhận đang chờ giải quyết");
  }

  return {
    eligible: blockers.length === 0,
    blockers
  };
}
