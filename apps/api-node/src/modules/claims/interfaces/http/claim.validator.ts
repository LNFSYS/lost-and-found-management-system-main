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
  decision: z.enum(["ACCEPT", "DECLINE", "REQUEST_MORE_INFO"]),
  note: z.string().trim().min(3).max(2000).optional()
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

export type { ClaimDecisionInput, CreateClaimInput, CreateMessageInput, ListClaimsQuery, ListMessagesQuery, UploadEvidenceInput } from "../../application/claim.dto.js";
