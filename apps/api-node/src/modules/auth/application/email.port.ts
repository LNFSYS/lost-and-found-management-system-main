export interface EmailDelivery {
  sendRegistrationOtp(email: string, otp: string): Promise<void>;
  sendPasswordResetOtp(email: string, otp: string): Promise<void>;
}
