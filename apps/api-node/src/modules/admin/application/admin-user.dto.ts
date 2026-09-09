export type AdminAccessRole = "USER" | "ADMIN" | "STAFF";

export type AdminUserStatus = "ACTIVE" | "DISABLED";

export type ListAdminUsersQuery = { page: number; pageSize: number; status?: "ACTIVE" | "DISABLED" | undefined; q?: string | undefined; role?: "USER" | "ADMIN" | "STAFF" | undefined; };

export type CreateAdminUserInput = { status: "ACTIVE" | "DISABLED"; email: string; password: string; fullName: string; accessRole: "USER" | "ADMIN" | "STAFF"; reason?: string | null | undefined; studentCode?: string | null | undefined; phoneNumber?: string | null | undefined; audienceRole?: "STUDENT" | "LECTURER" | null | undefined; };

export type UpdateAdminUserInput = { status?: "ACTIVE" | "DISABLED" | undefined; reason?: string | null | undefined; email?: string | undefined; fullName?: string | undefined; studentCode?: string | null | undefined; phoneNumber?: string | null | undefined; accessRole?: "USER" | "ADMIN" | "STAFF" | undefined; };

export type UpdateAdminUserRoleInput = { accessRole: "USER" | "ADMIN" | "STAFF"; reason?: string | null | undefined; };

export type UpdateAdminUserStatusInput = { status: "ACTIVE" | "DISABLED"; reason?: string | null | undefined; };

export type DeleteAdminUserInput = { reason?: string | null | undefined; };
