import bcrypt from "bcryptjs";
import type { PoolConnection } from "mysql2/promise";
import { env } from "../config/env.js";
import { withTransaction } from "../config/db.js";
import { adminAuditRepository, type AdminAuditRepository } from "../repositories/admin-audit.repository.js";
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

function userAuditState(user: AdminUserRecord): Record<string, unknown> {
  return {
    email: user.email,
    fullName: user.fullName,
    studentCode: user.studentCode,
    phoneNumber: user.phoneNumber,
    status: user.status,
    roles: [...user.roles].sort(),
    accessRole: user.accessRole
  };
}

function assertCanRemoveActiveAdmin(target: AdminUserRecord, activeAdminCount: number) {
  if (target.accessRole === "ADMIN" && target.status === "ACTIVE" && activeAdminCount <= 1) {
    throw new HttpError(409, "Khong the xoa, khoa hoac ha quyen Admin cuoi cung");
  }
}

async function loadUserOrThrow(repository: AdminUserRepository, userId: string, connection?: PoolConnection, forUpdate = false) {
  const user = connection
    ? await repository.findById(userId, connection, forUpdate)
    : await repository.findById(userId);
  if (!user) throw new HttpError(404, "Khong tim thay tai khoan");
  return user;
}

export function createAdminUserService(options: {
  repository?: AdminUserRepository;
  auditRepository?: AdminAuditRepository;
  transaction?: TransactionRunner;
  hashPassword?: PasswordHasher;
  idFactory?: () => string;
} = {}) {
  const repository = options.repository ?? adminUserRepository;
  const audit = options.auditRepository ?? adminAuditRepository;
  const transaction = options.transaction ?? withTransaction;
  const hashPassword = options.hashPassword ?? ((password: string) => bcrypt.hash(password, env.bcryptSaltRounds));
  const idFactory = options.idFactory ?? id;

  async function recordAudit(input: {
    actorId: string;
    action: string;
    targetId: string;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
    reason?: string | null;
  }, connection: PoolConnection) {
    await audit.record({
      id: idFactory(),
      actorId: input.actorId,
      action: input.action,
      targetType: "USER",
      targetId: input.targetId,
      beforeState: input.beforeState,
      afterState: input.afterState,
      reason: input.reason ?? null
    }, connection);
  }

  async function mutateUser(
    actorUserId: string,
    userId: string,
    input: UpdateAdminUserInput,
    action: string
  ) {
    return transaction(async (connection) => {
      // Every admin mutation locks the complete active-admin set in deterministic order.
      // A concurrent demotion/disable/delete therefore observes the committed count.
      const activeAdminCount = await repository.lockActiveAdmins(connection);
      const current = await loadUserOrThrow(repository, userId, connection, true);
      const nextRole = input.accessRole ?? current.accessRole;
      const nextStatus = input.status ?? current.status;

      if (actorUserId === userId && current.accessRole === "ADMIN" && nextRole !== "ADMIN") {
        throw new HttpError(409, "Admin khong duoc tu ha quyen chinh minh");
      }
      if (actorUserId === userId && nextStatus === "DISABLED") {
        throw new HttpError(409, "Admin khong duoc tu khoa chinh minh");
      }
      if ((nextRole !== current.accessRole || nextStatus !== current.status)
        && current.accessRole === "ADMIN"
        && current.status === "ACTIVE"
        && (nextRole !== "ADMIN" || nextStatus === "DISABLED")) {
        assertCanRemoveActiveAdmin(current, activeAdminCount);
      }

      const normalizedEmail = input.email ? normalizeEmail(input.email) : undefined;
      if (normalizedEmail && normalizedEmail !== normalizeEmail(current.email)) {
        if (await repository.findByNormalizedEmail(normalizedEmail, userId, connection)) {
          throw new HttpError(409, "Email da duoc su dung");
        }
      }

      const profileInput = {
        email: input.email?.trim(),
        normalizedEmail,
        fullName: input.fullName?.trim(),
        studentCode: input.studentCode,
        phoneNumber: input.phoneNumber
      };
      const profileChanged = Object.values(profileInput).some((value) => value !== undefined);
      if (profileChanged) await repository.updateUser(userId, profileInput, connection);
      if (input.accessRole !== undefined && input.accessRole !== current.accessRole) {
        await repository.setAccessRole(userId, input.accessRole, connection);
      }
      if (input.status !== undefined && input.status !== current.status) {
        await repository.setStatus(userId, input.status, connection);
      }
      if (profileChanged || input.accessRole !== undefined || input.status !== undefined) {
        await repository.revokeRefreshTokens(userId, connection);
      }

      const updated = await loadUserOrThrow(repository, userId, connection);
      await recordAudit({
        actorId: actorUserId,
        action,
        targetId: userId,
        beforeState: userAuditState(current),
        afterState: userAuditState(updated),
        reason: input.reason
      }, connection);
      return publicUser(updated);
    });
  }

  return {
    async listUsers(filters: ListAdminUsersQuery) {
      const result = await repository.listUsers(filters);
      return { ...result, items: result.items.map(publicUser) };
    },

    async getUser(userId: string) {
      return publicUser(await loadUserOrThrow(repository, userId));
    },

    async createUser(actorId: string, input: CreateAdminUserInput) {
      const normalizedEmail = normalizeEmail(input.email);
      return transaction(async (connection) => {
        if (await repository.findByNormalizedEmail(normalizedEmail, undefined, connection)) {
          throw new HttpError(409, "Email da su dung");
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
        const created = await loadUserOrThrow(repository, userId, connection);
        await recordAudit({
          actorId,
          action: "ADMIN_USER_CREATED",
          targetId: userId,
          beforeState: null,
          afterState: userAuditState(created),
          reason: input.reason
        }, connection);
        return publicUser(created);
      });
    },

    async updateUser(actorUserId: string, userId: string, input: UpdateAdminUserInput) {
      return mutateUser(actorUserId, userId, input, "ADMIN_USER_UPDATED");
    },

    async changeRole(actorUserId: string, userId: string, input: UpdateAdminUserRoleInput) {
      return mutateUser(actorUserId, userId, input, "ADMIN_USER_ROLE_CHANGED");
    },

    async changeStatus(actorUserId: string, userId: string, input: UpdateAdminUserStatusInput) {
      return mutateUser(actorUserId, userId, input, "ADMIN_USER_STATUS_CHANGED");
    },

    async deleteUser(actorUserId: string, userId: string, reason?: string | null) {
      await transaction(async (connection) => {
        const activeAdminCount = await repository.lockActiveAdmins(connection);
        const target = await loadUserOrThrow(repository, userId, connection, true);
        if (actorUserId === userId) throw new HttpError(409, "Admin khong duoc tu xoa chinh minh");
        assertCanRemoveActiveAdmin(target, activeAdminCount);
        if (!await repository.softDeleteUser(userId, connection)) {
          throw new HttpError(404, "Khong tim thay tai khoan");
        }
        await repository.revokeRefreshTokens(userId, connection);
        const updated = await loadUserOrThrow(repository, userId, connection);
        await recordAudit({
          actorId: actorUserId,
          action: "ADMIN_USER_DELETED",
          targetId: userId,
          beforeState: userAuditState(target),
          afterState: userAuditState(updated),
          reason
        }, connection);
      });
    }
  };
}

export const adminUserService = createAdminUserService();
