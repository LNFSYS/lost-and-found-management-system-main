import { z } from "zod";
import type { ImageAnalyzer } from "../application/image-analyzer.port.js";
import type { ImageUpload } from "../../../shared/domain/upload.js";
import { AppError } from "../../../shared/domain/app-error.js";

const prediction = z.object({ label: z.string().min(1), confidence: z.number().finite().min(0).max(1) });
const resultSchema = z.object({
  schema_version: z.literal("1"), model_version: z.string().startsWith("mobilenetv3-small-lnfs-v1:"),
  category_name: z.string(), confidence: z.number().finite().min(0).max(1),
  top3: z.array(prediction).length(3), requires_confirmation: z.literal(true),
  confidence_calibrated: z.literal(false), score_kind: z.literal("uncalibrated_softmax"),
  warnings: z.array(z.string())
});

function categoryKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");
}

export function createMobileNetDescriptionAnalyzer(options: {
  url: string; key: string; timeoutMs: number; request?: typeof fetch;
}): ImageAnalyzer {
  const url = new URL("/v1/describe", options.url);
  if (!options.key || url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    || url.username || url.password) {
    throw new Error("Invalid AI Description configuration");
  }
  return {
    model: "mobilenetv3-small-lnfs-v1",
    async analyze(files: ImageUpload[], type, catalog) {
      if (files.some(file => file.size > 8 * 1024 * 1024)) {
        throw new AppError("payload_too_large", "Mỗi ảnh phân tích không được vượt quá 8 MB.");
      }
      const form = new FormData();
      for (const file of files) {
        form.append("files", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), "item");
      }
      let response: Response;
      try {
        response = await (options.request ?? fetch)(url, {
          method: "POST", body: form, redirect: "error", signal: AbortSignal.timeout(options.timeoutMs),
          headers: { "X-AI-Service-Key": options.key }
        });
      } catch {
        throw new AppError("unavailable", "AI phân loại ảnh chưa sẵn sàng. Bạn có thể nhập thủ công.");
      }
      if (!response.ok) throw new AppError("unavailable", "AI phân loại ảnh chưa sẵn sàng. Bạn có thể nhập thủ công.");
      const parsed = resultSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success || parsed.data.top3[0].label !== parsed.data.category_name
        || Math.abs(parsed.data.top3[0].confidence - parsed.data.confidence) > 0.000001) {
        throw new AppError("upstream_failure", "Gợi ý AI không hợp lệ. Bạn có thể nhập thủ công.");
      }
      const result = parsed.data;
      const names = new Map(catalog.map(name => [categoryKey(name), name]));
      const categoryName = names.get(categoryKey(result.category_name)) ?? "";
      const candidates = result.top3.flatMap(item => {
        const name = names.get(categoryKey(item.label));
        return name ? [{ name, score: item.confidence }] : [];
      });
      const label = categoryName || "vật phẩm chưa xác định";
      return {
        title: `${type === "LOST" ? "Báo mất" : "Nhặt được"} ${label}`,
        description: `Có thể là ${label}. Vui lòng tự kiểm tra và bổ sung các đặc điểm nhận dạng trước khi đăng.`,
        categoryName,
        categoryCandidates: candidates,
        visualAttributes: [], visibleText: [], confidence: result.confidence,
        warnings: [...result.warnings, "Điểm dự đoán chưa được hiệu chuẩn; hãy kiểm tra danh mục và sửa nếu cần."],
        modelVersion: result.model_version
      };
    }
  };
}
