export type CustodyRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "INTAKED";
export type CustodyIntakeType = "CUSTODY_TRANSFER" | "WALK_IN";

export const custodyRequestStatusLabels: Record<CustodyRequestStatus, string> = {
  PENDING: "Chờ duyệt",
  ACCEPTED: "Đã duyệt – chờ bàn giao",
  REJECTED: "Từ chối",
  CANCELLED: "Đã hủy",
  INTAKED: "Đã tiếp nhận"
};

export const custodyIntakeTypeLabels: Record<CustodyIntakeType, string> = {
  CUSTODY_TRANSFER: "Chuyển giao từ claim",
  WALK_IN: "Tiếp nhận trực tiếp"
};

/**
 * Valid custody request state transitions.
 *
 * PENDING  → ACCEPTED | REJECTED | CANCELLED
 * ACCEPTED → INTAKED  | CANCELLED
 *
 * PENDING → INTAKED is explicitly forbidden (must go through ACCEPTED).
 * Terminal states (REJECTED, CANCELLED, INTAKED) have no outgoing transitions.
 */
export const custodyTransitionMap: Record<CustodyRequestStatus, CustodyRequestStatus[]> = {
  PENDING: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["INTAKED", "CANCELLED"],
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
