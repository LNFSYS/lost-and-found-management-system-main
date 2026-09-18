export type ClaimStatus = "PENDING" | "CONVERSATION_OPEN" | "NEED_MORE_INFO" | "ACCEPTED" | "REJECTED" | "CANCELLED";

export type FinderDecision = "PENDING" | "ACCEPTED" | "DECLINED";

export type ParticipantRole = "CLAIMANT" | "FINDER";

export type ConsentStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export const roomStatuses: ClaimStatus[] = ["CONVERSATION_OPEN", "NEED_MORE_INFO", "ACCEPTED", "REJECTED"];

export const verificationDecisionStatuses: ClaimStatus[] = ["CONVERSATION_OPEN", "NEED_MORE_INFO"];

export function canUseRoom(status: ClaimStatus, consentStatus: ConsentStatus | undefined) {
  return roomStatuses.includes(status) && consentStatus === "ACCEPTED";
}

export function canSubmitVerificationDecision(status: ClaimStatus) {
  return verificationDecisionStatuses.includes(status);
}

export function isAppointmentEligible(status: ClaimStatus) {
  return status === "ACCEPTED";
}
