export type NotificationEmailDeliveryState = "NOT_SENT" | "UNKNOWN";

export class NotificationEmailDeliveryError extends Error {
  constructor(
    message: string,
    readonly deliveryState: NotificationEmailDeliveryState,
    readonly providerCode?: string
  ) {
    super(message);
    this.name = "NotificationEmailDeliveryError";
  }
}

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
