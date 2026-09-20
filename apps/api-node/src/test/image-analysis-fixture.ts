import { createGeminiImageAnalyzer } from "../modules/posts/infrastructure/gemini-image-analyzer.js";
import { createImageAnalysisUseCases } from "../modules/posts/application/image-analysis.use-cases.js";
import { env } from "../shared/infrastructure/config/env.js";
import { postRepository } from "./use-case-fixtures.js";
export { matchSuggestedCategory } from "../modules/posts/domain/image-category.js";
export const geminiImageService = createImageAnalysisUseCases({ postRepository, analyzer: createGeminiImageAnalyzer(env.gemini) });
