import type { ImageAnalyzer } from "../application/image-analyzer.port.js";
import { AppError } from "../../../shared/domain/app-error.js";
import { analysisPrompt, analysisSchema } from "./image-analysis-contract.js";
import { z } from "zod";

// This endpoint does not enforce JSON schema. Bound excess list entries without
// discarding an otherwise useful analysis; still reject invalid types/content.
const deepseekSchema = analysisSchema.extend({
  warnings: z.array(z.string().trim().min(1).max(220)).max(24).transform(items => items.slice(0, 6)).default([]),
  visualAttributes: z.array(z.string().trim().min(1).max(100)).max(24).transform(items => items.slice(0, 12)).default([]),
  visibleText: z.array(z.string().trim().min(1).max(100)).max(24).transform(items => items.slice(0, 12)).default([])
});

export function createDeepSeekImageAnalyzer(options: {
  apiKey: string | null; baseUrl: string; model: string; timeoutMs: number; request?: typeof fetch;
}): ImageAnalyzer {
  const request = options.request ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return {
    model: options.model,
    async analyze(files, type, categoryNames, context) {
      context?.signal?.throwIfAborted();
      if (!options.apiKey) throw new AppError("unavailable", "Dịch vụ DeepSeek chưa được cấu hình.");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const response = await request(`${options.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST", signal: context?.signal ? AbortSignal.any([controller.signal, context.signal]) : controller.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.apiKey}` },
          body: JSON.stringify({
            // Vilao includes reasoning tokens in the completion budget.
            model: options.model, stream: false, temperature: 0.1, max_tokens: 8192,
            messages: [{ role: "user", content: [
              { type: "text", text: analysisPrompt(type, categoryNames, files.length) +
                '\nChỉ nhận diện vật phẩm chính được chụp hoặc cầm trên tay; bỏ qua bàn tay và đồ vật nền. Trả JSON với các trường: title (string, 3–120 ký tự), description (string, 10–1200 ký tự), categoryName (string), visualAttributes (tối đa 12 string, mỗi string tối đa 100 ký tự), visibleText (tối đa 12 string, mỗi string tối đa 100 ký tự), confidence (number 0..1), warnings (tối đa 6 string, mỗi string tối đa 220 ký tự).' },
              ...files.map(file => ({ type: "image_url", image_url: {
                url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
              } }))
            ] }]
          })
        });
        if (!response.ok) {
          // Never log provider bodies: they may echo credentials or uploaded data.
          if (response.status === 429) throw new AppError("rate_limited", "DeepSeek đang quá tải hoặc hết hạn mức. Vui lòng thử lại sau.");
          if ([401, 403, 402].includes(response.status)) throw new AppError("unavailable", "Không thể truy cập DeepSeek. Kiểm tra API key, số dư và quyền dùng model trên Vilao.");
          if (response.status === 404) throw new AppError("unavailable", "Model DeepSeek chưa khả dụng. Kiểm tra cấu hình model và endpoint Vilao.");
          throw new AppError("upstream_failure", "DeepSeek chưa thể phân tích ảnh. Vui lòng thử lại sau.");
        }
        const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
        const choice = payload.choices?.[0];
        if (choice?.finish_reason === "length") throw new AppError("upstream_failure", "Kết quả DeepSeek bị ngắt trước khi hoàn tất. Vui lòng thử lại.");
        const content = choice?.message?.content;
        if (typeof content !== "string" || !content.trim()) throw new Error("Empty analysis");
        const json = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        return deepseekSchema.parse(JSON.parse(json));
      } catch (error) {
        context?.signal?.throwIfAborted();
        if (error instanceof AppError) throw error;
        if (controller.signal.aborted) throw new AppError("upstream_timeout", "DeepSeek phân tích quá thời gian. Vui lòng thử lại hoặc nhập thủ công.");
        throw new AppError("upstream_failure", "Không thể đọc kết quả DeepSeek. Vui lòng thử lại hoặc nhập thủ công.");
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
