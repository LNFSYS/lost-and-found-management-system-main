import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { ActivitySummary, Role, User } from "../../../shared/domain/auth.js";

export interface UserRepository {
  findByEmail(normalizedEmail: string, connection?: TransactionContext): Promise<(User & {
    sessionVersion: number;
  }) | null>;
  findAuthByEmail(normalizedEmail: string, connection?: TransactionContext): Promise<{
    user: User & {
      sessionVersion: number;
    };
    passwordHash: string;
  } | null>;
  findById(id: string, connection?: TransactionContext): Promise<(User & {
    sessionVersion: number;
  }) | null>;
  create(input: {
    id: string;
    email: string;
    normalizedEmail: string;
    passwordHash: string;
    fullName: string;
    studentCode?: string;
    phoneNumber?: string;
  }, connection: TransactionContext): Promise<void>;
  assignRole(userId: string, role: Role, connection: TransactionContext): Promise<void>;
  updateProfile(userId: string, input: {
    fullName?: string;
    studentCode?: string | null;
    phoneNumber?: string | null;
  }): Promise<(User & {
    sessionVersion: number;
  }) | null>;
  findAvatarById(userId: string, connection?: TransactionContext): Promise<{
    publicId: string;
    assetId: string | null;
    version: number;
    format: string;
    resourceType: "image";
    size: number;
    updatedAt: string | null;
  } | null>;
  updateAvatar(userId: string, input: {
    publicId: string;
    assetId: string | null;
    version: number;
    format: string;
    resourceType: "image";
    size: number;
  }): Promise<(User & {
    sessionVersion: number;
  }) | null>;
  getActivitySummary(userId: string): Promise<ActivitySummary>;
  updateLastLogin(userId: string): Promise<void>;
  updatePasswordAndInvalidateSessions(userId: string, passwordHash: string, connection: TransactionContext): Promise<void>;
}
