import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultMatchingConfig, redactPrivateMatchExplanation, scoreMatchCandidates, tokenizeMatchingText, type MatchCandidate } from "./matching.engine.js";

function candidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    id: "post-base",
    userId: "user-base",
    type: "LOST",
    status: "OPEN",
    visibilityMode: "PUBLIC",
    title: "Điện thoại iPhone 13 màu xanh",
    text: "điện thoại iphone 13 màu xanh có ốp trong và vết xước góc trái",
    imageText: "điện thoại apple xanh ốp trong hai camera",
    ocrText: "iphone apple",
    categoryId: "category-phone",
    parentCategoryId: "category-electronics",
    areaId: "area-alpha",
    buildingId: "building-alpha",
    roomText: "phòng 315",
    customLocation: null,
    lostFoundAt: "2026-08-20T08:00:00.000Z",
    ...overrides
  };
}

describe("hybrid matching engine", () => {
  it("normalizes Vietnamese text and common synonyms", () => {
    assert.deepEqual(
      tokenizeMatchingText("Điện thoại và phone ở KTX"),
      ["dienthoai", "dienthoai", "kytucxa"]
    );
  });

  it("returns a high-confidence, explainable result for strong multi-signal similarity", () => {
    const source = candidate();
    const result = scoreMatchCandidates(source, [candidate({
      id: "found-strong",
      userId: "finder",
      type: "FOUND",
      text: "nhặt được iphone 13 xanh có ốp trong vết xước góc trái",
      lostFoundAt: "2026-08-20T10:00:00.000Z"
    })])[0];

    assert.ok(result.totalScore >= defaultMatchingConfig.highConfidenceThreshold);
    assert.equal(result.scoreTier, "HIGH_CONFIDENCE");
    assert.ok(result.explanation.matchedTokens.includes("iphone"));
    assert.ok(result.explanation.matchedImageTags.includes("apple"));
    assert.ok(result.explanation.matchedOcrTokens.includes("iphone"));
    assert.equal(result.explanation.categoryReason, "Trùng danh mục cụ thể");
    assert.equal(result.explanation.locationReason, "Trùng vị trí chi tiết: phòng 315");
  });

  it("caps a strong-looking candidate when categories are unrelated", () => {
    const result = scoreMatchCandidates(candidate(), [candidate({
      id: "found-wrong-category",
      userId: "finder",
      type: "FOUND",
      categoryId: "category-wallet",
      parentCategoryId: "category-accessories"
    })])[0];

    assert.equal(result.categoryScore, 0);
    assert.ok(result.totalScore <= 0.69);
    assert.ok(result.explanation.penalties.some((value) => value.includes("Khác nhóm danh mục")));
  });

  it("keeps a result below suggestion level when incidents are over 30 days apart without strong OCR", () => {
    const result = scoreMatchCandidates(candidate({ ocrText: "" }), [candidate({
      id: "found-too-old",
      userId: "finder",
      type: "FOUND",
      ocrText: "",
      lostFoundAt: "2026-06-01T08:00:00.000Z"
    })])[0];

    assert.ok(result.totalScore <= 0.59);
    assert.equal(result.scoreTier, "WEAK");
    assert.ok(result.explanation.penalties.some((value) => value.includes("trên 30 ngày")));
  });

  it("sorts candidates by total score and leaves weak evidence below the persistence threshold", () => {
    const results = scoreMatchCandidates(candidate(), [
      candidate({
        id: "found-weak",
        userId: "finder-weak",
        type: "FOUND",
        text: "balo vải đỏ",
        imageText: "balo đỏ",
        ocrText: "",
        categoryId: "category-backpack",
        parentCategoryId: "category-bags",
        areaId: "area-beta",
        buildingId: "building-beta",
        roomText: "sảnh beta",
        lostFoundAt: "2026-08-10T08:00:00.000Z"
      }),
      candidate({ id: "found-strong", userId: "finder-strong", type: "FOUND" })
    ]);

    assert.equal(results[0].candidateId, "found-strong");
    assert.equal(results[1].candidateId, "found-weak");
    assert.ok(results[1].totalScore < defaultMatchingConfig.weakThreshold);
  });

  it("redacts raw matching signals without changing aggregate scores or the original explanation", () => {
    const explanation = scoreMatchCandidates(candidate(), [candidate({ id: "found-private", userId: "finder", type: "FOUND" })])[0].explanation;
    const redacted = redactPrivateMatchExplanation(explanation);

    assert.deepEqual(redacted.matchedTokens, []);
    assert.deepEqual(redacted.matchedImageTags, []);
    assert.deepEqual(redacted.matchedOcrTokens, []);
    assert.match(redacted.locationReason, /được bảo vệ|nội bộ/i);
    assert.ok(redacted.reasons.some((value) => value.includes("riêng tư")));
    assert.ok(explanation.matchedTokens.length > 0);
  });
});
