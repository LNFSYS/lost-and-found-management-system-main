import type { Express } from "express";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { withTransaction } from "../config/db.js";
import { env } from "../config/env.js";
import type { AccessTokenPayload } from "../types/auth.js";
import { HttpError } from "../utils/http-error.js";
import { id } from "../utils/security.js";
import { mediaContentType, mediaPolicy, validateImageUpload } from "../utils/media.js";
import { ensureStoredFileExists, removeStoredFileIfPresent } from "../utils/media-storage.js";
import {
  normalizePostText,
  postRepository,
  type MediaKind,
  type PostRecord,
  type PostStatus,
  type StoredMediaRecord,
  type VisibilityMode
} from "../repositories/post.repository.js";
import { matchingRepository } from "../repositories/matching.repository.js";
import { matchingService } from "./matching.service.js";
import { redactPrivateMatchExplanation, type MatchExplanation } from "./matching.engine.js";
import type {
  CreatePostInput,
  ListOwnPostsQuery,
  ListPostsQuery,
  UpdatePostInput,
  UploadMediaInput
} from "../validators/post.validator.js";

const privateMediaPrefix = "private://post-media/";
const mediaRoot = path.resolve(env.uploadDir, "post-media");

function canReview(viewer?: AccessTokenPayload) {
  return Boolean(viewer?.roles.some((role) => role === "STAFF" || role === "ADMIN"));
}

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
      url: mediaUrl(post.id, media.id)
    })),
    canEdit: canManagePost(viewer, post),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
  };
}

const postTransitions: Record<PostStatus, readonly PostStatus[]> = {
  OPEN: ["OPEN", "CLOSED", "RESOLVED"],
  MATCHED: ["MATCHED", "CLOSED", "RESOLVED"],
  RESOLVED: ["RESOLVED"],
  CLOSED: ["CLOSED"],
  EXPIRED: ["EXPIRED"],
  HIDDEN: ["HIDDEN"]
};

export function assertPostUpdateAllowed(current: Pick<PostRecord, "status">, input: Pick<UpdatePostInput, "status" | "title" | "description" | "categoryId" | "areaId" | "buildingId" | "roomText" | "customLocation" | "contactInfo" | "lostFoundAt" | "handoverPointId" | "visibilityMode">) {
  const contentFields = ["title", "description", "categoryId", "areaId", "buildingId", "roomText", "customLocation", "contactInfo", "lostFoundAt", "handoverPointId", "visibilityMode"] as const;
  const changesContent = contentFields.some((field) => input[field] !== undefined);
  const nextStatus = input.status ?? current.status;
  if (changesContent && ["RESOLVED", "CLOSED", "EXPIRED", "HIDDEN"].includes(current.status)) {
    throw new HttpError(409, "Bai dang da ket thuc, khong the cap nhat noi dung");
  }
  if (!postTransitions[current.status].includes(nextStatus)) {
    throw new HttpError(409, "Chuyen trang thai bai dang khong hop le");
  }
}

function ensureWritableStatus(post: Pick<PostRecord, "status">) {
  if (post.status === "RESOLVED" || post.status === "CLOSED" || post.status === "EXPIRED") {
    throw new HttpError(409, "Bai dang da ket thuc, khong the cap nhat noi dung");
  }
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
    throw new HttpError(422, "Vui long chon danh muc cu the thuoc mot nhom chinh dang hoat dong");
  }

  if (input.areaId && !await postRepository.findActiveArea(input.areaId)) {
    throw new HttpError(422, "Khu vuc khong hop le hoac da bi tat");
  }

  if (input.buildingId) {
    if (!input.areaId) throw new HttpError(422, "Dia diem cu the phai thuoc mot khu vuc");
    const building = await postRepository.findActiveBuilding(input.buildingId);
    if (!building) throw new HttpError(422, "Dia diem khong hop le hoac da bi tat");
    if (building.areaId !== input.areaId) throw new HttpError(422, "Dia diem khong thuoc khu vuc da chon");
  }

  if (input.handoverPointId && !await postRepository.findActiveHandoverPoint(input.handoverPointId)) {
    throw new HttpError(422, "Diem ban giao khong hop le hoac da bi tat");
  }

  const hasLocation = Boolean(input.areaId || input.customLocation || input.handoverPointId);
  if (!hasLocation) throw new HttpError(422, "Can co khu vuc, vi tri tuy chinh hoac diem ban giao");
  if (input.type === "LOST" && input.handoverPointId) throw new HttpError(422, "LOST post khong dung diem ban giao");
  if (input.type === "LOST" && input.visibilityMode === "PRIVATE_DETAILS") throw new HttpError(422, "PRIVATE_DETAILS chi ap dung cho FOUND post");
  if (input.type === "FOUND" && !input.handoverPointId && !input.areaId && !input.customLocation) {
    throw new HttpError(422, "FOUND can diem ban giao hoac noi luu giu hop le");
  }
}

async function requireOwnedPost(postId: string, ownerId: string) {
  const post = await postRepository.findOwnedById(postId, ownerId);
  if (!post) throw new HttpError(404, "Khong tim thay bai dang cua ban");
  return post;
}

async function requireMatchAccess(postId: string, viewer: AccessTokenPayload) {
  const post = await postRepository.findVisibleById(postId);
  if (!post) throw new HttpError(404, "Không tìm thấy bài đăng");
  if (post.userId !== viewer.sub && !canReview(viewer)) {
    throw new HttpError(403, "Bạn không có quyền xem kết quả matching của bài đăng này");
  }
  return post;
}

async function refreshMatchingBestEffort(postId: string, trigger: "create" | "update") {
  try {
    await matchingService.runForPost(postId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown matching error";
    console.warn(`[matching] ${trigger} refresh failed for post ${postId}: ${message}`);
  }
}

function serializeMatchingResult(
  source: PostRecord,
  payload: Awaited<ReturnType<typeof matchingService.getStoredResults>>,
  viewer: AccessTokenPayload
) {
  function visibleExplanation(candidate: PostRecord, explanation: MatchExplanation | null) {
    if (!explanation || candidate.visibilityMode !== "PRIVATE_DETAILS" || canSeePrivatePost(viewer, candidate)) {
      return explanation;
    }
    return redactPrivateMatchExplanation(explanation);
  }

  return {
    source: serializePost(source, viewer),
    matcherVersion: payload.matcherVersion,
    calculatedAt: payload.calculatedAt,
    thresholds: payload.thresholds,
    weights: payload.weights,
    results: payload.results.map(({ match, candidate }) => ({
      matchId: match.id,
      candidate: serializePost(candidate, viewer),
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
      calculatedAt: match.updatedAt
    }))
  };
}

function makeMediaStorage(postId: string, mediaId: string, extension: string) {
  const filename = `${mediaId}.${extension}`;
  const dir = path.resolve(mediaRoot, postId);
  const filePath = path.resolve(dir, filename);
  if (!filePath.startsWith(`${mediaRoot}${path.sep}`)) throw new HttpError(400, "Duong dan media khong hop le");
  return {
    dir,
    filePath,
    secureUrl: `${privateMediaPrefix}${postId}/${filename}`,
    publicId: `post-media/${postId}/${mediaId}`
  };
}

function mediaPathFromSecureUrl(secureUrl: string) {
  if (!secureUrl.startsWith(privateMediaPrefix)) throw new HttpError(404, "Media khong hop le");
  const parts = secureUrl.slice(privateMediaPrefix.length).split("/");
  if (parts.length !== 2) throw new HttpError(404, "Media khong hop le");
  const [postId, filename] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(postId) || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename)) {
    throw new HttpError(404, "Media khong hop le");
  }
  const filePath = path.resolve(mediaRoot, postId, filename);
  if (!filePath.startsWith(`${mediaRoot}${path.sep}`)) throw new HttpError(404, "Media khong hop le");
  return filePath;
}

async function removeStoredFile(secureUrl: string) {
  await removeStoredFileIfPresent(mediaPathFromSecureUrl(secureUrl));
}

export const postService = {
  getFormCatalog() {
    return postRepository.getFormCatalog();
  },

  async listBoard(filters: ListPostsQuery, viewer?: AccessTokenPayload) {
    const result = await postRepository.listBoard(filters, viewer);
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
    const post = await postRepository.findVisibleById(postId);
    if (!post) throw new HttpError(404, "Khong tim thay bai dang");
    return serializePost(post, viewer);
  },

  async createPost(ownerId: string, input: CreatePostInput, viewer: AccessTokenPayload) {
    await ensureBusinessRefs(input);
    const postId = id();
    const post = await withTransaction(async (connection) => {
      await postRepository.createPost({
        id: postId,
        userId: ownerId,
        type: input.type,
        visibilityMode: input.type === "FOUND" ? input.visibilityMode ?? "PUBLIC" : "PUBLIC",
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
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }, connection);
      if (input.analysisSignals) {
        await matchingRepository.replaceAnalysisTags(postId, input.analysisSignals, connection);
      }
      const created = await postRepository.findOwnedById(postId, ownerId, connection);
      if (!created) throw new HttpError(500, "Không tạo được bài đăng");
      return created;
    });
    await refreshMatchingBestEffort(postId, "create");
    return serializePost(post, viewer);
  },

  async updatePost(postId: string, ownerId: string, input: UpdatePostInput, viewer: AccessTokenPayload) {
    const updated = await withTransaction(async (connection) => {
      const current = await postRepository.findOwnedByIdForUpdate(postId, ownerId, connection);
      if (!current) throw new HttpError(404, "Khong tim thay bai dang cua ban");
      assertPostUpdateAllowed(current, input);
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
      if (!refreshed) throw new HttpError(500, "Khong the cap nhat bai dang");
      return refreshed;
    });
    if (updated.status === "OPEN" || updated.status === "MATCHED") {
      await refreshMatchingBestEffort(postId, "update");
    }
    return serializePost(updated, viewer);
  },

  async listPostMatches(postId: string, viewer: AccessTokenPayload) {
    const source = await requireMatchAccess(postId, viewer);
    const payload = await matchingService.getStoredResults(postId);
    return serializeMatchingResult(source, payload, viewer);
  },

  async recalculatePostMatches(postId: string, viewer: AccessTokenPayload) {
    const source = await requireMatchAccess(postId, viewer);
    const payload = await matchingService.runForPost(postId);
    return serializeMatchingResult(source, payload, viewer);
  },

  async softDeletePost(postId: string, ownerId: string) {
    const deleted = await postRepository.softDeletePost(postId, ownerId);
    if (!deleted) throw new HttpError(404, "Khong tim thay bai dang cua ban");
  },

  async uploadMedia(postId: string, ownerId: string, input: UploadMediaInput, file: Express.Multer.File, viewer: AccessTokenPayload) {
    const post = await requireOwnedPost(postId, ownerId);
    ensureWritableStatus(post);
    const image = validateImageUpload(file);
    const mediaId = id();
    const storage = makeMediaStorage(postId, mediaId, image.extension);

    await mkdir(storage.dir, { recursive: true });
    await writeFile(storage.filePath, file.buffer, { flag: "wx" });
    let mediaCount = 0;
    try {
      await withTransaction(async (connection) => {
        const lockedPost = await postRepository.lockOwnedPostForMedia(postId, ownerId, connection);
        if (!lockedPost) throw new HttpError(404, "Không tìm thấy bài đăng của bạn");
        ensureWritableStatus(lockedPost);
        mediaCount = await postRepository.countMedia(postId, connection);
        if (mediaCount >= mediaPolicy.maxPerPost) throw new HttpError(409, `Mỗi bài đăng chỉ được tối đa ${mediaPolicy.maxPerPost} ảnh`);
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
      });
    } catch (error) {
      await removeStoredFile(storage.secureUrl).catch(() => undefined);
      throw error;
    }

    return {
      id: mediaId,
      mediaKind: input.mediaKind,
      resourceType: "image",
      format: image.format,
      bytes: image.bytes,
      sortOrder: input.sortOrder ?? mediaCount,
      url: mediaUrl(postId, mediaId),
      post: serializePost(post, viewer)
    };
  },

  async getMediaFile(postId: string, mediaId: string, viewer?: AccessTokenPayload) {
    const media = await postRepository.findMedia(postId, mediaId);
    if (!media || media.postDeletedAt || media.postStatus === "HIDDEN") throw new HttpError(404, "Khong tim thay media");
    const privateMedia = media.mediaKind === "EVIDENCE" || media.postVisibilityMode === "PRIVATE_DETAILS";
    if (privateMedia && !viewer) throw new HttpError(401, "Can dang nhap de xem media nay");
    if (privateMedia && !canSeePrivateMedia(viewer, media)) throw new HttpError(403, "Ban khong co quyen xem media nay");

    const filePath = mediaPathFromSecureUrl(media.secureUrl);
    await ensureStoredFileExists(filePath);
    return {
      filePath,
      contentType: mediaContentType((media.format ?? "jpg") as "jpg" | "png" | "webp"),
      publicId: media.publicId
    };
  },

  async deleteMedia(postId: string, mediaId: string, ownerId: string) {
    const secureUrl = await withTransaction(async (connection) => {
      const media = await postRepository.findMedia(postId, mediaId, connection, true);
      if (!media || media.ownerId !== ownerId) throw new HttpError(404, "Không tìm thấy media");
      const deleted = await postRepository.deleteMedia(postId, mediaId, connection);
      if (!deleted) throw new HttpError(404, "Không tìm thấy media");
      return media.secureUrl;
    });
    try {
      await removeStoredFile(secureUrl);
    } catch {
      // Metadata is already gone, so a filesystem failure can only leave an inaccessible orphan for later cleanup.
      console.warn(`[media] local file cleanup failed after deleting media ${mediaId}`);
    }
  }
};
