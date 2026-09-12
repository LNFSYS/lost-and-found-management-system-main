import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { MatchCandidate, MatchExplanation, MatchTier, ScoredMatch } from "../domain/matching.engine.js";

export interface MatchingRepository {
  getConfigNumber(key: string, fallback: number): Promise<number>;
  findCandidate(postId: string): Promise<MatchCandidate | null>;
  listOppositeCandidates(source: MatchCandidate, candidateLimit: number, candidateWindowDays: number): Promise<MatchCandidate[]>;
  persistForSource(source: MatchCandidate, matches: ScoredMatch[]): Promise<void>;
  listForPost(postId: string, minimumScore: number): Promise<{
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
  }[]>;
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
