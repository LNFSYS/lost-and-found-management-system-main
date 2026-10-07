import type { Logger } from "./logger.port.js";
import { transactionWasRolledBack } from "./transaction.js";
import type { TransactionRunner } from "./transaction.js";

export interface UploadOperation {
  id: string;
  canCompensate: () => Promise<boolean>;
  transaction?: TransactionRunner;
}

export interface MediaUploads {
  run<T>(scope: string, bytes: Buffer, work: (operation: UploadOperation) => Promise<T>): Promise<T>;
}

export function coordinateUpload<T>(uploads: MediaUploads | undefined, scope: unknown[], bytes: Buffer,
  id: () => string, work: (operation: UploadOperation) => Promise<T>) {
  return uploads ? uploads.run(JSON.stringify(scope), bytes, work) : work({ id: id(), canCompensate: async () => true });
}

export async function persistUpload(options: {
  operation: UploadOperation;
  write: () => Promise<unknown>;
  matches: () => Promise<boolean>;
  unreferenced: () => Promise<boolean>;
  remove: () => Promise<void>;
  logger?: Logger;
  kind: string;
  timeoutMs?: number;
}) {
  try { await options.write(); }
  catch (error) {
    async function boundedRead(read: () => Promise<boolean>) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { return await Promise.race([read(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Media reconciliation timeout")), options.timeoutMs ?? 5000);
      })]); }
      finally { if (timer) clearTimeout(timer); }
    }
    let matched: boolean | undefined;
    try {
      matched = await boundedRead(options.matches);
    } catch { /* An unavailable read is not evidence of rollback. */ }
    if (matched) return;
    if (matched === false && transactionWasRolledBack(error) && await boundedRead(options.operation.canCompensate).catch(() => false)
      && await boundedRead(options.unreferenced).catch(() => false)) {
      try { await options.remove(); }
      catch { options.logger?.warn(JSON.stringify({ event: "media_upload_cleanup_required", kind: options.kind, operationId: options.operation.id })); }
    } else {
      options.logger?.warn(JSON.stringify({ event: "media_upload_review_required", kind: options.kind, operationId: options.operation.id }));
    }
    throw error;
  }
}
