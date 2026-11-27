import type { Logger } from "../../../shared/application/logger.port.js";
import { coordinateUpload, persistUpload, type MediaUploads } from "../../../shared/application/media-upload.js";
import type { PrivateMediaStorage } from "../../../shared/application/media-storage.port.js";
import type { TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import type { AccessTokenPayload } from "../../../shared/domain/auth.js";
import { mediaPolicy, validateImageUpload } from "../../../shared/domain/media.js";
import { maskContactInfo, normalizeVietnameseText as normalizePostText } from "../../../shared/domain/text.js";
import type { ImageUpload } from "../../../shared/domain/upload.js";
import type { MatchingRepository, MatchingUseCases } from "../../matching/application/index.js";
import { redactPrivateMatchExplanation, type MatchExplanation } from "../../matching/application/index.js";
import { canReview, postReadScope } from "../domain/post-access.js";
import { assertPostUpdateAllowed, ensureWritableStatus } from "../domain/post-policy.js";
import type {
  CreatePostInput,
  ListOwnPostsQuery,
  ListPostsQuery,
  UpdatePostInput,
  UploadMediaInput
} from "./post.dto.js";
import type { MediaKind, PostRecord, PostRepository, PostStatus, StoredMediaRecord, VisibilityMode } from "./post.repository.port.js";
import type { IllustrationUseCases } from "./illustration.use-cases.js";
import type { ImageAnalyzer } from "./image-analyzer.port.js";
import { detectSensitiveDocumentType, type SensitiveDetectionResult } from "../domain/sensitive-document-detector.js";

function canManagePost(viewer: AccessTokenPayload | undefined, post: PostRecord | StoredMediaRecord) {
  return Boolean(viewer && viewer.sub === ("userId" in post ? post.userId : post.ownerId));
}

function canSeePrivatePost(viewer: AccessTokenPayload | undefined, post: PostRecord) {
  return canManagePost(viewer, post) || canReview(viewer);
}

function canSeePrivateMedia(viewer: AccessTokenPayload | undefined, media: StoredMediaRecord) {
  return canManagePost(viewer, media) || canReview(viewer);
}

function mediaUrl(postId: string, mediaId: string) {
  return `/api/posts/${postId}/media/${mediaId}`;
}

function serializePost(post: PostRecord, viewer?: AccessTokenPayload) {
  const seesPrivate = canSeePrivatePost(viewer, post);
  const hidesPrivateDetails = post.visibilityMode === "PRIVATE_DETAILS" && !seesPrivate;
  const visibleMedia = post.media.filter((media) => {
    if (seesPrivate) return true;
    return post.visibilityMode === "PUBLIC" && media.mediaKind === "ITEM";
  });

  return {
    id: post.id,
    type: post.type,
    status: post.status,
    visibilityMode: post.visibilityMode,
    title: post.title,
    description: hidesPrivateDetails ? null : post.description,
    category: post.categoryId ? { id: post.categoryId, name: post.categoryName, icon: post.categoryIcon } : null,
    location: {
      area: post.areaId ? { id: post.areaId, name: post.areaName } : null,
      building: hidesPrivateDetails || !post.buildingId ? null : { id: post.buildingId, name: post.buildingName },
      roomText: hidesPrivateDetails ? null : post.roomText,
      customLocation: hidesPrivateDetails ? null : post.customLocation
    },
    handoverPoint: hidesPrivateDetails || !post.handoverPointId ? null : {
      id: post.handoverPointId,
      name: post.handoverPointName,
      address: post.handoverPointAddress
    },
    contactInfo: seesPrivate ? post.contactInfo : null,
    lostFoundAt: post.lostFoundAt,
    expiresAt: post.expiresAt,
    resolvedAt: post.resolvedAt,
    viewCount: post.viewCount,
    owner: { id: post.userId, fullName: post.ownerName },
    media: visibleMedia.map((media) => ({
      id: media.id,
      mediaKind: media.mediaKind,
      resourceType: media.resourceType,
      format: media.format,
      bytes: media.bytes,
      sortOrder: media.sortOrder,
      createdAt: media.createdAt,
      isAiGenerated: media.isAiGenerated === true,
      url: mediaUrl(post.id, media.id)
    })),
    canEdit: canManagePost(viewer, post),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
  };
}

function mergeForValidation(current: PostRecord, input: UpdatePostInput) {
  return {
    type: current.type,
    categoryId: input.categoryId ?? current.categoryId,
    areaId: input.areaId !== undefined ? input.areaId : current.areaId,
    buildingId: input.buildingId !== undefined ? input.buildingId : current.buildingId,
    customLocation: input.customLocation !== undefined ? input.customLocation : current.customLocation,
    handoverPointId: input.handoverPointId !== undefined ? input.handoverPointId : current.handoverPointId,
    visibilityMode: input.visibilityMode ?? current.visibilityMode
  };
}

export interface PostDependencies {
  illustrations?: Pick<IllustrationUseCases, "attach" | "publishedPost" | "closeDraft">;
  uploads?: MediaUploads;
  postRepository: PostRepository;
  matchingRepository: MatchingRepository;
  matchingService: MatchingUseCases;
  withTransaction: TransactionRunner;
  id: () => string;
  mediaStorage: PrivateMediaStorage;
  logger: Logger;
  imageAnalyzer?: ImageAnalyzer;
}
export function createPostUseCases(options: PostDependencies) {
  const { postRepository, matchingRepository, matchingService, withTransaction, id, mediaStorage } = options;

  async function ensureBusinessRefs(input: {
    type: "LOST" | "FOUND";
    categoryId?: string | null;
    areaId?: string | null;
    buildingId?: string | null;
    customLocation?: string | null;
    handoverPointId?: string | null;
    visibilityMode?: VisibilityMode;
  }) {
    if (!input.categoryId || !await postRepository.findActiveCategory(input.categoryId)) {
      throw new AppError("invalid_input", "Vui lòng chọn danh mục cụ thể thuộc một nhóm chính đang hoạt động");
    }

    if (input.areaId && !await postRepository.findActiveArea(input.areaId)) {
      throw new AppError("invalid_input", "Khu vực không hợp lệ hoặc đã bị tắt");
    }

    if (input.buildingId) {
      if (!input.areaId) throw new AppError("invalid_input", "Địa điểm cụ thể phải thuộc một khu vực");
      const building = await postRepository.findActiveBuilding(input.buildingId);
      if (!building) throw new AppError("invalid_input", "Địa điểm không hợp lệ hoặc đã bị tắt");
      if (building.areaId !== input.areaId) throw new AppError("invalid_input", "Địa điểm không thuộc khu vực đã chọn");
    }

    if (input.handoverPointId && !await postRepository.findActiveHandoverPoint(input.handoverPointId)) {
      throw new AppError("invalid_input", "Điểm bàn giao không hợp lệ hoặc đã bị tắt");
    }

    const hasLocation = Boolean(input.areaId || input.customLocation || input.handoverPointId);
    if (!hasLocation) throw new AppError("invalid_input", "Cần có khu vực, vị trí tùy chỉnh hoặc điểm bàn giao");
    if (input.type === "LOST" && input.handoverPointId) throw new AppError("invalid_input", "Bài đăng báo mất không sử dụng điểm bàn giao");
    if (input.type === "LOST" && input.visibilityMode === "PRIVATE_DETAILS") throw new AppError("invalid_input", "PRIVATE_DETAILS chi ap dung cho FOUND post");
    if (input.type === "FOUND" && !input.handoverPointId && !input.areaId && !input.customLocation) {
      throw new AppError("invalid_input", "Bài đăng nhặt được cần có điểm bàn giao hoặc nơi lưu giữ hợp lệ");
    }
  }

  async function requireOwnedPost(postId: string, ownerId: string) {
    const post = await postRepository.findOwnedById(postId, ownerId);
    if (!post) throw new AppError("not_found", "Không tìm thấy bài đăng của bạn");
    return post;
  }

  async function requireMatchAccess(postId: string, viewer: AccessTokenPayload) {
    const post = await postRepository.findVisibleById(postId);
    if (!post) throw new AppError("not_found", "Không tìm thấy bài đăng");
    if (post.userId !== viewer.sub && !canReview(viewer)) {
      throw new AppError("forbidden", "Bạn không có quyền xem kết quả matching của bài đăng này");
    }
    return post;
  }

  async function refreshMatchingBestEffort(postId: string, trigger: "create" | "update") {
    try {
      await matchingService.runForPost(postId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown matching error";
      options.logger.warn(`[matching] ${trigger} refresh failed for post ${postId}: ${message}`);
    }
  }

  function maskMatchExplanation(explanation: MatchExplanation | null): MatchExplanation | null {
    if (!explanation) return null;
    return {
      ...explanation,
      summary: maskContactInfo(explanation.summary) ?? explanation.summary,
      reasons: explanation.reasons.map((r) => maskContactInfo(r) ?? r),
      locationReason: maskContactInfo(explanation.locationReason) ?? explanation.locationReason,
      matchedTokens: explanation.matchedTokens.map((t) => maskContactInfo(t) ?? t),
      matchedOcrTokens: explanation.matchedOcrTokens.map((t) => maskContactInfo(t) ?? t),
      aiVisualAnalysis: explanation.aiVisualAnalysis
        ? {
            ...explanation.aiVisualAnalysis,
            sourceSummary: explanation.aiVisualAnalysis.sourceSummary
              ? {
                  ...explanation.aiVisualAnalysis.sourceSummary,
                  ocrText: maskContactInfo(explanation.aiVisualAnalysis.sourceSummary.ocrText) ?? null
                }
              : undefined,
            candidateSummary: explanation.aiVisualAnalysis.candidateSummary
              ? {
                  ...explanation.aiVisualAnalysis.candidateSummary,
                  ocrText: maskContactInfo(explanation.aiVisualAnalysis.candidateSummary.ocrText) ?? null
                }
              : undefined
          }
        : undefined
    };
  }

  function serializeMatchingResult(
    source: PostRecord,
    payload: Awaited<ReturnType<typeof matchingService.getStoredResults>>,
    viewer: AccessTokenPayload,
    sensitiveInfo?: SensitiveDetectionResult
  ) {
    function visibleExplanation(candidate: PostRecord, explanation: MatchExplanation | null) {
      if (!explanation) return null;
      let exp = explanation;
      const seesPrivate = canSeePrivatePost(viewer, candidate);
      if (candidate.visibilityMode === "PRIVATE_DETAILS" && !seesPrivate) {
        exp = redactPrivateMatchExplanation(exp);
      }
      if (!seesPrivate) {
        exp = maskMatchExplanation(exp)!;
      }
      return exp;
    }

    return {
      source: serializePost(source, viewer),
      matcherVersion: payload.matcherVersion,
      calculatedAt: payload.calculatedAt,
      thresholds: payload.thresholds,
      weights: payload.weights,
      total: sensitiveInfo?.isSensitive ? 0 : payload.total,
      page: payload.page,
      pageSize: payload.pageSize,
      hasMore: sensitiveInfo?.isSensitive ? false : payload.hasMore,
      isSensitiveDocument: sensitiveInfo?.isSensitive ?? false,
      documentType: sensitiveInfo?.documentType ?? undefined,
      sensitiveReason: sensitiveInfo?.sensitiveReason ?? undefined,
      results: sensitiveInfo?.isSensitive ? [] : payload.results.map(({ match, candidate }) => {
        const seesPrivate = canSeePrivatePost(viewer, candidate);
        const serializedCandidate = serializePost(candidate, viewer);
        if (!seesPrivate) {
          serializedCandidate.contactInfo = null;
          if (serializedCandidate.description) {
            serializedCandidate.description = maskContactInfo(serializedCandidate.description);
          }
        }
        return {
          matchId: match.id,
          candidate: serializedCandidate,
          totalScore: match.totalScore,
          scoreTier: match.scoreTier,
          scores: {
            text: match.textScore,
            category: match.categoryScore,
            location: match.locationScore,
            time: match.timeScore,
            image: match.imageScore,
            ocr: match.ocrScore
          },
          explanation: visibleExplanation(candidate, match.explanation),
          matcherVersion: match.matcherVersion,
          calculatedAt: match.updatedAt,
          feedback: match.feedback
        };
      })
    };
  }

  const postService = {
    getFormCatalog() {
      return postRepository.getFormCatalog();
    },

    async listBoard(filters: ListPostsQuery, viewer?: AccessTokenPayload) {
      const result = await postRepository.listBoard(filters, postReadScope(viewer));
      return { ...result, items: result.items.map((post) => serializePost(post, viewer)) };
    },

    async listMine(ownerId: string, filters: ListOwnPostsQuery) {
      const result = await postRepository.listByOwner(ownerId, filters);
      const summaries = await matchingService.listSummaries(result.items.map((post) => post.id));
      const viewer = { sub: ownerId, email: "", roles: [], sessionVersion: 0 } satisfies AccessTokenPayload;
      return {
        ...result,
        items: result.items.map((post) => ({
          ...serializePost(post, viewer),
          matchSummary: summaries.get(post.id)
        }))
      };
    },

    async getPost(postId: string, viewer?: AccessTokenPayload) {
      const post = await postRepository.findById(postId);
      if (!post) throw new AppError("not_found", "Không tìm thấy bài đăng");
      const isOwner = Boolean(viewer && viewer.sub === post.userId);
      const isReviewer = canReview(viewer);
      if (post.status === "HIDDEN" && !isOwner && !isReviewer) {
        throw new AppError("not_found", "Không tìm thấy bài đăng");
      }
      if (post.visibilityMode === "PRIVATE_DETAILS" && !isOwner && !isReviewer) {
        throw new AppError("not_found", "Không tìm thấy bài đăng");
      }
      return serializePost(post, viewer);
    },

    async createPost(ownerId: string, input: CreatePostInput, viewer: AccessTokenPayload) {
      if ((input.illustrationId || input.illustrationDraftId) && input.type !== "LOST") throw new AppError("invalid_input", "Ảnh minh họa AI chỉ dành cho bài LOST.");
      if (input.illustrationId) {
        if (!options.illustrations) throw new AppError("unavailable", "Chức năng ảnh minh họa chưa sẵn sàng.");
        const existingId = await options.illustrations.publishedPost(ownerId, input.illustrationId, input);
        if (existingId) {
          const existing = await postRepository.findOwnedById(existingId, ownerId);
          if (!existing) throw new AppError("not_found", "Bài LOST đã tạo không còn khả dụng.");
          return serializePost(existing, viewer);
        }
      }
      await ensureBusinessRefs(input);
      const postId = id();
      const sensitiveDetection = detectSensitiveDocumentType(`${input.title} ${input.description || ""}`);
      const visibilityMode: VisibilityMode = input.type === "FOUND"
        ? (input.visibilityMode ?? (sensitiveDetection.isSensitive ? "PRIVATE_DETAILS" : "PUBLIC"))
        : (sensitiveDetection.isSensitive ? "PRIVATE_DETAILS" : "PUBLIC");
      const post = await withTransaction(async (connection) => {
        await postRepository.createPost({
          id: postId,
          userId: ownerId,
          type: input.type,
          visibilityMode,
          title: input.title,
          titleNormalized: normalizePostText(input.title),
          description: input.description,
          descriptionNormalized: normalizePostText(input.description),
          categoryId: input.categoryId,
          areaId: input.areaId ?? null,
          buildingId: input.buildingId ?? null,
          roomText: input.roomText ?? null,
          customLocation: input.customLocation ?? null,
          contactInfo: input.contactInfo,
          lostFoundAt: input.lostFoundAt,
          handoverPointId: input.handoverPointId ?? null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          imageEmbedding: input.imageEmbedding ?? input.analysisSignals?.imageEmbedding ?? null
        }, connection);
        if (input.illustrationId) {
          await options.illustrations!.attach(ownerId, input.illustrationId, postId, input, connection);
        } else if (input.illustrationDraftId) {
          if (!options.illustrations) throw new AppError("unavailable", "Chức năng ảnh minh họa chưa sẵn sàng.");
          await options.illustrations.closeDraft(ownerId, input.illustrationDraftId, postId, connection);
        }
        if (input.analysisSignals && !input.illustrationId) {
          await matchingRepository.replaceAnalysisTags(postId, input.analysisSignals, connection);
        }
        const created = await postRepository.findOwnedById(postId, ownerId, connection);
        if (!created) throw new AppError("internal", "Không tạo được bài đăng");
        return created;
      });
      await refreshMatchingBestEffort(postId, "create");
      return serializePost(post, viewer);
    },

    async updatePost(postId: string, ownerId: string, input: UpdatePostInput, viewer: AccessTokenPayload) {
      const updated = await withTransaction(async (connection) => {
        const current = await postRepository.findOwnedByIdForUpdate(postId, ownerId, connection);
        if (!current) throw new AppError("not_found", "Không tìm thấy bài đăng của bạn");
        assertPostUpdateAllowed(current, input);
        if (input.status === "CLOSED" && await postRepository.hasDeletionBlockers(postId, connection)) {
          throw new AppError("conflict", "Không thể đóng bài đang có bàn giao, vật phẩm trong kho, claim, lịch hẹn, tranh chấp hoặc legal hold chưa kết thúc");
        }
        await ensureBusinessRefs(mergeForValidation(current, input));
        await postRepository.updatePost(postId, {
          title: input.title,
          titleNormalized: input.title === undefined ? undefined : normalizePostText(input.title),
          description: input.description,
          descriptionNormalized: input.description === undefined ? undefined : normalizePostText(input.description),
          categoryId: input.categoryId,
          areaId: input.areaId,
          buildingId: input.buildingId,
          roomText: input.roomText,
          customLocation: input.customLocation,
          contactInfo: input.contactInfo,
          lostFoundAt: input.lostFoundAt,
          handoverPointId: input.handoverPointId,
          visibilityMode: input.visibilityMode,
          status: input.status as PostStatus | undefined,
          resolvedAt: input.status === "RESOLVED" ? new Date() : input.status ? null : undefined
        }, connection);
        const refreshed = await postRepository.findOwnedById(postId, ownerId, connection);
        if (!refreshed) throw new AppError("internal", "Không thể cập nhật bài đăng");
        return refreshed;
      });
      if (updated.status === "OPEN" || updated.status === "MATCHED") {
        await refreshMatchingBestEffort(postId, "update");
      }
      return serializePost(updated, viewer);
    },

    async listPostMatches(postId: string, viewer: AccessTokenPayload, page = 1, pageSize = 20) {
      const source = await requireMatchAccess(postId, viewer);
      const detection = detectSensitiveDocumentType(`${source.title} ${source.description || ""} ${source.categoryName || ""}`);
      const payload = await matchingService.getStoredResults(postId, undefined, viewer.sub, page, pageSize);
      return serializeMatchingResult(source, payload, viewer, detection.isSensitive ? detection : undefined);
    },

    async recalculatePostMatches(postId: string, viewer: AccessTokenPayload, page = 1, pageSize = 20) {
      const source = await requireMatchAccess(postId, viewer);
      const detection = detectSensitiveDocumentType(`${source.title} ${source.description || ""} ${source.categoryName || ""}`);
      if (detection.isSensitive) {
        await withTransaction(async (connection) => {
          await postRepository.updatePost(postId, { visibilityMode: "PRIVATE_DETAILS" }, connection);
        });
        const payload = await matchingService.getStoredResults(postId, undefined, viewer.sub, page, pageSize);
        return serializeMatchingResult(source, payload, viewer, detection);
      }
      const payload = await matchingService.runForPost(postId, viewer.sub, page, pageSize);
      return serializeMatchingResult(source, payload, viewer);
    },

    async submitMatchFeedback(postId: string, matchId: string, viewer: AccessTokenPayload, input: { value: "USEFUL" | "IRRELEVANT" | "INCORRECT"; note?: string | null; correlationKey: string }) {
      const source = await requireMatchAccess(postId, viewer);
      if (source.userId !== viewer.sub) throw new AppError("forbidden", "Only the source owner can submit matching feedback");
      return matchingService.submitFeedback({ postId, matchId, userId: viewer.sub, ...input });
    },

    async dismissMatch(postId: string, matchId: string, viewer: AccessTokenPayload, input: { reason?: string | null; correlationKey: string }) {
      const source = await requireMatchAccess(postId, viewer);
      if (source.userId !== viewer.sub) throw new AppError("forbidden", "Only the source owner can dismiss matching suggestions");
      return matchingService.dismissSuggestion({ postId, matchId, userId: viewer.sub, ...input });
    },

    async softDeletePost(postId: string, ownerId: string) {
      await withTransaction(async connection => {
        if (!await postRepository.lockOwnedPostForDeletion(postId, ownerId, connection)) {
          throw new AppError("not_found", "Không tìm thấy bài đăng của bạn");
        }
        if (await postRepository.hasDeletionBlockers(postId, connection)) {
          throw new AppError("conflict", "Không thể xóa bài đang có bàn giao, vật phẩm trong kho, claim, lịch hẹn, tranh chấp hoặc legal hold chưa kết thúc");
        }
        if (!await postRepository.softDeletePost(postId, ownerId, connection)) {
          throw new AppError("not_found", "Không tìm thấy bài đăng của bạn");
        }
      });
    },

    async uploadMedia(postId: string, ownerId: string, input: UploadMediaInput, file: ImageUpload, viewer: AccessTokenPayload) {
      const post = await requireOwnedPost(postId, ownerId);
      ensureWritableStatus(post);
      const image = validateImageUpload(file);
      return coordinateUpload(options.uploads, ["POST", ownerId, postId, input.mediaKind, input.sortOrder ?? null], file.buffer, id, async operation => {
        const mediaId = operation.id;
        const read = () => postRepository.findMedia(postId, mediaId);
        const existing = options.uploads ? await read() : null;
        if (existing) {
          if (existing.ownerId !== ownerId) throw new AppError("conflict", "Media không thuộc người tải lên");
          await mediaStorage.resolve(existing.secureUrl, existing.format ?? image.format);
          return { id: mediaId, mediaKind: input.mediaKind, resourceType: "image", format: existing.format,
            bytes: existing.bytes, sortOrder: existing.sortOrder, url: mediaUrl(postId, mediaId), post: serializePost(post, viewer) };
        }
        const storage = await mediaStorage.save(postId, mediaId, image.extension, file.buffer);
        let mediaCount = 0;
        await persistUpload({ operation, kind: "POST", logger: options.logger,
          unreferenced: async () => await read() === null,
          matches: async () => { const row = await read(); return row?.ownerId === ownerId && row.secureUrl === storage.secureUrl; },
          remove: () => mediaStorage.remove(storage.secureUrl),
          write: () => (operation.transaction ?? withTransaction)(async (connection) => {
            const lockedPost = await postRepository.lockOwnedPostForMedia(postId, ownerId, connection);
            if (!lockedPost) throw new AppError("not_found", "Không tìm thấy bài đăng của bạn");
            ensureWritableStatus(lockedPost);
            mediaCount = await postRepository.countMedia(postId, connection);
            if (mediaCount >= mediaPolicy.maxPerPost) throw new AppError("conflict", `Mỗi bài đăng chỉ được tối đa ${mediaPolicy.maxPerPost} ảnh`);
            await postRepository.createMedia({
              id: mediaId,
              postId,
              secureUrl: storage.secureUrl,
              publicId: storage.publicId,
              mediaKind: input.mediaKind as MediaKind,
              format: image.format,
              bytes: image.bytes,
              sortOrder: input.sortOrder ?? mediaCount
            }, connection);
          })
        });
        const persisted = await read();
        if (!persisted) throw new AppError("unavailable", "Chưa thể đối soát ảnh đã lưu; vui lòng thử lại");

        if (input.mediaKind === "ITEM" && options.imageAnalyzer && postRepository.updateImageEmbedding) {
          try {
            const analysis = await options.imageAnalyzer.analyze(
              [file],
              post.type,
              post.categoryName ? [post.categoryName] : [],
              { title: post.title, description: post.description || "" }
            );
            await withTransaction(async (connection) => {
              if (analysis.imageEmbedding && analysis.imageEmbedding.length > 0) {
                await postRepository.updateImageEmbedding!(postId, analysis.imageEmbedding!, connection);
              }
              if (analysis.visualAttributes.length > 0 || analysis.visibleText.length > 0) {
                await matchingRepository.replaceAnalysisTags(postId, analysis, connection);
              }
              if (analysis.isSensitiveDocument) {
                await postRepository.updatePost(postId, { visibilityMode: "PRIVATE_DETAILS" }, connection);
              }
            });
            await refreshMatchingBestEffort(postId, "update");
          } catch (extractError) {
            options.logger.warn(`[ai-matching] failed to extract visual vector for post ${postId}: ${extractError}`);
          }
        }

        return {
          id: mediaId,
          mediaKind: input.mediaKind,
          resourceType: "image",
          format: image.format,
          bytes: image.bytes,
          sortOrder: persisted.sortOrder,
          url: mediaUrl(postId, mediaId),
          post: serializePost(post, viewer)
        };
      });
    },

    async getMediaFile(postId: string, mediaId: string, viewer?: AccessTokenPayload) {
      const media = await postRepository.findMedia(postId, mediaId);
      if (!media || media.postDeletedAt || media.postStatus === "HIDDEN") throw new AppError("not_found", "Không tìm thấy ảnh");
      const privateMedia = media.mediaKind === "EVIDENCE" || media.postVisibilityMode === "PRIVATE_DETAILS";
      if (privateMedia && !viewer) throw new AppError("unauthenticated", "Cần đăng nhập để xem ảnh này");
      if (privateMedia && !canSeePrivateMedia(viewer, media)) throw new AppError("forbidden", "Bạn không có quyền xem ảnh này");

      const resolved = await mediaStorage.resolve(media.secureUrl, media.format ?? "jpg");
      return {
        body: resolved.body,
        contentType: resolved.contentType,
        publicId: media.publicId
      };
    },

    async deleteMedia(postId: string, mediaId: string, ownerId: string) {
      const secureUrl = await withTransaction(async (connection) => {
        const media = await postRepository.findMedia(postId, mediaId, connection, true);
        if (!media || media.ownerId !== ownerId) throw new AppError("not_found", "Không tìm thấy media");
        if (media.postDeletedAt || ["RESOLVED", "CLOSED", "EXPIRED", "HIDDEN"].includes(media.postStatus)) {
          throw new AppError("conflict", "Bài đăng đã kết thúc hoặc bị ẩn, không thể xóa ảnh");
        }
        const deleted = await postRepository.deleteMedia(postId, mediaId, connection);
        if (!deleted) throw new AppError("not_found", "Không tìm thấy media");
        return media.secureUrl;
      });
      try {
        await mediaStorage.remove(secureUrl);
      } catch {
        // Metadata is already gone, so a filesystem failure can only leave an inaccessible orphan for later cleanup.
        options.logger.warn(`[media] local file cleanup failed after deleting media ${mediaId}`);
      }
    }
  };
  return postService;
}

export type PostUseCases = ReturnType<typeof createPostUseCases>;
