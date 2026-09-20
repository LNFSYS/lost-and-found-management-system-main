import type { ImageUpload } from "../../../shared/domain/upload.js";

export interface ImageAnalysis {
  title: string;
  description: string;
  categoryName: string;
  visualAttributes: string[];
  visibleText: string[];
  confidence: number;
  warnings: string[];
}

export interface ImageAnalyzer {
  readonly model: string;
  analyze(files: ImageUpload[], type: "LOST" | "FOUND", categoryNames: string[]): Promise<ImageAnalysis>;
}
