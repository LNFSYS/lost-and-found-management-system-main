import { z } from "zod";

const uuid = z.string().uuid();
const name = z.string().trim().min(1, "Tên không được để trống").max(100, "Tên tối đa 100 ký tự");
const description = z.string().trim().max(255, "Mô tả tối đa 255 ký tự").nullable().optional();
const icon = z.string().trim().max(100, "Icon tối đa 100 ký tự").nullable().optional();
const sortOrder = z.coerce.number().int().min(0).max(9999).optional();

function atLeastOne(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
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

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
