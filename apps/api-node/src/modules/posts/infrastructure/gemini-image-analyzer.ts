import { analysisSchema, analysisPrompt } from "./image-analysis-contract.js";

import type { ImageAnalyzer, ImageAnalyzerContext } from "../application/image-analyzer.port.js";

import type { AnalyzePostImageInput } from "../application/post.dto.js";

import type { ImageUpload } from "../../../shared/domain/upload.js";

import { AppError } from "../../../shared/domain/app-error.js";

export function createGeminiImageAnalyzer(options: { apiKey: string | null; model: string; timeoutMs: number; request?: typeof fetch; }): ImageAnalyzer {

  const request: typeof fetch = options.request ?? ((...args) => fetch(...args));

  async function requestGemini(files: ImageUpload[], type: AnalyzePostImageInput["type"], categoryNames: string[], context?: ImageAnalyzerContext) {
    context?.signal?.throwIfAborted();
    if (!options.apiKey) {
      throw new AppError("unavailable", "Chức năng phân tích ảnh chưa được cấu hình. Vui lòng liên hệ quản trị viên.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await request(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`,
        {
          method: "POST",
          signal: context?.signal ? AbortSignal.any([controller.signal, context.signal]) : controller.signal,
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": options.apiKey
          },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: analysisPrompt(type, categoryNames, files.length) },
                ...files.flatMap((file, index) => [
                  { text: `Ảnh ${index + 1}/${files.length} - một góc quan sát do người dùng cung cấp:` },
                  { inlineData: { mimeType: file.mimetype, data: file.buffer.toString("base64") } }
                ])
              ]
            }],
            generationConfig: {
              temperature: 0.15,
              responseMimeType: "application/json",
              responseJsonSchema: {
                type: "object",
                additionalProperties: false,
                required: ["title", "description", "categoryName", "visualAttributes", "visibleText", "confidence", "warnings"],
                properties: {
                  title: { type: "string", minLength: 3, maxLength: 120 },
                  description: { type: "string", minLength: 10, maxLength: 1200 },
                  categoryName: { type: "string", maxLength: 120 },
                  visualAttributes: { type: "array", maxItems: 12, items: { type: "string" } },
                  visibleText: { type: "array", maxItems: 12, items: { type: "string" } },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  warnings: { type: "array", maxItems: 6, items: { type: "string" } }
                }
              }
            }
          })
        }
      );

      if (!response.ok) {
        const providerError = await response.json().catch(() => null) as {
          error?: { status?: string; };
        } | null;
        console.warn("Gemini image analysis request failed", {
          status: response.status,
          providerStatus: providerError?.error?.status ?? "UNKNOWN",
          model: options.model
        });
        if (response.status === 404) {
          throw new AppError("unavailable", "Mô hình phân tích ảnh hiện không khả dụng. Vui lòng liên hệ quản trị viên để kiểm tra GEMINI_MODEL.");
        }
        if (response.status === 429) throw new AppError("rate_limited", "Dịch vụ phân tích ảnh đang quá tải. Vui lòng thử lại sau.");
        if (response.status === 401 || response.status === 403) {
          throw new AppError("unavailable", "Cấu hình Gemini API chưa hợp lệ. Vui lòng liên hệ quản trị viên.");
        }
        throw new AppError("upstream_failure", "Không thể phân tích ảnh lúc này. Vui lòng nhập thông tin thủ công.");
      }

      const payload = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string; }>; }; }>;
      };
      const text = payload.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
      if (!text) throw new AppError("upstream_failure", "Gemini không trả về kết quả có thể sử dụng.");
      return analysisSchema.parse(JSON.parse(text));
    } catch (error) {
      context?.signal?.throwIfAborted();
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("upstream_timeout", "Phân tích ảnh quá thời gian. Vui lòng thử lại hoặc nhập thủ công.");
      }
      console.warn("Gemini image analysis response could not be processed", {
        error: error instanceof Error ? error.name : "unknown"
      });
      throw new AppError("upstream_failure", "Không thể đọc kết quả phân tích ảnh. Vui lòng nhập thông tin thủ công.");
    } finally {
      clearTimeout(timeout);
    }
  }

  return { model: options.model, analyze: requestGemini };

}
