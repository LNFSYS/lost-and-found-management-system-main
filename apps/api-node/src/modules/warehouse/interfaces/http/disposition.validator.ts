import { z } from "zod";

const uuid = z.string().uuid();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const dispositionTypeSchema = z.enum(["DISPOSAL", "DONATION", "TRANSFER"]);
export const dispositionOrderStatusSchema = z.enum([
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED"
]);

export const dispositionOrderIdParamSchema = z.object({ id: uuid });
export const warehouseItemIdParamSchema = z.object({ id: uuid });
export const legalHoldIdParamSchema = z.object({ id: uuid, holdId: uuid });

export const listOverdueItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(999).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  q: z.string().trim().max(120).optional(),
  handoverPointId: uuid.optional(),
  legalHoldOnly: z.coerce.boolean().optional().default(false)
});

export const applyLegalHoldSchema = z.object({
  warehouseItemId: uuid,
  reason: z.string().trim().min(1, "Lý do tạm giữ pháp lý không được để trống").max(1000)
});

export const releaseLegalHoldSchema = z.object({
  releaseReason: z.string().trim().min(1, "Lý do gỡ lệnh tạm giữ không được để trống").max(1000)
});

export const createDispositionOrderSchema = z.object({
  dispositionType: dispositionTypeSchema,
  reason: z.string().trim().min(1, "Lý do tạo lệnh xử lý không được để trống").max(1000),
  warehouseItemIds: z.array(uuid).min(1, "Cần chọn ít nhất một vật phẩm")
});

export const listDispositionOrdersQuerySchema = z.object({
  status: z.union([dispositionOrderStatusSchema, z.literal("ALL")]).optional().default("ALL"),
  dispositionType: z.union([dispositionTypeSchema, z.literal("ALL")]).optional().default("ALL"),
  page: z.coerce.number().int().min(1).max(999).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12)
});

export const rejectDispositionOrderSchema = z.object({
  reason: z.string().trim().min(1, "Lý do từ chối không được để trống").max(1000)
});

export const cancelDispositionOrderSchema = z.object({
  reason: z.string().trim().min(1, "Lý do hủy lệnh không được để trống").max(1000)
});

export const executeDispositionSchema = z.object({
  processedItemIds: z.array(uuid).min(1, "Cần chọn ít nhất một vật phẩm"),
  evidenceUrls: z
    .array(
      z.object({
        fileUrl: z.string().url("Đường dẫn file không hợp lệ"),
        fileKind: z.enum(["DOCUMENT", "PHOTO", "CERTIFICATE"]).default("PHOTO"),
        description: nullableText(255),
        warehouseItemId: uuid.optional()
      })
    )
    .optional()
    .default([]),
  notes: nullableText(1000)
});
