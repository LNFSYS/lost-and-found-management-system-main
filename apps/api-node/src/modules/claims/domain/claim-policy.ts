export type ClaimStatus = "PENDING" | "CONVERSATION_OPEN" | "NEED_MORE_INFO" | "ACCEPTED" | "REJECTED" | "CANCELLED";

export type FinderDecision = "PENDING" | "ACCEPTED" | "DECLINED";

export type ParticipantRole = "CLAIMANT" | "FINDER";

export type ConsentStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export const roomStatuses: ClaimStatus[] = ["CONVERSATION_OPEN", "NEED_MORE_INFO", "ACCEPTED"];

export function canUseRoom(status: ClaimStatus, consentStatus: ConsentStatus | undefined) {
  return roomStatuses.includes(status) && consentStatus === "ACCEPTED";
}
