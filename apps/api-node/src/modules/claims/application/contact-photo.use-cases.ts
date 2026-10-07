import { AppError } from "../../../shared/domain/app-error.js";
import { validateImageUpload } from "../../../shared/domain/media.js";
import type { ImageUpload } from "../../../shared/domain/upload.js";
import type { PrivateMediaStorage } from "../../../shared/application/media-storage.port.js";
import { coordinateUpload, persistUpload, type MediaUploads } from "../../../shared/application/media-upload.js";
import type { Logger } from "../../../shared/application/logger.port.js";
import type { TransactionContext, TransactionRunner } from "../../../shared/application/transaction.js";
import { scoreContactPhoto, type MatchingRepository } from "../../matching/application/index.js";
import type { ImageAnalysisUseCases } from "../../posts/application/index.js";
import { CONTACT_PHOTO_MINIMUM_SCORE, contactPhotoQuestions } from "../domain/contact-photo-questions.js";
import type { ClaimRepository } from "./claim.repository.port.js";
import type { ContactPhotoRepository } from "./contact-photo.repository.port.js";

export function createContactPhotoUseCases(options: { repository: ContactPhotoRepository; claims: ClaimRepository;
  matching: MatchingRepository; imageAnalysis: ImageAnalysisUseCases; authorizeTarget: (postId: string) => Promise<unknown>;
  mediaStorage: PrivateMediaStorage; transaction: TransactionRunner; id: () => string; uploads?: MediaUploads; logger?: Logger }) {
  const { repository, claims, mediaStorage, transaction } = options;
  async function eligible(checkId: string | undefined, postId: string, actorId: string, db: TransactionContext, claimId?: string) {
    if (!checkId) throw new AppError("conflict", "Cần tải ảnh và đạt mức tương đồng từ 50% trước khi liên hệ bài LOST");
    const revision = await repository.revision(postId,db);
    const check = await repository.lock(checkId,db);
    if (!check || !revision || check.actorId !== actorId || check.postId !== postId || !(check.score >= CONTACT_PHOTO_MINIMUM_SCORE)
      || check.postRevision !== revision || (check.claimId ? check.claimId !== claimId : Date.parse(check.expiresAt) <= Date.now())) {
      throw new AppError("conflict", "Kiểm tra ảnh không hợp lệ, hết hạn hoặc thuộc cuộc trao đổi khác; vui lòng kiểm tra lại ảnh");
    }
    return check;
  }
  const service = {
    async analyze(postId: string, actorId: string, file: ImageUpload) {
      const image = validateImageUpload(file);
      if (image.bytes > 5*1024*1024) throw new AppError("payload_too_large", "Ảnh liên hệ không được vượt quá 5 MB");
      await options.authorizeTarget(postId);
      const target = await options.matching.findCandidate(postId);
      const revision = await repository.revision(postId);
      if (!target || !revision || target.type !== "LOST" || target.userId === actorId) throw new AppError("conflict", "Chỉ kiểm tra ảnh khi liên hệ bài LOST của người khác đang mở");
      return coordinateUpload(options.uploads, ["CONTACT", actorId, postId, revision], file.buffer, options.id, async operation => {
        const existing = options.uploads ? await repository.findById(operation.id) : null;
        if (existing) {
          if (existing.actorId !== actorId || existing.postId !== postId || existing.postRevision !== revision || !(existing.score >= CONTACT_PHOTO_MINIMUM_SCORE)
            || Date.parse(existing.expiresAt) <= Date.now()) throw new AppError("conflict", "Kiểm tra ảnh đã hết hạn; vui lòng kiểm tra lại ảnh sau khi dọn bản nháp");
          await mediaStorage.resolve(existing.storageRef, existing.format);
          return { checkId: existing.id, approved: true, score: existing.score, expiresAt: existing.expiresAt,
            questions: [] };
        }
        const analysis = await options.imageAnalysis.analyzePostImages([file],"FOUND");
        const score = Math.floor(scoreContactPhoto(target,{ ...analysis, categoryId: analysis.suggestedCategory?.id ?? null }) * 100000) / 100000;
        const approved = score >= CONTACT_PHOTO_MINIMUM_SCORE && analysis.confidence >= .6;
        const questions = contactPhotoQuestions(analysis);
        if (!approved) return { checkId: null, approved: false, score, expiresAt: null, questions: [] };
        const checkId = operation.id;
        const saved = await mediaStorage.save(actorId,checkId,image.extension,file.buffer);
        const expiresAt = new Date(Date.now()+30*60000).toISOString();
        await persistUpload({ operation, kind: "CONTACT", logger: options.logger,
          unreferenced: async () => await repository.findById(checkId) === null,
          matches: async () => { const row = await repository.findById(checkId); return row?.actorId === actorId && row.postId === postId && row.storageRef === saved.secureUrl; },
          remove: () => mediaStorage.remove(saved.secureUrl),
          write: () => (operation.transaction ?? transaction)(async db => {
            if (await repository.revision(postId,db) !== revision) throw new AppError("conflict", "Bài LOST đã thay đổi; vui lòng kiểm tra lại ảnh");
            await repository.create({ id: checkId, actorId, postId, postRevision: revision, score, model: analysis.model, storageRef: saved.secureUrl,
              publicId: saved.publicId, format: image.format, bytes: image.bytes, expiresAt },db);
          })
        });
        return { checkId, approved: true, score, expiresAt, questions };
      });
    },
    requireEligible: eligible,
    async attach(checkId: string | undefined, postId: string, actorId: string, claimId: string, db: TransactionContext) {
      const check = await eligible(checkId,postId,actorId,db,claimId);
      if (check.claimId) return;
      await claims.createEvidence({ id: check.id, claimId, uploadedBy: actorId, secureUrl: check.storageRef, publicId: check.publicId,
        mediaFormat: check.format, mediaBytes: check.bytes, description: "Ảnh đối chiếu trước liên hệ LOST; không phải xác minh quyền sở hữu" },db);
      const room = await claims.findRoomByClaim(claimId, db);
      if (!room) throw new AppError("conflict", "Phòng trao đổi chưa được mở");
      const message = await claims.createMessage({ roomId: room.id, senderId: actorId, content: "Ảnh vật phẩm đã đối chiếu để trao đổi",
        mediaUrl: `/api/claims/${claimId}/evidence/${check.id}`, clientMessageId: `contact-photo:${check.id}` }, db);
      if (!message) throw new AppError("internal", "Không thể đính kèm ảnh vào cuộc trò chuyện");
      await repository.consume(check.id,claimId,db);
      await claims.writeAudit({ claimId, actorId, action: "CONTACT_PHOTO_MATCHED", metadata: { score: check.score, model: check.model, evidenceId: check.id, purpose: "COMMUNICATION_ONLY" } },db);
    },
    async state(claimId: string, actorId: string, db?: TransactionContext) {
      const target = await repository.conversation(claimId, db);
      if (!target || target.type !== "LOST") return null;
      const required = target.ownerId !== actorId;
      const approved = !required || await repository.hasApproval(claimId,actorId, db);
      return { required, approved, postId: target.postId, questions: [] };
    },
    async requireSender(claimId: string, actorId: string, db: TransactionContext) {
      const target = await repository.conversation(claimId,db);
      if (target?.type === "LOST" && target.ownerId !== actorId && !await repository.hasApproval(claimId,actorId,db)) throw new AppError("conflict", "Cần kiểm tra ảnh từ 50% trước khi gửi tin nhắn trong trao đổi LOST");
    },
    async cleanupExpired() {
      await transaction(async db => {
        for (const check of await repository.expiredDrafts(db)) {
          await mediaStorage.remove(check.storageRef);
          await repository.deleteDraft(check.id,db);
        }
      });
    }
  };
  return service;
}
export type ContactPhotoUseCases = ReturnType<typeof createContactPhotoUseCases>;
