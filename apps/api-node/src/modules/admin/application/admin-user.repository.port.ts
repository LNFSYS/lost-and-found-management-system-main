import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { Role } from "../../../shared/domain/auth.js";

import type { AdminAccessRole, AdminUserStatus, ListAdminUsersQuery } from "./admin-user.dto.js";

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  studentCode: string | null;
  phoneNumber: string | null;
  status: AdminUserStatus;
  roles: Role[];
  accessRole: AdminAccessRole;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserRepository {
  listUsers(filters: ListAdminUsersQuery): Promise<{
    total: number;
    page: number;
    pageSize: number;
    items: AdminUserRecord[];
  }>;
  findById(userId: string, connection?: TransactionContext, forUpdate?: boolean): Promise<AdminUserRecord | null>;
  findByNormalizedEmail(normalizedEmail: string, exceptUserId?: string, connection?: TransactionContext): Promise<string | null>;
  createUser(input: {
    id: string;
    email: string;
    normalizedEmail: string;
    passwordHash: string;
    fullName: string;
    studentCode?: string | null;
    phoneNumber?: string | null;
    status: AdminUserStatus;
  }, connection: TransactionContext): Promise<void>;
  updateUser(userId: string, input: {
    email?: string;
    normalizedEmail?: string;
    fullName?: string;
    studentCode?: string | null;
    phoneNumber?: string | null;
  }, connection?: TransactionContext): Promise<void>;
  setAccessRole(userId: string, accessRole: AdminAccessRole, connection: TransactionContext): Promise<void>;
  assignRole(userId: string, role: Role, connection: TransactionContext): Promise<void>;
  setStatus(userId: string, status: AdminUserStatus, connection: TransactionContext): Promise<void>;
  revokeRefreshTokens(userId: string, connection: TransactionContext): Promise<void>;
  countActiveAdmins(connection?: TransactionContext): Promise<number>;
  lockActiveAdmins(connection: TransactionContext): Promise<number>;
  softDeleteUser(userId: string, connection: TransactionContext): Promise<boolean>;
}
