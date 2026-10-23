import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { ImageUpload } from "../../../shared/domain/upload.js";
import type { IllustrationContext } from "../domain/illustration-context.js";

export interface IllustrationInput { title: string; description: string; categoryId: string; requestId: string; }
export interface IllustrationSpec { item: string; color: string; material: string; shape: string; details: string[]; }
export interface IllustrationModel {
  readonly available: boolean;
  readonly cooldown?: { until: number; message: string } | null;
  describe(input: IllustrationInput, context: IllustrationContext): Promise<IllustrationSpec | null>;
  generate(spec: IllustrationSpec, context: IllustrationContext): Promise<ImageUpload>;
  verify(image: ImageUpload, spec: IllustrationSpec, context: IllustrationContext): Promise<boolean>;
}
export interface IllustrationAttempt {
  id: string; draftId: string; number: number; status: "PENDING" | "READY" | "REJECTED" | "FAILED";
  inputHash: string; categoryId: string; title: string; description: string;
  storageRef: string | null; publicId: string | null; format: string | null; bytes: number | null;
  postId: string | null; selectedAttemptId: string | null;
}
export interface IllustrationDraft { id: string; used: number; attempts: IllustrationAttempt[]; }
export interface IllustrationRepository {
  draft(userId: string): Promise<IllustrationDraft | null>;
  findRequest(userId: string, requestId: string): Promise<IllustrationAttempt | null>;
  findAttempt(userId: string, attemptId: string, db?: TransactionContext): Promise<IllustrationAttempt | null>;
  reserve(userId: string, input: IllustrationInput, inputHash: string, ids: { draft: string; attempt: string }, db: TransactionContext): Promise<{ fresh: boolean; attempt: IllustrationAttempt }>;
  finish(attemptId: string, status: "READY" | "REJECTED" | "FAILED", asset?: { storageRef: string; publicId: string; format: string; bytes: number }): Promise<boolean>;
  consume(userId: string, attemptId: string, postId: string, inputHash: string, db: TransactionContext): Promise<IllustrationAttempt>;
  closeDraft(userId: string, draftId: string, postId: string, db: TransactionContext): Promise<void>;
}
