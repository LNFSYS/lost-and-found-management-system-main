import assert from "node:assert/strict";
import test from "node:test";
import type { AccessTokenPayload } from "../../../shared/domain/auth.js";
import { matchingService, postRepository, postService } from "../../../test/use-case-fixtures.js";
import { assertPostUpdateAllowed } from "../domain/post-policy.js";
import type { PostRecord } from "./post.repository.port.js";

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

test("post update state machine rejects content changes after terminal status", () => {
  assert.throws(
    () => assertPostUpdateAllowed({ status: "CLOSED" }, { title: "Updated title" }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "conflict"
  );
  assert.throws(
    () => assertPostUpdateAllowed({ status: "RESOLVED" }, { status: "OPEN" }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "conflict"
  );
});

test("post update state machine allows content edits only while open or matched", () => {
  assert.doesNotThrow(() => assertPostUpdateAllowed({ status: "OPEN" }, { title: "Updated title" }));
  assert.doesNotThrow(() => assertPostUpdateAllowed({ status: "MATCHED" }, { status: "RESOLVED" }));
});

test("matching results require source ownership or Staff/Admin review access", async () => {
  const originalFindVisibleById = postRepository.findVisibleById;
  postRepository.findVisibleById = async () => post();
  try {
    await assert.rejects(
      postService.listPostMatches("11111111-1111-4111-8111-111111111111", viewer("other-user")),
      (error: unknown) => error instanceof Error
        && "code" in error
        && error.code === "forbidden"
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
        updatedAt: "2026-09-01T09:00:00.000Z",
        feedback: null
      },
      candidate
    }],
    total: 1,
    page: 1,
    pageSize: 20,
    hasMore: false
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
      (error: unknown) => error instanceof Error && "code" in error && error.code === "unauthenticated"
    );
    await assert.rejects(
      postService.getMediaFile("11111111-1111-4111-8111-111111111111", "private-media", viewer("other-user")),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "forbidden"
    );
  } finally {
    postRepository.findMedia = originalFindMedia;
  }
});

test("hidden post is inaccessible to unauthenticated or other users (404), but visible to owner and staff", async () => {
  const originalFindById = postRepository.findById;
  const hiddenPost = post({ status: "HIDDEN", userId: "owner-id" });
  postRepository.findById = async () => hiddenPost;
  try {
    // Unauthenticated
    await assert.rejects(
      postService.getPost("11111111-1111-4111-8111-111111111111", undefined),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "not_found"
    );
    // Other user
    await assert.rejects(
      postService.getPost("11111111-1111-4111-8111-111111111111", viewer("other-user")),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "not_found"
    );
    // Owner
    const ownerView = await postService.getPost("11111111-1111-4111-8111-111111111111", viewer("owner-id"));
    assert.equal(ownerView.id, hiddenPost.id);
    // Staff
    const staffView = await postService.getPost("11111111-1111-4111-8111-111111111111", viewer("staff-user", ["STAFF"]));
    assert.equal(staffView.id, hiddenPost.id);
  } finally {
    postRepository.findById = originalFindById;
  }
});

test("private details post is inaccessible to unauthenticated or other users (404)", async () => {
  const originalFindById = postRepository.findById;
  const privatePost = post({ visibilityMode: "PRIVATE_DETAILS", userId: "owner-id" });
  postRepository.findById = async () => privatePost;
  try {
    // Unauthenticated
    await assert.rejects(
      postService.getPost("11111111-1111-4111-8111-111111111111", undefined),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "not_found"
    );
    // Other user
    await assert.rejects(
      postService.getPost("11111111-1111-4111-8111-111111111111", viewer("other-user")),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "not_found"
    );
    // Owner
    const ownerView = await postService.getPost("11111111-1111-4111-8111-111111111111", viewer("owner-id"));
    assert.equal(ownerView.id, privatePost.id);
  } finally {
    postRepository.findById = originalFindById;
  }
});

test("matching suggestions mask candidate phone and email from regular viewers", async () => {
  const source = post();
  const candidateWithContact = post({
    id: "33333333-3333-4333-8333-333333333333",
    userId: "finder-contact",
    description: "Nhặt được đồ, gọi 0987654321 hoặc mail finder@fpt.edu.vn",
    contactInfo: "0987654321"
  });
  const explanation = {
    tier: "SUGGESTION" as const,
    summary: "Trùng khớp SĐT 0987654321 trong nội dung",
    reasons: ["Liên hệ qua 0987654321"],
    matchedTokens: ["0987654321"],
    matchedImageTags: [],
    matchedOcrTokens: ["finder@fpt.edu.vn"],
    locationReason: "Tại khuôn viên",
    categoryReason: "Cùng danh mục",
    daysDiff: 1,
    penalties: []
  };
  const stored = {
    matcherVersion: "rule-v2-explainable",
    calculatedAt: "2026-09-01T09:00:00.000Z",
    thresholds: { weak: 0.45, suggestion: 0.6, notification: 0.75, highConfidence: 0.85 },
    weights: { text: 0.3, category: 0.2, location: 0.15, time: 0.1, image: 0.15, ocr: 0.1 },
    results: [{
      match: {
        id: "match-leak-check",
        lostPostId: source.id,
        foundPostId: candidateWithContact.id,
        isNotified: false,
        createdAt: "2026-09-01T09:00:00.000Z",
        totalScore: 0.8,
        scoreTier: "SUGGESTION" as const,
        textScore: 0.8,
        categoryScore: 0.8,
        locationScore: 0.8,
        timeScore: 0.8,
        imageScore: 0.8,
        ocrScore: 0.8,
        explanation,
        matcherVersion: "v2",
        updatedAt: "2026-09-01T09:00:00.000Z",
        feedback: null
      },
      candidate: candidateWithContact
    }],
    total: 1,
    page: 1,
    pageSize: 20,
    hasMore: false
  };

  const originalFindVisibleById = postRepository.findVisibleById;
  const originalGetStoredResults = matchingService.getStoredResults;
  postRepository.findVisibleById = async () => source;
  matchingService.getStoredResults = async () => stored;

  try {
    const ownerResult = await postService.listPostMatches(source.id, viewer(source.userId));
    const serialized = JSON.stringify(ownerResult);
    // Plain phone and email must NOT appear in response
    assert.equal(serialized.includes("0987654321"), false);
    assert.equal(serialized.includes("finder@fpt.edu.vn"), false);
    assert.equal(ownerResult.results[0].candidate.contactInfo, null);
    assert.ok(ownerResult.results[0].candidate.description?.includes("098***321"));
    assert.ok(ownerResult.results[0].candidate.description?.includes("fi***@fpt.edu.vn"));
  } finally {
    postRepository.findVisibleById = originalFindVisibleById;
    matchingService.getStoredResults = originalGetStoredResults;
  }
});

test("creating LOST post with sensitive document keywords defaults to PRIVATE_DETAILS", async () => {
  let createdInput: any = null;
  const originalCreatePost = postRepository.createPost;
  const originalFindOwnedById = postRepository.findOwnedById;
  const originalFindActiveArea = postRepository.findActiveArea;
  const originalFindActiveCategory = postRepository.findActiveCategory;
  postRepository.createPost = async (input: any) => {
    createdInput = input;
  };
  postRepository.findOwnedById = async (id: string, userId: string) => post({ id, userId, visibilityMode: createdInput?.visibilityMode ?? "PUBLIC" });
  postRepository.findActiveArea = async () => "area-1";
  postRepository.findActiveCategory = async () => "cat-1";

  try {
    await postService.createPost("owner-id", {
      type: "LOST",
      title: "Rơi CCCD tại sảnh Delta",
      description: "Đánh rơi thẻ căn cước công dân",
      categoryId: "cat-1",
      areaId: "area-1",
      contactInfo: "0900000000",
      lostFoundAt: new Date()
    }, viewer("owner-id"));
    assert.equal(createdInput?.visibilityMode, "PRIVATE_DETAILS");
  } finally {
    postRepository.createPost = originalCreatePost;
    postRepository.findOwnedById = originalFindOwnedById;
    postRepository.findActiveArea = originalFindActiveArea;
    postRepository.findActiveCategory = originalFindActiveCategory;
  }
});

test("closing post fails when post has active deletion blockers", async () => {
  const originalFindOwnedByIdForUpdate = postRepository.findOwnedByIdForUpdate;
  const originalHasDeletionBlockers = postRepository.hasDeletionBlockers;
  postRepository.findOwnedByIdForUpdate = async () => post({ status: "OPEN", userId: "owner-id" });
  postRepository.hasDeletionBlockers = async () => true;

  try {
    await assert.rejects(
      () => postService.updatePost("11111111-1111-4111-8111-111111111111", "owner-id", { status: "CLOSED" }, viewer("owner-id")),
      (error: unknown) => error instanceof Error && (error as { code?: string }).code === "conflict"
    );
  } finally {
    postRepository.findOwnedByIdForUpdate = originalFindOwnedByIdForUpdate;
    postRepository.hasDeletionBlockers = originalHasDeletionBlockers;
  }
});
