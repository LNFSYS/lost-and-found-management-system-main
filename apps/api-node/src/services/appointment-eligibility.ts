import { HttpError } from "../utils/http-error.js";

export interface AppointmentEligibilityInput {
  claimStatus: string;
  latestDecisionAction?: string | null;
}

export function isAppointmentEligible(input: AppointmentEligibilityInput) {
  return input.claimStatus === "ACCEPTED" && input.latestDecisionAction === "FINDER_VERIFIED_FOR_MEETUP";
}

export function requireAppointmentEligible(input: AppointmentEligibilityInput) {
  if (!isAppointmentEligible(input)) {
    throw new HttpError(409, "Claim chưa được Finder xác minh để hẹn gặp");
  }
}
