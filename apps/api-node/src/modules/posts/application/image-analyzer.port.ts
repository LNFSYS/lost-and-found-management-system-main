import type { ImageUpload } from "../../../shared/domain/upload.js";

export interface ImageAnalysis {
  title: string;
  description: string;
  categoryName: string;
  visualAttributes: string[];
  visibleText: string[];
  confidence: number;
  warnings: string[];
  categoryCandidates?: { name: string; score: number }[];
  modelVersion?: string;
  imageEmbedding?: number[] | null;
  isSensitiveDocument?: boolean;
  documentType?: string | null;
  sensitiveReason?: string | null;
}

export interface ImageAnalyzerContext {
  title?: string;
  description?: string;
}

export interface ImageAnalyzer {
  readonly model: string;
  analyze(files: ImageUpload[], type: "LOST" | "FOUND", categoryNames: string[], context?: ImageAnalyzerContext): Promise<ImageAnalysis>;
}
