import { z } from "zod";

const uuid = z.string().uuid();
const configKey = z.string().trim().min(3).max(100).regex(/^[a-z][a-z0-9]*(\.[a-z0-9_]+)+$/);
const configValue = z.string().trim().min(1).max(5000);
const queryBoolean = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());
const description = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(255).nullable().optional()
);
const reason = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(255).nullable().optional()
);

export const configValueTypeSchema = z.enum(["STRING", "INTEGER", "FLOAT", "BOOLEAN", "JSON"]);

export const configIdParamSchema = z.object({ id: uuid });

export const listConfigsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  valueType: configValueTypeSchema.optional(),
  isPublic: queryBoolean.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const createConfigSchema = z.object({
  configKey,
  configValue,
  valueType: configValueTypeSchema,
  description,
  isPublic: z.boolean().default(false),
  reason
});

export const updateConfigSchema = z.object({
  configKey: configKey.optional(),
  configValue: configValue.optional(),
  valueType: configValueTypeSchema.optional(),
  description,
  isPublic: z.boolean().optional(),
  reason
}).refine((value) => Object.keys(value).some((key) => key !== "reason"), "Can it nhat mot truong de cap nhat");

export const configHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type ConfigValueType = z.infer<typeof configValueTypeSchema>;
export type ListConfigsQuery = z.infer<typeof listConfigsQuerySchema>;
export type CreateConfigInput = z.infer<typeof createConfigSchema>;
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;
export type ConfigHistoryQuery = z.infer<typeof configHistoryQuerySchema>;
