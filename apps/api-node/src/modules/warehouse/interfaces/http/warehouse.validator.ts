import { z } from "zod";

const uuid = z.string().uuid();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalUuid = z.preprocess((value) => value === "" ? null : value, uuid.nullable().optional());

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

export const returnWarehouseItemSchema = z.object({
  claimId: optionalUuid,
  recipientId: optionalUuid,
  receiverName: z.string().trim().min(2, "Họ và tên người nhận phải có từ 2 đến 150 ký tự.").max(150, "Họ và tên người nhận phải có từ 2 đến 150 ký tự."),
  receiverIdentity: z.string().trim().min(3, "Mã thẻ SV / CMND / CCCD phải có từ 3 đến 100 ký tự.").max(100, "Mã thẻ SV / CMND / CCCD phải có từ 3 đến 100 ký tự."),
  receiverPhone: z.string().trim().min(9, "Số điện thoại phải có từ 9 đến 20 ký tự.").max(20, "Số điện thoại phải có từ 9 đến 20 ký tự."),
  proofImage: z.string().max(200, "Chỉ được gửi tối đa 5 ảnh bằng chứng.").refine(value => value.split("\n").length <= 5 && value.split("\n").every(id => uuid.safeParse(id).success), "Vui lòng tải lên từ 1 đến 5 ảnh bằng chứng hợp lệ."),
  note: z.string().trim().max(1000, "Ghi chú bàn giao không được vượt quá 1000 ký tự.").nullable().optional()
}).superRefine((value, context) => {
  if (Boolean(value.claimId) !== Boolean(value.recipientId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["claimId"], message: "claimId và recipientId phải được gửi cùng nhau hoặc cùng bỏ trống" });
  }
});

export type { CreateWarehouseItemInput, ListWarehouseItemsQuery, UpdateWarehouseItemInput, ReturnWarehouseItemInput, WarehouseStatus } from "../../application/warehouse.dto.js";
