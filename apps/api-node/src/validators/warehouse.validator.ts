import { z } from "zod";

const uuid = z.string().uuid();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const warehouseStatusSchema = z.enum([
  "PENDING_APPROVAL",
  "RECEIVED",
  "STORED",
  "CLAIMED",
  "RETURNED",
  "EXPIRED",
  "DISPOSED",
  "DONATED",
  "TRANSFERRED"
]);

function atLeastOne(value: Record<string, unknown>) {
  return Object.values(value).some((item) => item !== undefined);
}

export const warehouseItemIdParamSchema = z.object({ id: uuid });

export const listWarehouseItemsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: warehouseStatusSchema.optional(),
  handoverPointId: uuid.optional(),
  page: z.coerce.number().int().min(1).max(999).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12)
});

export const createWarehouseItemSchema = z.object({
  postId: uuid.nullable().optional(),
  handoverPointId: uuid,
  itemName: z.string().trim().min(1, "Tên vật phẩm không được để trống").max(255),
  description: nullableText(2000),
  categoryId: uuid.nullable().optional(),
  areaId: uuid.nullable().optional(),
  buildingId: uuid.nullable().optional(),
  roomText: nullableText(100),
  finderName: nullableText(150),
  finderContact: nullableText(255),
  conditionNotes: z.string().trim().min(1, "Tình trạng vật phẩm không được để trống").max(2000),
  storageCode: nullableText(60),
  receivedAt: z.coerce.date().optional()
});

export const updateWarehouseItemSchema = z.object({
  status: warehouseStatusSchema.optional(),
  conditionNotes: nullableText(2000),
  storageCode: nullableText(60),
  note: nullableText(1000)
}).refine(atLeastOne, "Cần ít nhất một trường để cập nhật");

export type WarehouseStatus = z.infer<typeof warehouseStatusSchema>;
export type ListWarehouseItemsQuery = z.infer<typeof listWarehouseItemsQuerySchema>;
export type CreateWarehouseItemInput = z.infer<typeof createWarehouseItemSchema>;
export type UpdateWarehouseItemInput = z.infer<typeof updateWarehouseItemSchema>;
