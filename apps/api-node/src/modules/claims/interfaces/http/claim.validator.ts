import { z } from "zod";

const uuid = z.string().uuid();
const safeKey = z.string().trim().min(8).max(190).regex(/^[A-Za-z0-9._:-]+$/, "Idempotency key không hợp lệ");
const pastDate = z.coerce.date().refine((value) => value.getTime() <= Date.now(), "Thời điểm không được nằm trong tương lai");

export const claimIdParamSchema = z.object({ claimId: uuid });
export const roomIdParamSchema = z.object({ roomId: uuid });
export const evidenceParamSchema = z.object({ claimId: uuid, evidenceId: uuid });
export const verificationQuestionParamSchema = z.object({ claimId: uuid, questionId: uuid });
export const listClaimsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(50)
});

export const createClaimSchema = z.object({
  postId: uuid.optional(),
  lostPostId: uuid.optional(),
  foundPostId: uuid.optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  approximateLostAt: pastDate.optional(),
  approximateLocation: z.string().trim().max(255).optional(),
  requestKey: safeKey.optional()
}).superRefine((value, context) => {
  const directClaim = Boolean(value.postId);
  const matchedClaim = Boolean(value.lostPostId && value.foundPostId);
  if (directClaim === matchedClaim || (directClaim && (value.lostPostId || value.foundPostId))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["postId"],
      message: "Cần postId hoặc đầy đủ cặp lostPostId/foundPostId"
    });
  }
});

export const claimDecisionSchema = z.object({
  decision: z.enum(["ACCEPT", "DECLINE", "REQUEST_MORE_INFO"]),
  note: z.string().trim().min(3).max(1000),
  idempotencyKey: safeKey
});

export const sendVerificationQuestionSchema = z.object({
  templateId: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/),
  templateVersion: z.number().int().min(1).max(999),
  promptKey: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/),
  prompt: z.string().trim().min(10).max(500),
  idempotencyKey: safeKey
});

export const answerVerificationQuestionSchema = z.object({
  answer: z.string().trim().min(1).max(500),
  idempotencyKey: safeKey
});

export const verificationDecisionSchema = z.object({
  decision: z.enum(["VERIFY_FOR_MEETUP", "REQUEST_MORE_INFO", "DECLINE", "ESCALATE_TO_CUSTODY"]),
  reason: z.string().trim().min(3).max(1000),
  correctsEventId: uuid.optional(),
  idempotencyKey: safeKey
});

export const createMessageSchema = z.object({
  content: z.string().trim().min(1, "Tin nhắn không được để trống").max(5000),
  clientMessageId: safeKey.optional()
});

export const createDirectMessageSchema = z.object({
  postId: uuid,
  content: z.string().trim().min(1).max(5000),
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

export type {
  AnswerVerificationQuestionInput, ClaimDecisionInput, CreateClaimInput, CreateMessageInput, ListClaimsQuery,
  ListMessagesQuery, SendVerificationQuestionInput, UploadEvidenceInput, VerificationDecisionInput
} from "../../application/claim.dto.js";
