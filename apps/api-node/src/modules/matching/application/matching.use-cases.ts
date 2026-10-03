import { AppError } from "../../../shared/domain/app-error.js";
import type { PostRepository } from "../../posts/application/index.js";
import {
  defaultMatchingConfig,
  scoreMatchCandidates,
  type MatchingConfig
} from "../domain/matching.engine.js";
import type { MatchFeedbackValue, MatchingRefreshJob, MatchingRepository } from "./matching.repository.port.js";

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

export interface MatchingDependencies {
  matchingRepository: MatchingRepository;
  postRepository: PostRepository;
  idFactory: () => string;
}
export function createMatchingUseCases(options: MatchingDependencies) {
  const { matchingRepository, postRepository, idFactory } = options;

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

  async function buildStoredResults(postId: string, config: MatchingConfig, viewerId?: string) {
    const matches = await matchingRepository.listForPost(postId, config.weakThreshold, viewerId);
    const counterpartIds = matches.map((match) => match.lostPostId === postId ? match.foundPostId : match.lostPostId);
    const posts = await postRepository.findVisibleByIds(counterpartIds);
    const postById = new Map(posts.map((post) => [post.id, post]));
    return matches.flatMap((match) => {
      const counterpartId = match.lostPostId === postId ? match.foundPostId : match.lostPostId;
      const candidate = postById.get(counterpartId);
      return candidate && !(candidate.type === "LOST" && candidate.userId === viewerId) ? [{ match, candidate }] : [];
    });
  }

  const matchingService = {
    async runForPost(postId: string, viewerId?: string, page = 1, pageSize = 20, job?: MatchingRefreshJob) {
      const source = await matchingRepository.findCandidate(postId);
      if (!source) throw new AppError("conflict", "Bài đăng phải đang mở hoặc đã có gợi ý để tính matching");
      const [config, candidateLimit, candidateWindowDays] = await Promise.all([
        loadConfig(),
        matchingRepository.getConfigNumber("matching.candidate_limit", 500),
        matchingRepository.getConfigNumber("matching.candidate_window_days", 120)
      ]);
      const candidates = await matchingRepository.listOppositeCandidates(source, candidateLimit, candidateWindowDays);
      const matches = scoreMatchCandidates(source, candidates, config)
        .filter((match) => match.totalScore >= config.weakThreshold);
      if (await matchingRepository.persistForSource(source, matches, job) === false) {
        throw new AppError("conflict", "Matching refresh lease or source eligibility changed");
      }
      return matchingService.getStoredResults(postId, config, viewerId, page, pageSize);
    },

    async getStoredResults(postId: string, suppliedConfig?: MatchingConfig, viewerId?: string, page = 1, pageSize = 20) {
      const config = suppliedConfig ?? await loadConfig();
      const stored = await buildStoredResults(postId, config, viewerId);
      const safePage = Math.max(1, Math.trunc(page));
      const safePageSize = Math.max(1, Math.min(50, Math.trunc(pageSize)));
      const results = stored.slice((safePage - 1) * safePageSize, safePage * safePageSize);
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
        results,
        total: stored.length,
        page: safePage,
        pageSize: safePageSize,
        hasMore: safePage * safePageSize < stored.length
      };
    },

    async submitFeedback(input: { matchId: string; postId: string; userId: string; value: MatchFeedbackValue; note?: string | null; correlationKey: string }) {
      const match = await matchingRepository.findMatchForPost(input.matchId, input.postId);
      if (!match) throw new AppError("not_found", "Không tìm thấy gợi ý matching");
      const normalizedNote = input.note?.trim() || null;
      const existing = await matchingRepository.findFeedback(input.matchId, input.userId);
      if (existing) {
        if (existing.correlationKey === input.correlationKey && existing.value === input.value && existing.note === normalizedNote) return existing;
        throw new AppError("conflict", "Bạn đã gửi đánh giá cho gợi ý này");
      }
      const saved = await matchingRepository.saveFeedback({ id: idFactory(), ...input, note: normalizedNote, sourcePostId: input.postId });
      if (saved.correlationKey !== input.correlationKey || saved.value !== input.value || saved.note !== normalizedNote) {
        throw new AppError("conflict", "Bạn đã gửi đánh giá cho gợi ý này");
      }
      return saved;
    },

    async dismissSuggestion(input: { matchId: string; postId: string; userId: string; reason?: string | null; correlationKey: string }) {
      const match = await matchingRepository.findMatchForPost(input.matchId, input.postId);
      if (!match) throw new AppError("not_found", "Không tìm thấy gợi ý matching");
      const normalizedReason = input.reason?.trim() || null;
      const existing = await matchingRepository.findDismissal(input.matchId, input.userId, input.postId);
      if (existing) {
        if (existing.correlationKey === input.correlationKey && existing.reason === normalizedReason) return existing;
        throw new AppError("conflict", "Gợi ý này đã được ẩn");
      }
      const saved = await matchingRepository.saveDismissal({ id: idFactory(), ...input, reason: normalizedReason, sourcePostId: input.postId });
      if (saved.correlationKey !== input.correlationKey || saved.reason !== normalizedReason) throw new AppError("conflict", "Gợi ý này đã được ẩn");
      return saved;
    },

    async runPeriodicRefresh(input: { intervalHours: number; batchSize: number; staleMinutes: number }) {
      const enqueued = await matchingRepository.enqueueEligibleRefresh(input.intervalHours, input.batchSize * 4);
      let claimed = 0;
      let completed = 0;
      let failed = 0;
      // Claim just-in-time so queued batch entries do not age while another runs.
      for (let index = 0; index < input.batchSize; index += 1) {
        const [job] = await matchingRepository.claimRefreshJobs(1, input.staleMinutes);
        if (!job) break;
        claimed += 1;
        let renewal: Promise<unknown> | null = null;
        const timer = setInterval(() => {
          if (!renewal) renewal = matchingRepository.renewRefreshJob(job, input.staleMinutes)
            .catch(() => false).finally(() => { renewal = null; });
        }, Math.max(1_000, input.staleMinutes * 30_000));
        timer.unref();
        try {
          await matchingService.runForPost(job.postId, undefined, 1, 20, job);
          if (await matchingRepository.completeRefreshJob(job)) completed += 1;
        } catch {
          if (await matchingRepository.failRefreshJob(job, "MATCH_REFRESH_FAILED")) failed += 1;
        } finally {
          clearInterval(timer);
          if (renewal) await renewal;
        }
      }
      return { enqueued, claimed, completed, failed };
    },

    async listSummaries(postIds: string[]) {
      const config = await loadConfig();
      return matchingRepository.listSummaries(postIds, config.weakThreshold);
    }
  };
  return matchingService;
}

export type MatchingUseCases = ReturnType<typeof createMatchingUseCases>;
