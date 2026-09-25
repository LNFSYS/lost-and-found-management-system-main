import { z } from "zod";

const uuid = z.string().uuid();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const custodyReasonSchema = z.enum([
  "INACTIVITY",
  "SAFETY_CONCERN",
  "DISPUTE",
  "SENSITIVE_ITEM",
  "VOLUNTARY"
]);

export const custodyStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "INTAKED"
]);

export const custodyRequestIdParamSchema = z.object({ id: uuid });
export const postIdParamSchema = z.object({ postId: uuid });

export const createCustodyRequestSchema = z.object({
  postId: uuid,
  claimId: uuid.nullable().optional(),
  reason: custodyReasonSchema,
  reasonNotes: nullableText(1000),
  proposedHandoverPointId: uuid.nullable().optional(),
  proposedTime: z.coerce.date().nullable().optional()
});

export const listCustodyRequestsQuerySchema = z.object({
  status: z.union([custodyStatusSchema, z.literal("ALL")]).optional().default("ALL"),
  finderId: uuid.optional(),
  postId: uuid.optional(),
  page: z.coerce.number().int().min(1).max(999).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12)
});

export const acceptCustodyRequestSchema = z.object({
  confirmedHandoverPointId: uuid,
  assignedHandlerId: uuid.nullable().optional(),
  notes: nullableText(1000)
});

export const rejectCustodyRequestSchema = z.object({
  reason: z.string().trim().min(1, "Lý do từ chối không được để trống").max(1000)
});

export const cancelCustodyRequestSchema = z.object({
  reason: z.string().trim().min(1, "Lý do hủy không được để trống").max(1000)
});

export const confirmStaffIntakeSchema = z.object({
  conditionNotes: z.string().trim().min(1, "Tình trạng vật phẩm không được để trống").max(2000),
  storageCode: nullableText(60),
  handoverPointId: uuid.nullable().optional(),
  areaId: uuid.nullable().optional(),
  buildingId: uuid.nullable().optional(),
  roomText: nullableText(100),
  receivedAt: z.coerce.date().optional()
});
