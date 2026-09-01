import { z } from "zod";

const uuid = z.string().uuid();
const email = z.string().trim().email().max(255);
const nullableText = (max: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(max).nullable().optional()
);
const reason = nullableText(255);

function atLeastOne(value: Record<string, unknown>) {
  return Object.keys(value).some((key) => key !== "reason");
}

export const adminUserIdParamSchema = z.object({ id: uuid });
export const adminAccessRoleSchema = z.enum(["ADMIN", "STAFF", "USER"]);
export const adminUserStatusSchema = z.enum(["ACTIVE", "DISABLED"]);

export const listAdminUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: adminAccessRoleSchema.optional(),
  status: adminUserStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const createAdminUserSchema = z.object({
  email,
  password: z.string().min(8, "Mat khau toi thieu 8 ky tu").max(72),
  fullName: z.string().trim().min(2).max(160),
  studentCode: nullableText(40),
  phoneNumber: nullableText(30),
  audienceRole: z.enum(["STUDENT", "LECTURER"]).nullable().optional(),
  accessRole: adminAccessRoleSchema.default("USER"),
  status: adminUserStatusSchema.default("ACTIVE"),
  reason
});

export const updateAdminUserSchema = z.object({
  email: email.optional(),
  fullName: z.string().trim().min(2).max(160).optional(),
  studentCode: nullableText(40),
  phoneNumber: nullableText(30),
  accessRole: adminAccessRoleSchema.optional(),
  status: adminUserStatusSchema.optional(),
  reason
}).refine(atLeastOne, "Can it nhat mot truong de cap nhat");

export const updateAdminUserRoleSchema = z.object({
  accessRole: adminAccessRoleSchema,
  reason
});

export const updateAdminUserStatusSchema = z.object({
  status: adminUserStatusSchema,
  reason
});

export const deleteAdminUserSchema = z.object({ reason }).default({});

export type AdminAccessRole = z.infer<typeof adminAccessRoleSchema>;
export type AdminUserStatus = z.infer<typeof adminUserStatusSchema>;
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
export type UpdateAdminUserRoleInput = z.infer<typeof updateAdminUserRoleSchema>;
export type UpdateAdminUserStatusInput = z.infer<typeof updateAdminUserStatusSchema>;
export type DeleteAdminUserInput = z.infer<typeof deleteAdminUserSchema>;
