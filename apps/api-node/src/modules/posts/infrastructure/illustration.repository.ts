import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type { IllustrationAttempt, IllustrationRepository } from "../application/illustration.port.js";

const selectAttempt = `SELECT a.*, d.post_id, d.selected_attempt_id FROM lost_illustration_attempts a
  INNER JOIN lost_illustration_drafts d ON d.id = a.draft_id`;
function map(row: RowDataPacket): IllustrationAttempt {
  return { id: row.id, draftId: row.draft_id, number: Number(row.attempt_number), status: row.status,
    inputHash: row.input_hash, categoryId: row.category_id, title: row.title, description: row.description,
    storageRef: row.storage_ref, publicId: row.public_id, format: row.format, bytes: row.bytes === null ? null : Number(row.bytes),
    postId: row.post_id, selectedAttemptId: row.selected_attempt_id };
}
export function createIllustrationRepository(pool: SqlExecutor): IllustrationRepository {
  async function expirePending(userId: string, executor = pool) {
    await executor.execute(`UPDATE lost_illustration_attempts SET status = 'FAILED', finished_at = UTC_TIMESTAMP(6)
      WHERE user_id = ? AND status = 'PENDING' AND created_at <= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 5 MINUTE)`, [userId]);
  }
  async function findAttempt(userId: string, attemptId: string, db?: TransactionContext) {
    const [rows] = await sqlExecutor(db ?? pool).execute<RowDataPacket[]>(`${selectAttempt} WHERE a.user_id = ? AND a.id = ?`, [userId, attemptId]);
    return rows[0] ? map(rows[0]) : null;
  }
  return {
    async draft(userId) {
      await expirePending(userId);
      const [rows] = await pool.execute<RowDataPacket[]>("SELECT id, attempts_used FROM lost_illustration_drafts WHERE active_owner_id = ?", [userId]);
      if (!rows[0]) return null;
      const [attempts] = await pool.execute<RowDataPacket[]>(`${selectAttempt} WHERE a.draft_id = ? AND a.user_id = ? ORDER BY a.attempt_number`, [rows[0].id, userId]);
      return { id: rows[0].id, used: Number(rows[0].attempts_used), attempts: attempts.map(map) };
    },
    async findRequest(userId, requestId) {
      await expirePending(userId);
      const [rows] = await pool.execute<RowDataPacket[]>(`${selectAttempt} WHERE a.user_id = ? AND a.request_id = ?`, [userId, requestId]);
      return rows[0] ? map(rows[0]) : null;
    },
    findAttempt,
    async reserve(userId, input, inputHash, ids, db) {
      const executor = sqlExecutor(db);
      // Serialize across processes using the existing owner row, including first draft creation.
      await executor.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [userId]);
      await expirePending(userId, executor);
      const [replays] = await executor.execute<RowDataPacket[]>(`${selectAttempt} WHERE a.user_id = ? AND a.request_id = ?`, [userId, input.requestId]);
      if (replays[0]) return { fresh: false, attempt: map(replays[0]) };
      const [drafts] = await executor.execute<RowDataPacket[]>("SELECT id, attempts_used FROM lost_illustration_drafts WHERE active_owner_id = ? FOR UPDATE", [userId]);
      const draftId = drafts[0]?.id ?? ids.draft;
      const used = Number(drafts[0]?.attempts_used ?? 0);
      if (used >= 4) throw new AppError("conflict", "Bạn đã dùng hết 1 lượt tạo và 3 lượt tạo lại cho bản nháp này.");
      if (!drafts[0]) await executor.execute("INSERT INTO lost_illustration_drafts (id, user_id, active_owner_id) VALUES (?, ?, ?)", [draftId, userId, userId]);
      const [pending] = await executor.execute<RowDataPacket[]>("SELECT id FROM lost_illustration_attempts WHERE draft_id = ? AND status = 'PENDING' LIMIT 1", [draftId]);
      if (pending.length) throw new AppError("conflict", "Một ảnh đang được tạo. Vui lòng đợi hoặc kiểm tra lại trạng thái.");
      await executor.execute("UPDATE lost_illustration_drafts SET attempts_used = attempts_used + 1 WHERE id = ?", [draftId]);
      await executor.execute(`INSERT INTO lost_illustration_attempts (id,draft_id,user_id,request_id,attempt_number,input_hash,category_id,title,description)
        VALUES (?,?,?,?,?,?,?,?,?)`, [ids.attempt, draftId, userId, input.requestId, used + 1, inputHash, input.categoryId, input.title, input.description]);
      return { fresh: true, attempt: { id: ids.attempt, draftId, number: used + 1, status: "PENDING", inputHash,
        categoryId: input.categoryId, title: input.title, description: input.description, storageRef: null, publicId: null, format: null, bytes: null, postId: null, selectedAttemptId: null } };
    },
    async finish(attemptId, status, asset) {
      const [result] = await pool.execute<ResultSetHeader>(`UPDATE lost_illustration_attempts
        SET status=?, storage_ref=?, public_id=?, format=?, bytes=?, finished_at=UTC_TIMESTAMP(6)
        WHERE id=? AND status='PENDING' AND created_at > DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 5 MINUTE)`,
      [status, asset?.storageRef ?? null, asset?.publicId ?? null, asset?.format ?? null, asset?.bytes ?? null, attemptId]);
      return result.affectedRows === 1;
    },
    async consume(userId, attemptId, postId, inputHash, db) {
      const executor = sqlExecutor(db);
      const [rows] = await executor.execute<RowDataPacket[]>(`${selectAttempt} WHERE a.user_id = ? AND a.id = ? FOR UPDATE`, [userId, attemptId]);
      const attempt = rows[0] ? map(rows[0]) : null;
      if (!attempt || attempt.status !== "READY" || attempt.postId || attempt.inputHash !== inputHash) {
        throw new AppError("invalid_input", "Ảnh minh họa không thuộc bản nháp này hoặc mô tả đã thay đổi. Vui lòng chọn lại ảnh phù hợp.");
      }
      await executor.execute("UPDATE lost_illustration_drafts SET post_id=?, selected_attempt_id=?, active_owner_id=NULL WHERE id=? AND active_owner_id=?", [postId, attemptId, attempt.draftId, userId]);
      return attempt;
    },
    async closeDraft(userId, draftId, postId, db) {
      const executor = sqlExecutor(db);
      const [rows] = await executor.execute<RowDataPacket[]>("SELECT id FROM lost_illustration_drafts WHERE id=? AND active_owner_id=? FOR UPDATE", [draftId, userId]);
      if (!rows.length) throw new AppError("invalid_input", "Bản nháp ảnh minh họa không còn khả dụng.");
      const [pending] = await executor.execute<RowDataPacket[]>("SELECT id FROM lost_illustration_attempts WHERE draft_id=? AND status='PENDING' LIMIT 1", [draftId]);
      if (pending.length) throw new AppError("conflict", "Vui lòng đợi ảnh minh họa hoàn tất trước khi đăng bài.");
      await executor.execute("UPDATE lost_illustration_drafts SET post_id=?, active_owner_id=NULL WHERE id=?", [postId, draftId]);
    }
  };
}
