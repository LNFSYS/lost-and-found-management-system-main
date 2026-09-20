import type { ImageAnalyzer } from "./image-analyzer.port.js";

import type { PostRepository } from "./post.repository.port.js";

import type { AnalyzePostImageInput } from "./post.dto.js";

import type { ImageUpload } from "../../../shared/domain/upload.js";

import { AppError } from "../../../shared/domain/app-error.js";

import { validateImageUpload } from "../../../shared/domain/media.js";

import { matchSuggestedCategory } from "../domain/image-category.js";

const MAX_ANALYSIS_IMAGES = 5;

const MAX_ANALYSIS_TOTAL_BYTES = 14 * 1024 * 1024;

export function createImageAnalysisUseCases({ postRepository, analyzer }: { postRepository: Pick<PostRepository, "getFormCatalog">; analyzer: ImageAnalyzer; }) {

  const useCases = {
    async analyzePostImages(files: ImageUpload[], type: AnalyzePostImageInput["type"]) {
      if (!files.length) throw new AppError("bad_request", "Cần gửi ít nhất một ảnh để phân tích.");
      if (files.length > MAX_ANALYSIS_IMAGES) {
        throw new AppError("bad_request", `Chỉ được phân tích tối đa ${MAX_ANALYSIS_IMAGES} ảnh trong một lần.`);
      }
      files.forEach(validateImageUpload);
      const totalBytes = files.reduce((total, file) => total + file.size, 0);
      if (totalBytes > MAX_ANALYSIS_TOTAL_BYTES) {
        throw new AppError("payload_too_large", "Tổng dung lượng ảnh phân tích không được vượt quá 14 MB.");
      }
      const catalog = await postRepository.getFormCatalog();
      const leafCategories = catalog.categories.filter((category) => category.parentId !== null);
      if (!leafCategories.length) throw new AppError("unavailable", "Danh mục vật phẩm chưa sẵn sàng để phân tích ảnh.");

      const result = await analyzer.analyze(files, type, leafCategories.map((category) => category.name));
      const suggestedCategory = matchSuggestedCategory(result.categoryName, leafCategories);
      return {
        title: result.title,
        description: result.description,
        suggestedCategory,
        visualAttributes: result.visualAttributes,
        visibleText: result.visibleText,
        confidence: result.confidence,
        warnings: result.warnings,
        assistedBy: "Gemini image understanding",
        model: analyzer.model,
        imageCount: files.length
      };
    }
  };

  return useCases;

}

export type ImageAnalysisUseCases = ReturnType<typeof createImageAnalysisUseCases>;
