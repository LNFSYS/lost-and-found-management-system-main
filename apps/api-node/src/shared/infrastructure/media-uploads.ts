import { createHash } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { MediaUploads } from "../application/media-upload.js";
import { AppError } from "../domain/app-error.js";
import { runInTransaction } from "./config/db.js";
import { createTransactionRunner } from "./transaction-context.js";
import type { Logger } from "../application/logger.port.js";
import { transactionWasRolledBack } from "../application/transaction.js";

export function uploadIdentity(scope: string, bytes: Buffer) {
  const hex = createHash("sha256").update(scope).update("\0").update(bytes).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export function createMediaUploads(pool: Pool, logger: Logger & { info?: (message: string) => void } = console): MediaUploads {
  // Keep room for ordinary requests while slow provider uploads hold a connection.
  let running = 0;
  const waiting: Array<() => void> = [];
  return {
    async run(scope, bytes, work) {
      if (running >= 2) {
        if (waiting.length >= 20) throw new AppError("unavailable", "Upload queue is full; please retry");
        await new Promise<void>(resolve => waiting.push(resolve));
      } else running++;
      let connection;
      const id = uploadIdentity(scope, bytes);
      let kind = "MEDIA";
      try { const value: unknown = JSON.parse(scope); if (Array.isArray(value) && ["INTAKE", "PROOF", "POST", "EVIDENCE", "CONTACT", "AVATAR"].includes(value[0])) kind = value[0]; }
      catch { /* Opaque scopes are allowed; never log their contents. */ }
      const lock = `lnfs:upload:${createHash("sha256").update(scope).digest("hex").slice(0, 40)}`;
      try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute<RowDataPacket[]>({ sql: "SELECT GET_LOCK(?, 10) AS acquired", timeout: 15000 }, [lock]);
        if (Number(rows[0]?.acquired) !== 1) throw new AppError("unavailable", "Upload is already being processed; please retry");
        const held = connection;
        logger.info?.(JSON.stringify({ event: "media_upload_started", kind, operationId: id }));
        const result = await work({ id, transaction: createTransactionRunner(work => runInTransaction(held, work)), canCompensate: async () => {
          const [owners] = await held.execute<RowDataPacket[]>({ sql: "SELECT IS_USED_LOCK(?) = CONNECTION_ID() AS owned", timeout: 5000 }, [lock]);
          return Number(owners[0]?.owned) === 1;
        } });
        logger.info?.(JSON.stringify({ event: "media_upload_completed", kind, operationId: id }));
        return result;
      } catch (error) {
        logger.warn(JSON.stringify({ event: "media_upload_operation_failed", kind, operationId: id,
          outcome: transactionWasRolledBack(error) ? "ROLLED_BACK" : "REVIEW_REQUIRED" }));
        throw error;
      } finally {
        if (connection) {
          try { await connection.execute({ sql: "SELECT RELEASE_LOCK(?)", timeout: 5000 }, [lock]); }
          catch { connection.destroy(); }
          connection.release();
        }
        const next = waiting.shift();
        if (next) next(); else running--;
      }
    }
  };
}
