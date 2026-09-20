export type CreateClaimInput = {
  postId?: string | undefined;
  lostPostId?: string | undefined;
  foundPostId?: string | undefined;
  description?: string | undefined;
  approximateLostAt?: Date | undefined;
  approximateLocation?: string | undefined;
  requestKey?: string | undefined;
};

export type ClaimDecisionInput = {
  decision: "ACCEPT" | "DECLINE" | "REQUEST_MORE_INFO";
  note?: string | undefined;
  idempotencyKey?: string | undefined;
};

export type SendVerificationQuestionInput = {
  templateId: string;
  templateVersion: number;
  promptKey: string;
  prompt: string;
  idempotencyKey: string;
};

export type AnswerVerificationQuestionInput = {
  answer: string;
  idempotencyKey: string;
};

export type VerificationDecisionInput = {
  decision: "VERIFY_FOR_MEETUP" | "REQUEST_MORE_INFO" | "DECLINE" | "ESCALATE_TO_CUSTODY";
  reason: string;
  correctsEventId?: string | undefined;
  idempotencyKey: string;
};

export type CreateMessageInput = { content: string; clientMessageId?: string | undefined; };

export type CreateDirectMessageInput = {
  postId: string;
  content: string;
  clientMessageId?: string | undefined;
};

export type ListMessagesQuery = { limit: number; before?: Date | undefined; beforeId?: string | undefined; };

export type UploadEvidenceInput = { description?: string | undefined; };

export type ListClaimsQuery = { page: number; pageSize: number; };
