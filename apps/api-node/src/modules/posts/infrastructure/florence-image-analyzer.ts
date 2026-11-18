import { z } from "zod";
import type { ImageAnalyzer } from "../application/image-analyzer.port.js";
import type { ImageUpload } from "../../../shared/domain/upload.js";
import { AppError } from "../../../shared/domain/app-error.js";

const resultSchema = z.object({
  caption: z.string(),
  more_detailed_caption: z.string(),
  objects: z.object({ labels: z.array(z.string()) }),
  dense_regions: z.object({ labels: z.array(z.string()) }).optional()
});

export function createFlorenceImageAnalyzer(options: {
  url: string; key: string; timeoutMs?: number; request?: typeof fetch;
}): ImageAnalyzer {
  const base = new URL(options.url);
  if (base.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)
    || base.username || base.password || base.pathname !== "/" || !options.key) {
    throw new Error("Invalid Florence-2 local configuration");
  }
  const endpoint = new URL("/analyze?caption_mode=lora&include_dense=true", base);
  return {
    model: "florence-2-large-ft-lora",
    async analyze(files: ImageUpload[]) {
      if (files.length !== 1) throw new AppError("bad_request", "Florence-2 chỉ phân tích một ảnh mỗi lần.");
      const file = files[0];
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), "item.jpg");
      let response: Response;
      try {
        response = await (options.request ?? fetch)(endpoint, {
          method: "POST", body: form, redirect: "error", signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
          headers: { Authorization: `Bearer ${options.key}` }
        });
      } catch {
        throw new AppError("unavailable", "Florence-2 chưa sẵn sàng. Bạn có thể nhập thủ công.");
      }
      if (!response.ok) throw new AppError("unavailable", "Florence-2 chưa sẵn sàng. Bạn có thể nhập thủ công.");
      const parsed = resultSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) throw new AppError("upstream_failure", "Kết quả Florence-2 không hợp lệ.");
      const result = parsed.data;
      const caption = result.more_detailed_caption.trim() || result.caption.trim();
      const attributes = [...new Set([...result.objects.labels, ...(result.dense_regions?.labels ?? [])])].slice(0, 8);
      return {
        title: "",
        description: caption ? `Chi tiết AI quan sát (tiếng Anh): ${caption}` : "",
        categoryName: "",
        visualAttributes: attributes,
        visibleText: [],
        confidence: 0,
        warnings: ["Florence-2 chưa xác minh danh mục, thương hiệu hoặc chữ trên ảnh. Vui lòng tự kiểm tra trước khi đăng."],
        modelVersion: "florence-2-large-ft-lora"
      };
    }
  };
}
