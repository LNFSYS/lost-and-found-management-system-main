import type { ImageAnalyzer, ImageAnalysis } from "../application/image-analyzer.port.js";
import type { ImageUpload } from "../../../shared/domain/upload.js";
import { AppError } from "../../../shared/domain/app-error.js";

export interface LocalAiAnalyzerOptions {
  serviceUrl?: string;
  timeoutMs?: number;
  request?: typeof fetch;
  fallback?: ImageAnalyzer;
}

export function createLocalAiImageAnalyzer(options: LocalAiAnalyzerOptions = {}): ImageAnalyzer {
  const serviceUrl = options.serviceUrl || process.env.LNFS_AI_SERVICE_URL || "http://127.0.0.1:5000";
  const timeoutMs = options.timeoutMs ?? 15000;
  const request: typeof fetch = options.request ?? ((...args) => fetch(...args));

  return {
    model: "dinov2_vits14 + easyocr (local)",

    async analyze(files: ImageUpload[], type: "LOST" | "FOUND", categoryNames: string[]): Promise<ImageAnalysis> {
      if (!files.length) {
        throw new AppError("bad_request", "Cần ít nhất một ảnh để phân tích");
      }

      const primaryFile = files[0];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(primaryFile.buffer)], { type: primaryFile.mimetype });
        formData.append("file", blob, "image.jpg");

        const response = await request(`${serviceUrl}/api/extract-features`, {
          method: "POST",
          signal: controller.signal,
          body: formData
        });

        if (!response.ok) {
          throw new Error(`AI service returned HTTP ${response.status}`);
        }

        const data = await response.json() as {
          success?: boolean;
          embedding?: number[];
          ocrText?: string;
          visibleText?: string[];
          color?: string;
          condition?: string;
          title?: string;
          description?: string;
          visualAttributes?: string[];
          confidence?: number;
        };

        return {
          title: data.title || "Vật phẩm thất lạc",
          description: data.description || "Vật phẩm được ghi nhận hình ảnh trên hệ thống.",
          categoryName: "", // Để hệ thống gợi ý khớp tự động
          visualAttributes: data.visualAttributes || [],
          visibleText: data.visibleText || [],
          confidence: data.confidence ?? 0.85,
          warnings: [],
          imageEmbedding: data.embedding ?? null
        };
      } catch (err: unknown) {
        clearTimeout(timeout);
        // Nếu có fallback (như Gemini) khi AI service chưa bật:
        if (options.fallback) {
          return options.fallback.analyze(files, type, categoryNames);
        }
        const errorMsg = (err instanceof Error) ? err.message : String(err);
        throw new AppError("unavailable", `Không thể kết nối dịch vụ AI Local (${serviceUrl}): ${errorMsg}`);
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
