import { normalizeVietnameseText } from "../utils/text.js";

export type MatchTier = "WEAK" | "SUGGESTION" | "NOTIFY" | "HIGH_CONFIDENCE";

export interface MatchCandidate {
  id: string;
  userId: string;
  type: "LOST" | "FOUND";
  status: "OPEN" | "MATCHED";
  visibilityMode: "PUBLIC" | "PRIVATE_DETAILS";
  title: string;
  text: string;
  imageText: string;
  ocrText: string;
  categoryId: string | null;
  parentCategoryId: string | null;
  areaId: string | null;
  buildingId: string | null;
  roomText: string | null;
  customLocation: string | null;
  lostFoundAt: string | null;
}

export interface MatchingConfig {
  weakThreshold: number;
  suggestionThreshold: number;
  notificationThreshold: number;
  highConfidenceThreshold: number;
  weights: {
    text: number;
    category: number;
    location: number;
    time: number;
    image: number;
    ocr: number;
  };
}

export interface MatchExplanation {
  tier: MatchTier;
  summary: string;
  reasons: string[];
  matchedTokens: string[];
  matchedImageTags: string[];
  matchedOcrTokens: string[];
  locationReason: string;
  categoryReason: string;
  daysDiff: number | null;
  penalties: string[];
}

export interface ScoredMatch {
  candidateId: string;
  totalScore: number;
  textScore: number;
  categoryScore: number;
  locationScore: number;
  timeScore: number;
  imageScore: number;
  ocrScore: number;
  scoreTier: MatchTier;
  explanation: MatchExplanation;
}

export function redactPrivateMatchExplanation(explanation: MatchExplanation): MatchExplanation {
  return {
    ...explanation,
    reasons: [...explanation.reasons, "Một số tín hiệu thô được ẩn theo chế độ riêng tư của bài FOUND."],
    matchedTokens: [],
    matchedImageTags: [],
    matchedOcrTokens: [],
    locationReason: "Có tín hiệu vị trí nội bộ; chi tiết chỉ dành cho chủ bài và Staff/Admin."
  };
}

export const defaultMatchingConfig: MatchingConfig = {
  weakThreshold: 0.45,
  suggestionThreshold: 0.6,
  notificationThreshold: 0.75,
  highConfidenceThreshold: 0.85,
  weights: {
    text: 0.3,
    category: 0.2,
    location: 0.15,
    time: 0.1,
    image: 0.15,
    ocr: 0.1
  }
};

const stopWords = new Set([
  "bi", "can", "cua", "da", "do", "duoc", "em", "giup", "mat", "mon", "nay",
  "nhat", "roi", "tim", "toi", "trong", "vat", "va", "voi"
]);

const synonyms = new Map([
  ["airpods", "airpod"], ["earphone", "tainghe"], ["earphones", "tainghe"],
  ["headphone", "tainghe"], ["headphones", "tainghe"], ["phone", "dienthoai"],
  ["mobile", "dienthoai"], ["wallet", "vi"], ["bop", "vi"], ["card", "the"],
  ["ktx", "kytucxa"], ["alfa", "alpha"]
]);

const phraseSynonyms: Array<[RegExp, string]> = [
  [/\bdien thoai\b/g, "dienthoai"],
  [/\btai nghe\b/g, "tainghe"],
  [/\bky tuc xa\b/g, "kytucxa"],
  [/\bchia khoa\b/g, "chiakhoa"],
  [/\bthe sinh vien\b/g, "thesinhvien"],
  [/\bmay tinh xach tay\b/g, "laptop"]
];

function normalizeMatchingText(value: string) {
  return phraseSynonyms.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    normalizeVietnameseText(value)
  );
}

function normalizeToken(value: string) {
  const token = normalizeVietnameseText(value).replace(/[^a-z0-9]/g, "");
  return synonyms.get(token) ?? token;
}

export function tokenizeMatchingText(value: string, minimumLength = 2) {
  return normalizeMatchingText(value)
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length >= minimumLength && !stopWords.has(token));
}

function tokenSet(value: string, minimumLength = 2) {
  return new Set(tokenizeMatchingText(value, minimumLength));
}

function overlap(leftText: string, rightText: string, minimumLength = 2) {
  const left = tokenSet(leftText, minimumLength);
  const right = tokenSet(rightText, minimumLength);
  if (!left.size || !right.size) return { score: 0, tokens: [] as string[] };
  const tokens = [...left].filter((token) => right.has(token));
  return { score: Math.min(1, tokens.length / Math.min(left.size, right.size)), tokens };
}

function termFrequency(tokens: string[]) {
  const values = new Map<string, number>();
  for (const token of tokens) values.set(token, (values.get(token) ?? 0) + 1);
  for (const [token, count] of values) values.set(token, count / Math.max(tokens.length, 1));
  return values;
}

function tfidfVectors(documents: string[]) {
  const tokenized = documents.map((document) => tokenizeMatchingText(document));
  const documentFrequency = new Map<string, number>();
  for (const tokens of tokenized) {
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  return tokenized.map((tokens) => {
    const vector = new Map<string, number>();
    for (const [token, frequency] of termFrequency(tokens)) {
      const inverseFrequency = Math.log((documents.length + 1) / ((documentFrequency.get(token) ?? 0) + 1)) + 1;
      vector.set(token, frequency * inverseFrequency);
    }
    return vector;
  });
}

function cosine(left: Map<string, number>, right: Map<string, number>) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (const value of left.values()) leftMagnitude += value * value;
  for (const value of right.values()) rightMagnitude += value * value;
  for (const [token, value] of left) dot += value * (right.get(token) ?? 0);
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator ? dot / denominator : 0;
}

function categorySimilarity(left: MatchCandidate, right: MatchCandidate) {
  if (!left.categoryId || !right.categoryId) return { score: 0, reason: "Chưa đủ thông tin danh mục" };
  if (left.categoryId === right.categoryId) return { score: 1, reason: "Trùng danh mục cụ thể" };
  if (
    (left.parentCategoryId && left.parentCategoryId === right.parentCategoryId)
    || left.parentCategoryId === right.categoryId
    || right.parentCategoryId === left.categoryId
  ) {
    return { score: 0.65, reason: "Cùng nhóm danh mục" };
  }
  return { score: 0, reason: "Khác nhóm danh mục" };
}

function sameNormalizedValue(left: string | null, right: string | null) {
  return Boolean(left && right && normalizeVietnameseText(left) === normalizeVietnameseText(right));
}

function locationSimilarity(left: MatchCandidate, right: MatchCandidate) {
  if (sameNormalizedValue(left.roomText, right.roomText)) {
    return { score: 1, reason: `Trùng vị trí chi tiết: ${left.roomText}` };
  }
  if (sameNormalizedValue(left.customLocation, right.customLocation)) {
    return { score: 0.9, reason: `Trùng mô tả vị trí: ${left.customLocation}` };
  }
  if (left.buildingId && left.buildingId === right.buildingId) return { score: 0.75, reason: "Cùng tòa nhà" };
  if (left.areaId && left.areaId === right.areaId) return { score: 0.45, reason: "Cùng khu vực campus" };
  return { score: 0, reason: "Chưa tìm thấy điểm chung về vị trí" };
}

function temporalSimilarity(left: MatchCandidate, right: MatchCandidate) {
  if (!left.lostFoundAt || !right.lostFoundAt) return { score: 0, daysDiff: null as number | null };
  const leftTime = Date.parse(left.lostFoundAt);
  const rightTime = Date.parse(right.lostFoundAt);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return { score: 0, daysDiff: null as number | null };
  const daysDiff = Math.abs(leftTime - rightTime) / 86_400_000;
  if (daysDiff <= 1) return { score: 1, daysDiff };
  if (daysDiff <= 3) return { score: 0.85, daysDiff };
  if (daysDiff <= 7) return { score: 0.65, daysDiff };
  if (daysDiff <= 14) return { score: 0.45, daysDiff };
  if (daysDiff <= 30) return { score: 0.25, daysDiff };
  return { score: 0, daysDiff };
}

function clamp(value: number) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(4));
}

function normalizeWeights(weights: MatchingConfig["weights"]) {
  const total = Object.values(weights).reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.max(0, value) / total])) as MatchingConfig["weights"];
}

function tierForScore(score: number, config: MatchingConfig): MatchTier {
  if (score >= config.highConfidenceThreshold) return "HIGH_CONFIDENCE";
  if (score >= config.notificationThreshold) return "NOTIFY";
  if (score >= config.suggestionThreshold) return "SUGGESTION";
  return "WEAK";
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function applyFalsePositiveCaps(input: {
  score: number;
  categoryScore: number;
  locationScore: number;
  daysDiff: number | null;
  textScore: number;
  imageScore: number;
  ocrScore: number;
}) {
  let score = input.score;
  const penalties: string[] = [];
  const strongPrivateSignal = input.ocrScore >= 0.5 || input.imageScore >= 0.7 || input.textScore >= 0.75;
  if (input.categoryScore === 0 && !strongPrivateSignal && score > 0.55) {
    score = 0.55;
    penalties.push("Khác nhóm danh mục và chưa có tín hiệu riêng đủ mạnh: điểm tối đa 55%.");
  } else if (input.categoryScore === 0 && score > 0.69) {
    score = 0.69;
    penalties.push("Khác nhóm danh mục: điểm tối đa 69%.");
  }
  if (input.daysDiff !== null && input.daysDiff > 30 && input.ocrScore < 0.5 && score > 0.59) {
    score = 0.59;
    penalties.push("Lệch thời gian trên 30 ngày và OCR không mạnh: điểm tối đa 59%.");
  }
  if (!input.locationScore && input.textScore < 0.35 && input.imageScore < 0.35 && input.ocrScore < 0.35 && score > 0.6) {
    score = 0.6;
    penalties.push("Vị trí khác và các tín hiệu mô tả/ảnh/OCR còn yếu: điểm tối đa 60%.");
  }
  return { score: clamp(score), penalties };
}

export function scoreMatchCandidates(
  source: MatchCandidate,
  candidates: MatchCandidate[],
  config: MatchingConfig = defaultMatchingConfig
): ScoredMatch[] {
  if (!candidates.length) return [];
  const weights = normalizeWeights(config.weights);
  const vectors = tfidfVectors([source.text, ...candidates.map((candidate) => candidate.text)]);

  return candidates.map((candidate, index) => {
    const textOverlap = overlap(source.text, candidate.text);
    const imageOverlap = overlap(source.imageText, candidate.imageText);
    const ocrOverlap = overlap(source.ocrText, candidate.ocrText, 3);
    const category = categorySimilarity(source, candidate);
    const location = locationSimilarity(source, candidate);
    const temporal = temporalSimilarity(source, candidate);
    const textScore = clamp(Math.max(cosine(vectors[0], vectors[index + 1]), textOverlap.score));
    const categoryScore = clamp(category.score);
    const locationScore = clamp(location.score);
    const timeScore = clamp(temporal.score);
    const imageScore = clamp(imageOverlap.score);
    const ocrScore = clamp(ocrOverlap.score);
    const weightedScore = (
      weights.text * textScore
      + weights.category * categoryScore
      + weights.location * locationScore
      + weights.time * timeScore
      + weights.image * imageScore
      + weights.ocr * ocrScore
    );
    const capped = applyFalsePositiveCaps({
      score: weightedScore,
      categoryScore,
      locationScore,
      daysDiff: temporal.daysDiff,
      textScore,
      imageScore,
      ocrScore
    });
    const scoreTier = tierForScore(capped.score, config);
    const reasons = [
      `Mô tả ${percent(textScore)}`,
      `Danh mục ${percent(categoryScore)}`,
      `Vị trí ${percent(locationScore)}`,
      `Thời gian ${percent(timeScore)}`,
      `Ảnh/tag ${percent(imageScore)}`,
      `OCR/chữ nhìn thấy ${percent(ocrScore)}`
    ];
    return {
      candidateId: candidate.id,
      totalScore: capped.score,
      textScore,
      categoryScore,
      locationScore,
      timeScore,
      imageScore,
      ocrScore,
      scoreTier,
      explanation: {
        tier: scoreTier,
        summary: `Hai bài có mức tương đồng ${percent(capped.score)}. Đây là gợi ý hỗ trợ, không phải kết luận quyền sở hữu.`,
        reasons,
        matchedTokens: textOverlap.tokens.slice(0, 12),
        matchedImageTags: imageOverlap.tokens.slice(0, 12),
        matchedOcrTokens: ocrOverlap.tokens.slice(0, 12),
        locationReason: location.reason,
        categoryReason: category.reason,
        daysDiff: temporal.daysDiff === null ? null : Number(temporal.daysDiff.toFixed(2)),
        penalties: capped.penalties
      }
    };
  }).sort((left, right) => right.totalScore - left.totalScore);
}
