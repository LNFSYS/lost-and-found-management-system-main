import { z } from "zod";

const uuid = z.string().uuid();
const safeKey = z.string().trim().min(8).max(190).regex(/^[A-Za-z0-9._:-]+$/, "Idempotency key không hợp lệ");
const pastDate = z.coerce.date().refine((value) => value.getTime() <= Date.now(), "Thời điểm không được nằm trong tương lai");

export const claimIdParamSchema = z.object({ claimId: uuid });
export const roomIdParamSchema = z.object({ roomId: uuid });
export const evidenceParamSchema = z.object({ claimId: uuid, evidenceId: uuid });
export const listClaimsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(50)
});

export const createClaimSchema = z.object({
  lostPostId: uuid,
  foundPostId: uuid,
  description: z.string().trim().min(10).max(5000).optional(),
  approximateLostAt: pastDate.optional(),
  approximateLocation: z.string().trim().max(255).optional(),
  requestKey: safeKey.optional()
});

export const claimDecisionSchema = z.object({
  decision: z.enum(["ACCEPT", "OPEN_CONVERSATION", "DECLINE", "REQUEST_MORE_INFO", "VERIFY_FOR_MEETUP", "ESCALATE_TO_CUSTODY"]),
  note: z.string().trim().min(3).max(2000).optional(),
  expectedStatus: z.enum(["PENDING", "CONVERSATION_OPEN", "NEED_MORE_INFO", "ACCEPTED", "REJECTED", "CANCELLED"]).optional(),
  idempotencyKey: safeKey
}).superRefine((value, context) => {
  if (value.decision !== "ACCEPT" && !value.note) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "Quyết định này cần lý do." });
  }
});

const verificationKey = z.string().trim().min(1).max(190).regex(/^[A-Za-z0-9._:-]+$/, "Mã câu hỏi không hợp lệ");

export const verificationQuestionSchema = z.object({
  questionKey: verificationKey,
  prompt: z.string().trim().min(8).max(500),
  templateId: z.string().trim().min(1).max(100),
  templateVersion: z.number().int().positive(),
  idempotencyKey: safeKey
});

export const verificationAnswerSchema = z.object({
  questionKey: verificationKey,
  answer: z.string().trim().min(1).max(2000),
  idempotencyKey: safeKey
});

export const verificationReviewSchema = z.object({
  questionKey: verificationKey,
  result: z.enum(["PASS", "FAIL", "UNCLEAR"]),
  confidence: z.coerce.number().min(0).max(1),
  reason: z.string().trim().min(3).max(1000),
  idempotencyKey: safeKey
});

export const verificationIdParamSchema = z.object({ claimId: uuid });

export const withdrawClaimSchema = z.object({
  note: z.string().trim().min(3).max(500).optional(),
  idempotencyKey: safeKey
});

export const createMessageSchema = z.object({
  content: z.string().trim().min(1, "Tin nhắn không được để trống").max(5000),
  clientMessageId: safeKey.optional()
});

export const listMessagesQuerySchema = z.object({
  before: z.coerce.date().optional(),
  beforeId: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
}).superRefine((value, context) => {
  if (value.before && !value.beforeId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["beforeId"], message: "Cursor phan trang can beforeId" });
  }
  if (value.beforeId && !value.before) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["before"], message: "Cursor phan trang can before" });
  }
});

export const uploadEvidenceSchema = z.object({
  description: z.string().trim().max(255).optional()
});

export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type ClaimDecisionInput = z.infer<typeof claimDecisionSchema>;
export type VerificationQuestionInput = z.infer<typeof verificationQuestionSchema>;
export type VerificationAnswerInput = z.infer<typeof verificationAnswerSchema>;
export type VerificationReviewInput = z.infer<typeof verificationReviewSchema>;
export type WithdrawClaimInput = z.infer<typeof withdrawClaimSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type UploadEvidenceInput = z.infer<typeof uploadEvidenceSchema>;
export type ListClaimsQuery = z.infer<typeof listClaimsQuerySchema>;
