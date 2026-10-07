import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { MatchCandidate, MatchExplanation, MatchTier, ScoredMatch } from "../domain/matching.engine.js";

export type MatchFeedbackValue = "USEFUL" | "IRRELEVANT" | "INCORRECT";
export interface MatchFeedbackRecord {
  id: string;
  matchId: string;
  userId: string;
  sourcePostId: string;
  value: MatchFeedbackValue;
  note: string | null;
  correlationKey: string;
  createdAt: string;
  updatedAt: string;
}
export interface MatchingRefreshJob { postId: string; requestedVersion: number; correlationKey: string; leaseToken: string; }

export interface UnnotifiedMatch {
  id: string;
  lostPostId: string;
  foundPostId: string;
  lostUserId: string;
  foundUserId: string;
  lostDismissed: boolean;
  foundDismissed: boolean;
}

export interface MatchingRepository {
  getConfigNumber(key: string, fallback: number): Promise<number>;
  findCandidate(postId: string): Promise<MatchCandidate | null>;
  listOppositeCandidates(source: MatchCandidate, candidateLimit: number, candidateWindowDays: number): Promise<MatchCandidate[]>;
  persistForSource(source: MatchCandidate, matches: ScoredMatch[], job?: MatchingRefreshJob): Promise<boolean | void>;
  lockUnnotifiedMatches(postId: string, minimumScore: number, transaction: TransactionContext): Promise<UnnotifiedMatch[]>;
  markNotified(matchId: string, transaction: TransactionContext): Promise<void>;
  listForPost(postId: string, minimumScore: number, viewerId?: string): Promise<{
    id: string;
    lostPostId: string;
    foundPostId: string;
    totalScore: number;
    textScore: number;
    categoryScore: number;
    locationScore: number;
    timeScore: number;
    imageScore: number;
    ocrScore: number;
    scoreTier: MatchTier;
    matcherVersion: string;
    explanation: MatchExplanation | null;
    isNotified: boolean;
    createdAt: string;
    updatedAt: string;
    feedback: MatchFeedbackRecord | null;
  }[]>;
  findMatchForPost(matchId: string, postId: string): Promise<{ id: string; lostPostId: string; foundPostId: string } | null>;
  findFeedback(matchId: string, userId: string): Promise<MatchFeedbackRecord | null>;
  saveFeedback(input: { id: string; matchId: string; userId: string; sourcePostId: string; value: MatchFeedbackValue; note: string | null; correlationKey: string }): Promise<MatchFeedbackRecord>;
  findDismissal(matchId: string, userId: string, sourcePostId: string): Promise<{ id: string; correlationKey: string; reason: string | null; createdAt: string } | null>;
  saveDismissal(input: { id: string; matchId: string; userId: string; sourcePostId: string; reason: string | null; correlationKey: string }): Promise<{ id: string; correlationKey: string; reason: string | null; createdAt: string }>;
  enqueueEligibleRefresh(intervalHours: number, limit: number): Promise<number>;
  claimRefreshJobs(limit: number, staleMinutes: number): Promise<MatchingRefreshJob[]>;
  renewRefreshJob(job: MatchingRefreshJob, staleMinutes: number): Promise<boolean>;
  completeRefreshJob(job: MatchingRefreshJob): Promise<boolean>;
  failRefreshJob(job: MatchingRefreshJob, errorCode: string): Promise<boolean>;
  listSummaries(postIds: string[], minimumScore: number): Promise<Map<string, {
    candidateCount: number;
    suggestionCount: number;
    topScore: number | null;
    topTier: MatchTier | null;
    lastCalculatedAt: string | null;
  }>>;
  replaceAnalysisTags(postId: string, input: {
    visualAttributes: string[];
    visibleText: string[];
    confidence: number;
  }, transaction?: TransactionContext): Promise<void>;
}
