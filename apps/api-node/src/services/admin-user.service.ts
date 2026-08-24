import bcrypt from "bcryptjs";
import type { PoolConnection } from "mysql2/promise";
import { env } from "../config/env.js";
import { withTransaction } from "../config/db.js";
import { adminUserRepository, type AdminUserRecord, type AdminUserRepository } from "../repositories/admin-user.repository.js";
import type { AudienceRole } from "../types/auth.js";
import { HttpError } from "../utils/http-error.js";
import { id, normalizeEmail } from "../utils/security.js";
import type {
  CreateAdminUserInput,
  ListAdminUsersQuery,
  UpdateAdminUserInput,
  UpdateAdminUserRoleInput,
  UpdateAdminUserStatusInput
} from "../validators/admin-user.validator.js";

type TransactionRunner = <T>(work: (connection: PoolConnection) => Promise<T>) => Promise<T>;
type PasswordHasher = (password: string) => Promise<string>;

export type PublicAdminUser = AdminUserRecord;

function publicUser(user: AdminUserRecord): PublicAdminUser {
  return user;
}

async function loadUserOrThrow(repository: AdminUserRepository, userId: string) {
  const user = await repository.findById(userId);
  if (!user) throw new HttpError(404, "Khong tim thay tai khoan");
  return user;
}

async function assertCanRemoveActiveAdmin(repository: AdminUserRepository, target: AdminUserRecord, connection: PoolConnection) {
  if (target.accessRole !== "ADMIN" || target.status !== "ACTIVE") return;
  if (await repository.countActiveAdmins(connection) <= 1) {
    throw new HttpError(409, "Khong the xoa, khoa hoac ha quyen Admin cuoi cung");
  }
}

export function createAdminUserService(options: {
  repository?: AdminUserRepository;
  transaction?: TransactionRunner;
  hashPassword?: PasswordHasher;
  idFactory?: () => string;
} = {}) {
  const repository = options.repository ?? adminUserRepository;
  const transaction = options.transaction ?? withTransaction;
  const hashPassword = options.hashPassword ?? ((password: string) => bcrypt.hash(password, env.bcryptSaltRounds));
  const idFactory = options.idFactory ?? id;

  return {
    async listUsers(filters: ListAdminUsersQuery) {
      const result = await repository.listUsers(filters);
      return { ...result, items: result.items.map(publicUser) };
    },

    async getUser(userId: string) {
      return publicUser(await loadUserOrThrow(repository, userId));
    },

    async createUser(input: CreateAdminUserInput) {
      const normalizedEmail = normalizeEmail(input.email);
      return transaction(async (connection) => {
        if (await repository.findByNormalizedEmail(normalizedEmail, undefined, connection)) {
          throw new HttpError(409, "Email da duoc su dung");
        }
        const userId = idFactory();
        await repository.createUser({
          id: userId,
          email: input.email.trim(),
          normalizedEmail,
          passwordHash: await hashPassword(input.password),
          fullName: input.fullName.trim(),
          studentCode: input.studentCode ?? null,
          phoneNumber: input.phoneNumber ?? null,
          status: input.status
        }, connection);
        await repository.assignRole(userId, "USER", connection);
        if (input.audienceRole) await repository.assignRole(userId, input.audienceRole as AudienceRole, connection);
        if (input.accessRole !== "USER") await repository.assignRole(userId, input.accessRole, connection);
        const created = await repository.findById(userId, connection);
        if (!created) throw new HttpError(500, "Khong the tao tai khoan");
        return publicUser(created);
      });
    },

    async updateUser(userId: string, input: UpdateAdminUserInput) {
      const current = await loadUserOrThrow(repository, userId);
      const normalizedEmail = input.email ? normalizeEmail(input.email) : undefined;
      if (normalizedEmail && normalizedEmail !== normalizeEmail(current.email)) {
        if (await repository.findByNormalizedEmail(normalizedEmail, userId)) {
          throw new HttpError(409, "Email da duoc su dung");
        }
      }
      return transaction(async (connection) => {
        await repository.updateUser(userId, {
          email: input.email?.trim(),
          normalizedEmail,
          fullName: input.fullName?.trim(),
          studentCode: input.studentCode,
          phoneNumber: input.phoneNumber
        }, connection);
        await repository.revokeRefreshTokens(userId, connection);
        const updated = await repository.findById(userId, connection);
        if (!updated) throw new HttpError(404, "Khong tim thay tai khoan");
        return publicUser(updated);
      });
    },

    async changeRole(actorUserId: string, userId: string, input: UpdateAdminUserRoleInput) {
      const target = await loadUserOrThrow(repository, userId);
      if (actorUserId === userId && target.accessRole === "ADMIN" && input.accessRole !== "ADMIN") {
        throw new HttpError(409, "Admin khong duoc tu ha quyen chinh minh");
      }
      return transaction(async (connection) => {
        if (input.accessRole !== "ADMIN") await assertCanRemoveActiveAdmin(repository, target, connection);
        await repository.setAccessRole(userId, input.accessRole, connection);
        await repository.revokeRefreshTokens(userId, connection);
        const updated = await repository.findById(userId, connection);
        if (!updated) throw new HttpError(404, "Khong tim thay tai khoan");
        return publicUser(updated);
      });
    },

    async changeStatus(actorUserId: string, userId: string, input: UpdateAdminUserStatusInput) {
      const target = await loadUserOrThrow(repository, userId);
      if (actorUserId === userId && input.status === "DISABLED") {
        throw new HttpError(409, "Admin khong duoc tu khoa chinh minh");
      }
      return transaction(async (connection) => {
        if (input.status === "DISABLED") await assertCanRemoveActiveAdmin(repository, target, connection);
        await repository.setStatus(userId, input.status, connection);
        await repository.revokeRefreshTokens(userId, connection);
        const updated = await repository.findById(userId, connection);
        if (!updated) throw new HttpError(404, "Khong tim thay tai khoan");
        return publicUser(updated);
      });
    },

    async deleteUser(actorUserId: string, userId: string) {
      const target = await loadUserOrThrow(repository, userId);
      if (actorUserId === userId) throw new HttpError(409, "Admin khong duoc tu xoa chinh minh");
      await transaction(async (connection) => {
        await assertCanRemoveActiveAdmin(repository, target, connection);
        await repository.softDeleteUser(userId, connection);
        await repository.revokeRefreshTokens(userId, connection);
      });
    }
  };
}

export const adminUserService = createAdminUserService();
