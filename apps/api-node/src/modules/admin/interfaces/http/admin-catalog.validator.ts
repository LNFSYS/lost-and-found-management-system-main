import { z } from "zod";

const uuid = z.string().uuid();
const name = z.string().trim().min(1, "Tên không được để trống").max(100, "Tên tối đa 100 ký tự");
const description = z.string().trim().max(255, "Mô tả tối đa 255 ký tự").nullable().optional();
const icon = z.string().trim().max(100, "Icon tối đa 100 ký tự").nullable().optional();
const sortOrder = z.coerce.number().int().min(0).max(9999).optional();
const nullableUuid = uuid.nullable().optional();
const nullableShortText = z.string().trim().max(255, "Nội dung tối đa 255 ký tự").nullable().optional();
const mapCoordinate = z.coerce.number().min(0, "Tọa độ phải từ 0 đến 100").max(100, "Tọa độ phải từ 0 đến 100").nullable().optional();

const mapImageUrl = z.string().trim().max(2048, "Đường dẫn ảnh bản đồ tối đa 2048 ký tự").refine((value) => {
  if (!value) return true;
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}, "Ảnh bản đồ phải là URL HTTP(S) hoặc đường dẫn bắt đầu bằng /").nullable().optional();

function atLeastOne(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

function completeMarkerCoordinates(value: { mapPositionX?: number | null; mapPositionY?: number | null; }, context: z.RefinementCtx) {
  const hasX = value.mapPositionX !== undefined;
  const hasY = value.mapPositionY !== undefined;
  if (hasX !== hasY) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: [hasX ? "mapPositionY" : "mapPositionX"], message: "Cần gửi đầy đủ cả tọa độ X và Y" });
    return;
  }
  if (hasX && ((value.mapPositionX === null) !== (value.mapPositionY === null))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: [value.mapPositionX === null ? "mapPositionY" : "mapPositionX"], message: "X và Y phải cùng có giá trị hoặc cùng để trống" });
  }
}

export const idParamSchema = z.object({ id: uuid });

export const createCategorySchema = z.object({
  name,
  icon,
  parentId: uuid.nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder
});

export const updateCategorySchema = z.object({
  name: name.optional(),
  icon,
  parentId: uuid.nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder
}).refine(atLeastOne, "Cần ít nhất một trường để cập nhật");

export const createAreaSchema = z.object({
  name,
  description,
  isActive: z.boolean().optional(),
  sortOrder
});

export const updateAreaSchema = z.object({
  name: name.optional(),
  description,
  isActive: z.boolean().optional(),
  sortOrder
}).refine(atLeastOne, "Cần ít nhất một trường để cập nhật");

export const createBuildingSchema = z.object({
  name,
  areaId: uuid,
  isActive: z.boolean().optional(),
  sortOrder
});

export const updateBuildingSchema = z.object({
  name: name.optional(),
  areaId: uuid.optional(),
  isActive: z.boolean().optional(),
  sortOrder
}).refine(atLeastOne, "Cần ít nhất một trường để cập nhật");

const handoverPointFields = {
  name,
  address: z.string().trim().min(2, "Địa chỉ cần ít nhất 2 ký tự").max(255, "Địa chỉ tối đa 255 ký tự"),
  areaId: nullableUuid,
  buildingId: nullableUuid,
  openingHours: nullableShortText,
  contactInfo: nullableShortText,
  mapImageUrl,
  mapPositionX: mapCoordinate,
  mapPositionY: mapCoordinate,
  isActive: z.boolean().optional()
};

export const createHandoverPointSchema = z.object(handoverPointFields).superRefine(completeMarkerCoordinates);

export const updateHandoverPointSchema = z.object({
  name: name.optional(),
  address: handoverPointFields.address.optional(),
  areaId: nullableUuid,
  buildingId: nullableUuid,
  openingHours: nullableShortText,
  contactInfo: nullableShortText,
  mapImageUrl,
  mapPositionX: mapCoordinate,
  mapPositionY: mapCoordinate,
  isActive: z.boolean().optional()
}).refine(atLeastOne, "Cần ít nhất một trường để cập nhật").superRefine(completeMarkerCoordinates);

export type { CreateAreaInput, CreateBuildingInput, CreateCategoryInput, CreateHandoverPointInput, UpdateAreaInput, UpdateBuildingInput, UpdateCategoryInput, UpdateHandoverPointInput } from "../../application/admin-catalog.dto.js";
