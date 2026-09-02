import { matchingRepository } from "../repositories/matching.repository.js";
import { postRepository } from "../repositories/post.repository.js";
import { HttpError } from "../utils/http-error.js";
import {
  defaultMatchingConfig,
  scoreMatchCandidates,
  type MatchingConfig
} from "./matching.engine.js";

function isUnitInterval(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function sanitizeMatchingConfig(config: MatchingConfig): MatchingConfig {
  const thresholds = [
    config.weakThreshold,
    config.suggestionThreshold,
    config.notificationThreshold,
    config.highConfidenceThreshold
  ];
  const thresholdsAreValid = thresholds.every(isUnitInterval)
    && thresholds.every((value, index) => index === 0 || thresholds[index - 1] <= value);
  const weightValues = Object.values(config.weights);
  const weightsAreValid = weightValues.every(isUnitInterval)
    && weightValues.some((value) => value > 0);

  return {
    weakThreshold: thresholdsAreValid ? config.weakThreshold : defaultMatchingConfig.weakThreshold,
    suggestionThreshold: thresholdsAreValid ? config.suggestionThreshold : defaultMatchingConfig.suggestionThreshold,
    notificationThreshold: thresholdsAreValid ? config.notificationThreshold : defaultMatchingConfig.notificationThreshold,
    highConfidenceThreshold: thresholdsAreValid ? config.highConfidenceThreshold : defaultMatchingConfig.highConfidenceThreshold,
    weights: weightsAreValid ? config.weights : { ...defaultMatchingConfig.weights }
  };
}

async function loadConfig(): Promise<MatchingConfig> {
  const [
    weakThreshold,
    suggestionThreshold,
    notificationThreshold,
    highConfidenceThreshold,
    text,
    category,
    location,
    time,
    image,
    ocr
  ] = await Promise.all([
    matchingRepository.getConfigNumber("matching.weak_threshold", defaultMatchingConfig.weakThreshold),
    matchingRepository.getConfigNumber("matching.suggestion_threshold", defaultMatchingConfig.suggestionThreshold),
    matchingRepository.getConfigNumber("matching.notification_threshold", defaultMatchingConfig.notificationThreshold),
    matchingRepository.getConfigNumber("matching.high_confidence_threshold", defaultMatchingConfig.highConfidenceThreshold),
    matchingRepository.getConfigNumber("matching.weight_text", defaultMatchingConfig.weights.text),
    matchingRepository.getConfigNumber("matching.weight_category", defaultMatchingConfig.weights.category),
    matchingRepository.getConfigNumber("matching.weight_location", defaultMatchingConfig.weights.location),
    matchingRepository.getConfigNumber("matching.weight_time", defaultMatchingConfig.weights.time),
    matchingRepository.getConfigNumber("matching.weight_image", defaultMatchingConfig.weights.image),
    matchingRepository.getConfigNumber("matching.weight_ocr", defaultMatchingConfig.weights.ocr)
  ]);
  return sanitizeMatchingConfig({
    weakThreshold,
    suggestionThreshold,
    notificationThreshold,
    highConfidenceThreshold,
    weights: { text, category, location, time, image, ocr }
  });
}

async function buildStoredResults(postId: string, config: MatchingConfig) {
  const matches = await matchingRepository.listForPost(postId, config.weakThreshold);
  const counterpartIds = matches.map((match) => match.lostPostId === postId ? match.foundPostId : match.lostPostId);
  const posts = await postRepository.findVisibleByIds(counterpartIds);
  const postById = new Map(posts.map((post) => [post.id, post]));
  return matches.flatMap((match) => {
    const counterpartId = match.lostPostId === postId ? match.foundPostId : match.lostPostId;
    const candidate = postById.get(counterpartId);
    return candidate ? [{ match, candidate }] : [];
  });
}

export const matchingService = {
  async runForPost(postId: string) {
    const source = await matchingRepository.findCandidate(postId);
    if (!source) throw new HttpError(409, "Bài đăng phải đang mở hoặc đã có gợi ý để tính matching");
    const [config, candidateLimit, candidateWindowDays] = await Promise.all([
      loadConfig(),
      matchingRepository.getConfigNumber("matching.candidate_limit", 500),
      matchingRepository.getConfigNumber("matching.candidate_window_days", 120)
    ]);
    const candidates = await matchingRepository.listOppositeCandidates(source, candidateLimit, candidateWindowDays);
    const matches = scoreMatchCandidates(source, candidates, config)
      .filter((match) => match.totalScore >= config.weakThreshold);
    await matchingRepository.persistForSource(source, matches);
    return this.getStoredResults(postId, config);
  },

  async getStoredResults(postId: string, suppliedConfig?: MatchingConfig) {
    const config = suppliedConfig ?? await loadConfig();
    const results = await buildStoredResults(postId, config);
    return {
      matcherVersion: "rule-v2-explainable",
      calculatedAt: results[0]?.match.updatedAt ?? null,
      thresholds: {
        weak: config.weakThreshold,
        suggestion: config.suggestionThreshold,
        notification: config.notificationThreshold,
        highConfidence: config.highConfidenceThreshold
      },
      weights: config.weights,
      results
    };
  },

  async listSummaries(postIds: string[]) {
    const config = await loadConfig();
    return matchingRepository.listSummaries(postIds, config.weakThreshold);
  }
};
