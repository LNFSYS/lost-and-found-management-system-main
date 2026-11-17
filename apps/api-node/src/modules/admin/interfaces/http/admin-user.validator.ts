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

const weakPasswords = new Set(["12345678", "123456789", "87654321", "abcdefgh", "00000000"]);
const adminPassword = z
  .string()
  .min(8, "Mật khẩu tối thiểu 8 ký tự")
  .max(72)
  .refine((val) => /[A-Za-z]/.test(val) && /[\d\W_]/.test(val), "Mật khẩu phải chứa ít nhất một chữ cái và một chữ số hoặc ký tự đặc biệt")
  .refine((val) => !weakPasswords.has(val.toLowerCase()), "Mật khẩu quá đơn giản, vui lòng chọn mật khẩu khác");

export const createAdminUserSchema = z.object({
  email,
  password: adminPassword,
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
}).refine(atLeastOne, "Cần ít nhất một trường để cập nhật");

export const updateAdminUserRoleSchema = z.object({
  accessRole: adminAccessRoleSchema,
  reason
});

export const updateAdminUserStatusSchema = z.object({
  status: adminUserStatusSchema,
  reason
});

export const deleteAdminUserSchema = z.object({ reason }).default({});

export type { AdminAccessRole, AdminUserStatus, CreateAdminUserInput, DeleteAdminUserInput, ListAdminUsersQuery, UpdateAdminUserInput, UpdateAdminUserRoleInput, UpdateAdminUserStatusInput } from "../../application/admin-user.dto.js";
