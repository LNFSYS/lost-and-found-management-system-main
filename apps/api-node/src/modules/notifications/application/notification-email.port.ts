/** Delivers only redacted, optional notification emails. Security OTP mail stays in Auth. */
export interface NotificationEmailDelivery {
  send(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
    idempotencyKey: string;
  }): Promise<{ providerMessageId?: string | null; }>;
}
