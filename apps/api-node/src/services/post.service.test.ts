import assert from "node:assert/strict";
import test from "node:test";
import type { PostRecord } from "../repositories/post.repository.js";
import { postRepository } from "../repositories/post.repository.js";
import type { AccessTokenPayload } from "../types/auth.js";
import { matchingService } from "./matching.service.js";
import { postService } from "./post.service.js";

function post(overrides: Partial<PostRecord> = {}): PostRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "owner-id",
    ownerName: "Post Owner",
    type: "LOST",
    status: "OPEN",
    visibilityMode: "PUBLIC",
    title: "Ví da màu đen",
    description: "Ví da màu đen có vết xước ở cạnh",
    categoryId: "category-id",
    categoryName: "Ví / bóp",
    categoryIcon: null,
    areaId: "area-id",
    areaName: "Khu Alpha",
    buildingId: "building-id",
    buildingName: "Tòa Alpha",
    roomText: "Sảnh tầng 1",
    customLocation: null,
    contactInfo: "owner@example.invalid",
    lostFoundAt: "2026-09-01T08:00:00.000Z",
    handoverPointId: null,
    handoverPointName: null,
    handoverPointAddress: null,
    expiresAt: "2026-10-01T08:00:00.000Z",
    resolvedAt: null,
    viewCount: 0,
    createdAt: "2026-09-01T08:05:00.000Z",
    updatedAt: "2026-09-01T08:05:00.000Z",
    deletedAt: null,
    media: [],
    ...overrides
  };
}

function viewer(sub: string, roles: AccessTokenPayload["roles"] = ["USER"]): AccessTokenPayload {
  return { sub, email: `${sub}@example.invalid`, roles, sessionVersion: 0 };
}

test("matching results require source ownership or Staff/Admin review access", async () => {
  const originalFindVisibleById = postRepository.findVisibleById;
  postRepository.findVisibleById = async () => post();
  try {
    await assert.rejects(
      postService.listPostMatches("11111111-1111-4111-8111-111111111111", viewer("other-user")),
      (error: unknown) => error instanceof Error
        && "status" in error
        && error.status === 403
    );
  } finally {
    postRepository.findVisibleById = originalFindVisibleById;
  }
});

test("private candidate explanations hide raw signals from the source owner but remain available to Staff", async () => {
  const source = post();
  const candidate = post({
    id: "22222222-2222-4222-8222-222222222222",
    userId: "finder-id",
    ownerName: "Finder",
    type: "FOUND",
    visibilityMode: "PRIVATE_DETAILS",
    contactInfo: "finder@example.invalid"
  });
  const explanation = {
    tier: "NOTIFY" as const,
    summary: "Hai bài có mức tương đồng 80%.",
    reasons: ["Mô tả 80%"],
    matchedTokens: ["vi", "den"],
    matchedImageTags: ["leather"],
    matchedOcrTokens: ["brand"],
    locationReason: "Cùng tòa nhà",
    categoryReason: "Trùng danh mục cụ thể",
    daysDiff: 0.1,
    penalties: []
  };
  const stored = {
    matcherVersion: "rule-v2-explainable",
    calculatedAt: "2026-09-01T09:00:00.000Z",
    thresholds: { weak: 0.45, suggestion: 0.6, notification: 0.75, highConfidence: 0.85 },
    weights: { text: 0.3, category: 0.2, location: 0.15, time: 0.1, image: 0.15, ocr: 0.1 },
    results: [{
      match: {
        id: "match-id",
        lostPostId: source.id,
        foundPostId: candidate.id,
        totalScore: 0.8,
        textScore: 0.8,
        categoryScore: 1,
        locationScore: 0.75,
        timeScore: 1,
        imageScore: 0.5,
        ocrScore: 0.5,
        scoreTier: "NOTIFY" as const,
        matcherVersion: "rule-v2-explainable",
        explanation,
        isNotified: false,
        createdAt: "2026-09-01T09:00:00.000Z",
        updatedAt: "2026-09-01T09:00:00.000Z"
      },
      candidate
    }]
  };

  const originalFindVisibleById = postRepository.findVisibleById;
  const originalGetStoredResults = matchingService.getStoredResults;
  postRepository.findVisibleById = async () => source;
  matchingService.getStoredResults = async () => stored;
  try {
    const ownerResult = await postService.listPostMatches(source.id, viewer(source.userId));
    assert.equal(ownerResult.results[0].candidate.description, null);
    assert.equal(ownerResult.results[0].candidate.contactInfo, null);
    assert.deepEqual(ownerResult.results[0].explanation?.matchedTokens, []);
    assert.deepEqual(ownerResult.results[0].explanation?.matchedImageTags, []);
    assert.deepEqual(ownerResult.results[0].explanation?.matchedOcrTokens, []);

    const staffResult = await postService.listPostMatches(source.id, viewer("staff-id", ["USER", "STAFF"]));
    assert.equal(staffResult.results[0].candidate.description, candidate.description);
    assert.equal(staffResult.results[0].candidate.contactInfo, candidate.contactInfo);
    assert.deepEqual(staffResult.results[0].explanation?.matchedTokens, explanation.matchedTokens);
  } finally {
    postRepository.findVisibleById = originalFindVisibleById;
    matchingService.getStoredResults = originalGetStoredResults;
  }
});

test("public board hides evidence media and raw storage URLs", async () => {
  const originalListBoard = postRepository.listBoard;
  postRepository.listBoard = async () => ({
    total: 1,
    page: 1,
    pageSize: 9,
    items: [post({
      media: [
        { id: "item-media", postId: "11111111-1111-4111-8111-111111111111", mediaKind: "ITEM", resourceType: "image", format: "jpg", bytes: 1200, sortOrder: 0, createdAt: "2026-09-01T08:06:00.000Z" },
        { id: "evidence-media", postId: "11111111-1111-4111-8111-111111111111", mediaKind: "EVIDENCE", resourceType: "image", format: "jpg", bytes: 1400, sortOrder: 1, createdAt: "2026-09-01T08:07:00.000Z" }
      ]
    })]
  });
  try {
    const result = await postService.listBoard({ page: 1, pageSize: 9, sort: "newest" });
    assert.equal(result.items[0].media.length, 1);
    assert.equal(result.items[0].media[0].id, "item-media");
    assert.equal(result.items[0].media[0].url, "/api/posts/11111111-1111-4111-8111-111111111111/media/item-media");
    assert.equal(JSON.stringify(result).includes("private://"), false);
    assert.equal(JSON.stringify(result).includes("evidence-media"), false);
  } finally {
    postRepository.listBoard = originalListBoard;
  }
});

test("private post media blocks anonymous and unrelated viewers before file lookup", async () => {
  const originalFindMedia = postRepository.findMedia;
  postRepository.findMedia = async () => ({
    id: "private-media",
    postId: "11111111-1111-4111-8111-111111111111",
    mediaKind: "ITEM",
    resourceType: "image",
    format: "jpg",
    bytes: 1200,
    sortOrder: 0,
    createdAt: "2026-09-01T08:06:00.000Z",
    secureUrl: "private://post-media/11111111-1111-4111-8111-111111111111/private-media.jpg",
    publicId: "private-media",
    ownerId: "owner-id",
    postStatus: "OPEN",
    postVisibilityMode: "PRIVATE_DETAILS",
    postDeletedAt: null
  });
  try {
    await assert.rejects(
      postService.getMediaFile("11111111-1111-4111-8111-111111111111", "private-media"),
      (error: unknown) => error instanceof Error && "status" in error && error.status === 401
    );
    await assert.rejects(
      postService.getMediaFile("11111111-1111-4111-8111-111111111111", "private-media", viewer("other-user")),
      (error: unknown) => error instanceof Error && "status" in error && error.status === 403
    );
  } finally {
    postRepository.findMedia = originalFindMedia;
  }
});
