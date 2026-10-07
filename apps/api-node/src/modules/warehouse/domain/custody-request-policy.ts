export type CustodyRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "INTAKED";
export type CustodyIntakeType = "CUSTODY_TRANSFER" | "WALK_IN";

export const custodyRequestStatusLabels: Record<CustodyRequestStatus, string> = {
  PENDING: "Chờ tiếp nhận",
  ACCEPTED: "Chờ tiếp nhận (yêu cầu cũ)",
  REJECTED: "Từ chối",
  CANCELLED: "Đã hủy",
  INTAKED: "Đã tiếp nhận"
};

export const custodyIntakeTypeLabels: Record<CustodyIntakeType, string> = {
  CUSTODY_TRANSFER: "Chuyển giao từ claim",
  WALK_IN: "Tiếp nhận trực tiếp"
};

// ACCEPTED is retained for historical clients; physical receipt needs no pre-approval.
export const custodyTransitionMap: Record<CustodyRequestStatus, CustodyRequestStatus[]> = {
  PENDING: ["ACCEPTED", "INTAKED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["INTAKED", "REJECTED", "CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
  INTAKED: []
};

export function canTransitionCustodyStatus(from: CustodyRequestStatus, to: CustodyRequestStatus): boolean {
  return custodyTransitionMap[from].includes(to);
}

export function isCustodyTerminal(status: CustodyRequestStatus): boolean {
  return custodyTransitionMap[status].length === 0;
}
