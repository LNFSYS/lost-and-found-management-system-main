import type { TransactionContext } from "../../../shared/application/transaction.js";

export interface ContactPhotoCheck {
  id: string; actorId: string; postId: string; postRevision: string; score: number; model: string;
  storageRef: string; publicId: string; format: string; bytes: number; expiresAt: string; claimId: string | null;
}
export interface ContactPhotoRepository {
  findById(id: string): Promise<ContactPhotoCheck | null>;
  revision(postId: string, db?: TransactionContext): Promise<string | null>;
  create(input: Omit<ContactPhotoCheck,"claimId">, db: TransactionContext): Promise<void>;
  lock(id: string, db: TransactionContext): Promise<ContactPhotoCheck | null>;
  consume(id: string, claimId: string, db: TransactionContext): Promise<void>;
  conversation(claimId: string, db?: TransactionContext): Promise<{ postId: string; ownerId: string; type: "LOST" | "FOUND"; categoryName: string; parentName: string | null } | null>;
  hasApproval(claimId: string, actorId: string, db?: TransactionContext): Promise<boolean>;
  expiredDrafts(db: TransactionContext): Promise<ContactPhotoCheck[]>;
  deleteDraft(id: string, db: TransactionContext): Promise<void>;
}
