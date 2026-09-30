import { z } from "zod";

const uuid = z.string().uuid();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const custodyRequestStatusSchema = z.enum([
  "PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "INTAKED"
]);

export const custodyRequestIdParamSchema = z.object({ id: uuid });

export const listCustodyRequestsQuerySchema = z.object({
  status: custodyRequestStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(999).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12)
});

export const createCustodyRequestSchema = z.object({
  claimId: uuid.nullable().optional(),
  roomId: uuid.nullable().optional(),
  postId: uuid.nullable().optional(),
  reason: nullableText(2000),
  handoverPointId: uuid.nullable().optional(),
  intakeType: z.enum(["CUSTODY_TRANSFER", "WALK_IN"]).optional(),
  idempotencyKey: z.string().trim().max(64).optional()
});

export const acceptCustodyRequestSchema = z.object({
  handoverPointId: uuid,
  confirmedHandoverAt: z.coerce.date().nullable().optional(),
  reason: nullableText(2000)
});

export const rejectCustodyRequestSchema = z.object({
  reason: z.string().trim().min(1, "Lý do từ chối không được để trống").max(2000)
});

export const cancelCustodyRequestSchema = z.object({
  reason: nullableText(2000)
});

export const intakeCustodyRequestSchema = z.object({
  conditionNotes: z.string().trim().min(1, "Tình trạng vật phẩm không được để trống").max(2000),
  storageCode: nullableText(60),
  confirmedHandoverAt: z.coerce.date().nullable().optional()
});
