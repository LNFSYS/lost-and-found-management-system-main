import type { TransactionContext, TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import type { AudienceRole } from "../../../shared/domain/auth.js";
import { normalizeEmail } from "../../../shared/domain/text.js";
import type { AdminAuditRepository } from "./admin-audit.repository.port.js";
import type {
  CreateAdminUserInput,
  ListAdminUsersQuery,
  UpdateAdminUserInput,
  UpdateAdminUserRoleInput,
  UpdateAdminUserStatusInput
} from "./admin-user.dto.js";
import type { AdminUserRecord, AdminUserRepository } from "./admin-user.repository.port.js";

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
    throw new AppError("conflict", "Khong the xoa, khoa hoac ha quyen Admin cuoi cung");
  }
}

export interface AdminUserDependencies {
  repository: AdminUserRepository;
  auditRepository: AdminAuditRepository;
  transaction: TransactionRunner;
  idFactory: () => string;
  hashPassword: (password: string) => Promise<string>;
}
export function createAdminUserUseCases(options: AdminUserDependencies) {
  const { repository, auditRepository: audit, transaction, idFactory, hashPassword } = options;

  async function loadUserOrThrow(repository: AdminUserRepository, userId: string, connection?: TransactionContext, forUpdate = false) {
    const user = connection
      ? await repository.findById(userId, connection, forUpdate)
      : await repository.findById(userId);
    if (!user) throw new AppError("not_found", "Khong tim thay tai khoan");
    return user;
  }

  async function recordAudit(input: {
    actorId: string;
    action: string;
    targetId: string;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
    reason?: string | null;
  }, connection: TransactionContext) {
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
        throw new AppError("conflict", "Admin khong duoc tu ha quyen chinh minh");
      }
      if (actorUserId === userId && nextStatus === "DISABLED") {
        throw new AppError("conflict", "Admin khong duoc tu khoa chinh minh");
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
          throw new AppError("conflict", "Email da duoc su dung");
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

  const adminUserService = {
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
          throw new AppError("conflict", "Email da su dung");
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
        if (actorUserId === userId) throw new AppError("conflict", "Admin khong duoc tu xoa chinh minh");
        assertCanRemoveActiveAdmin(target, activeAdminCount);
        if (!await repository.softDeleteUser(userId, connection)) {
          throw new AppError("not_found", "Khong tim thay tai khoan");
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
  return adminUserService;
}

export type AdminUserUseCases = ReturnType<typeof createAdminUserUseCases>;
