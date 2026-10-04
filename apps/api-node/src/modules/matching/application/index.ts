// Public contracts for other business modules.
export { redactPrivateMatchExplanation } from "../domain/matching.engine.js";
export type { MatchExplanation } from "../domain/matching.engine.js";
export type { MatchingRepository } from "./matching.repository.port.js";
export type { MatchingUseCases } from "./matching.use-cases.js";
export { scoreContactPhoto } from "./contact-photo-scoring.js";
export type { MatchCandidate } from "../domain/matching.engine.js";
