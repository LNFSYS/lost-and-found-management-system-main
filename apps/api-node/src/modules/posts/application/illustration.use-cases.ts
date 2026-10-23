import type { TransactionContext, TransactionRunner } from "../../../shared/application/transaction.js";
import type { PrivateMediaStorage } from "../../../shared/application/media-storage.port.js";
import { AppError } from "../../../shared/domain/app-error.js";
import { validateImageUpload } from "../../../shared/domain/media.js";
import { retrieveIllustrationContext } from "../domain/illustration-context.js";
import type { PostRepository } from "./post.repository.port.js";
import type { IllustrationAttempt, IllustrationInput, IllustrationModel, IllustrationRepository } from "./illustration.port.js";

type PostDescription = Pick<IllustrationInput, "title" | "description" | "categoryId">;
export function createIllustrationUseCases(options: {
  repository: IllustrationRepository; posts: Pick<PostRepository, "getFormCatalog" | "createMedia">;
  model: IllustrationModel; storage: PrivateMediaStorage; transaction: TransactionRunner;
  id: () => string; hash: (value: string) => string;
}) {
  const { repository, posts, model, storage, transaction, id } = options;
  const hash = (input: PostDescription) => options.hash(JSON.stringify([input.categoryId, input.title.trim(), input.description.trim()]));
  function publicAttempt(attempt: IllustrationAttempt) {
    return { id: attempt.id, number: attempt.number, status: attempt.status, title: attempt.title,
      description: attempt.description, categoryId: attempt.categoryId,
      url: attempt.status === "READY" ? `/api/posts/illustrations/${attempt.id}/image` : null };
  }
  async function state(userId: string) {
    if (!model.available) return { available: false, id: null, used: 0, maxAttempts: 4, remaining: 4, attempts: [] };
    const draft = await repository.draft(userId);
    return { available: true, id: draft?.id ?? null, used: draft?.used ?? 0, maxAttempts: 4,
      remaining: 4 - (draft?.used ?? 0), attempts: (draft?.attempts ?? []).map(publicAttempt), cooldown: model.cooldown ?? null };
  }
  return {
    state,
    async generate(userId: string, input: IllustrationInput) {
      if (!model.available) throw new AppError("unavailable", "Tạo ảnh minh họa chưa được cấu hình. Bạn vẫn có thể đăng bài hoặc tải ảnh thật lên.");
      const inputHash = hash(input);
      const replay = await repository.findRequest(userId, input.requestId);
      if (replay) {
        if (replay.inputHash !== inputHash) throw new AppError("conflict", "Mã yêu cầu đã được dùng cho một mô tả khác.");
        return { attempt: publicAttempt(replay), draft: await state(userId) };
      }
      const catalog = await posts.getFormCatalog();
      const category = catalog.categories.find(item => item.id === input.categoryId && item.parentId);
      if (!category) throw new AppError("invalid_input", "Vui lòng chọn danh mục vật phẩm đang hoạt động.");
      const context = retrieveIllustrationContext(category.name, input.description);
      if (!context) throw new AppError("invalid_input", "Mô tả chưa khớp danh mục vật bị mất. Hãy nêu rõ vật phẩm, màu sắc và đặc điểm nhận dạng.");
      const draft = await repository.draft(userId);
      if (draft && draft.used >= 4) throw new AppError("conflict", "Bạn đã dùng hết 1 lượt tạo và 3 lượt tạo lại cho bản nháp này.");
      const spec = await model.describe(input, context);
      if (!spec) throw new AppError("invalid_input", "Chỉ có thể tạo ảnh một vật bị mất từ đặc điểm cụ thể. Vui lòng bỏ yêu cầu không liên quan và bổ sung mô tả.");
      const reservation = await transaction(db => repository.reserve(userId, input, inputHash, { draft: id(), attempt: id() }, db));
      const attempt = reservation.attempt;
      if (attempt.inputHash !== inputHash) throw new AppError("conflict", "Mã yêu cầu đã được dùng cho một mô tả khác.");
      if (reservation.fresh) {
        let saving = false;
        try {
          const image = await model.generate(spec, context);
          const validated = validateImageUpload(image);
          if (!await model.verify(image, spec, context)) {
            await repository.finish(attempt.id, "REJECTED");
          } else {
            saving = true;
            const asset = await storage.save(attempt.draftId, attempt.id, validated.extension, image.buffer);
            const finished = await repository.finish(attempt.id, "READY", {
              storageRef: asset.secureUrl, publicId: asset.publicId, format: validated.format, bytes: validated.bytes
            });
            if (!finished) throw new AppError("conflict", "Lượt tạo ảnh đã hết thời gian. Vui lòng kiểm tra lại trạng thái.");
          }
        } catch (error) {
          // A failed storage/database acknowledgement may still have committed the asset.
          // Retain it for reconciliation; never delete or invoke generation twice on replay.
          if (!saving) await repository.finish(attempt.id, "FAILED");
          throw error;
        }
      }
      const result = await repository.findAttempt(userId, attempt.id);
      if (!result) throw new AppError("unavailable", "Chưa đối soát được ảnh minh họa. Vui lòng kiểm tra lại trạng thái.");
      return { attempt: publicAttempt(result), draft: await state(userId) };
    },
    async image(userId: string, attemptId: string) {
      const attempt = await repository.findAttempt(userId, attemptId);
      if (!attempt || attempt.status !== "READY" || !attempt.storageRef) throw new AppError("not_found", "Không tìm thấy ảnh minh họa.");
      return storage.resolve(attempt.storageRef, attempt.format ?? "png");
    },
    async attach(userId: string, attemptId: string, postId: string, input: PostDescription, db: TransactionContext) {
      const attempt = await repository.consume(userId, attemptId, postId, hash(input), db);
      if (!attempt.storageRef || !attempt.publicId || !attempt.format || attempt.bytes === null) throw new AppError("conflict", "Ảnh minh họa chưa sẵn sàng.");
      await posts.createMedia({ id: attempt.id, postId, secureUrl: attempt.storageRef, publicId: attempt.publicId,
        format: attempt.format, bytes: attempt.bytes, sortOrder: 0, mediaKind: "ITEM", isAiGenerated: true }, db);
    },
    async publishedPost(userId: string, attemptId: string, input: PostDescription) {
      const attempt = await repository.findAttempt(userId, attemptId);
      return attempt?.postId && attempt.selectedAttemptId === attemptId && attempt.inputHash === hash(input) ? attempt.postId : null;
    },
    closeDraft(userId: string, draftId: string, postId: string, db: TransactionContext) {
      return repository.closeDraft(userId, draftId, postId, db);
    }
  };
}
export type IllustrationUseCases = ReturnType<typeof createIllustrationUseCases>;
