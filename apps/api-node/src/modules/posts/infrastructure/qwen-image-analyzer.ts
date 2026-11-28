import { z } from "zod";
import type { ImageAnalyzer } from "../application/image-analyzer.port.js";
import { AppError } from "../../../shared/domain/app-error.js";
import { polishedDescription, isObservedDetail, isHumanSubject, sentenceCase, resolveQwenCategory, uniqueEvidence } from "../domain/qwen-description.js";

const shortText = z.string().max(300);
const attributes = z.array(shortText).max(20);
const responseSchema = z.object({
  status: z.literal("success"),
  model: z.string(),
  data: z.object({
    category: shortText.nullable(), object_name: shortText.nullable(),
    colors: attributes, material: shortText.nullable(), brand: shortText.nullable(),
    visible_text: attributes, distinctive_features: attributes,
    caption: z.string().max(1500).nullable(),
    primary_color: shortText.nullable().optional(), secondary_colors: attributes.optional(),
    shape: shortText.nullable().optional(), pattern: shortText.nullable().optional()
  }),
  warnings: z.array(z.string()).optional()
});

export function createQwenImageAnalyzer(options: {
  serviceUrl: string; apiKey: string; timeoutMs?: number; request?: typeof fetch;
}): ImageAnalyzer {
  const url = new URL(options.serviceUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid Qwen service URL");
  }
  if (options.apiKey.length < 32) throw new Error("QWEN_API_KEY must contain at least 32 characters");
  const timeoutMs = options.timeoutMs ?? 180_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 1_800_000) throw new Error("Invalid Qwen timeout");
  const request = options.request ?? fetch;
  const unique = uniqueEvidence;
  return {
    model: "Qwen3-VL-2B-Instruct (local)",
    async analyze(files, type, categoryNames, context) {
      if (!files.length || files.length > 5) throw new AppError("bad_request", "Cần từ 1 đến 5 ảnh.");
      const results: z.infer<typeof responseSchema>[] = [];
      // Sequential requests: the laptop deliberately admits only one GPU inference.
      for (const file of files) {
        context?.signal?.throwIfAborted();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const body = new FormData();
          body.append("image", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), "image");
          body.append("type", type);
          body.append("user_description", [context?.title, context?.description].filter(Boolean).join("\n").slice(0, 2000));
          const response = await request(`${url.toString().replace(/\/$/, "")}/ai/analyze`, {
            method: "POST", body, signal: context?.signal ? AbortSignal.any([controller.signal, context.signal]) : controller.signal, redirect: "error",
            headers: { Authorization: `Bearer ${options.apiKey}` }
          });
          if (response.status === 429) throw new AppError("rate_limited", "Qwen đang xử lý ảnh khác, vui lòng thử lại.", 5);
          if (!response.ok) throw new AppError("unavailable", "Dịch vụ Qwen chưa sẵn sàng.");
          results.push(responseSchema.parse(await response.json()));
        } catch (error) {
          context?.signal?.throwIfAborted();
          if (error instanceof AppError) throw error;
          if (controller.signal.aborted) throw new AppError("upstream_timeout", "Qwen xử lý quá thời gian cho phép.");
          throw new AppError("upstream_failure", "Không nhận được kết quả Qwen hợp lệ.");
        } finally {
          clearTimeout(timer);
        }
      }
      const observations = results.filter(({ data }) => !isHumanSubject(data.object_name) && !isHumanSubject(data.category));
      const categories = observations.map(({ data }) => resolveQwenCategory([data.category, data.object_name], categoryNames));
      const resolvedCategories = categories.filter(Boolean);
      // Several views of one item: an unrecognized view must not erase an agreed
      // majority, but any recognized conflict still requires manual selection.
      const agreedCategory = resolvedCategories.length > results.length / 2
        && resolvedCategories.every(name => name === resolvedCategories[0]) ? resolvedCategories[0] : "";
      const conflictingCategories = new Set(resolvedCategories).size > 1;
      const evidence = conflictingCategories ? [] : agreedCategory ? observations.filter((_, index) => categories[index] === agreedCategory) : observations;
      const first = evidence[0]?.data;
      return {
        title: sentenceCase(first?.object_name ?? "Vật phẩm cần kiểm tra"),
        description: evidence.length ? polishedDescription(evidence.map(result => result.data.caption), first?.object_name ?? null,
          evidence.flatMap(({ data }) => data.colors), evidence.flatMap(({ data }) => [
            ...data.visible_text.map(text => `chữ “${text}”`),
            ...data.distinctive_features, ...(data.brand && !data.visible_text.includes(data.brand) ? [`chữ ${data.brand}`] : []), ...(data.shape ? [`dáng ${data.shape}`] : []),
            ...(data.pattern ? [`họa tiết ${data.pattern}`] : [])])) : "",
        categoryName: agreedCategory,
        visualAttributes: unique(evidence.flatMap(({ data }) => [
          ...data.colors, ...data.distinctive_features,
          ...(data.shape ? [data.shape] : []), ...(data.pattern ? [data.pattern] : []),
          ...(data.material ? [data.material] : []), ...(data.brand ? [data.brand] : [])
        ])).filter(isObservedDetail),
        visibleText: unique(evidence.flatMap(({ data }) => data.visible_text)),
        confidence: null,
        confidence_source: "unavailable",
        warnings: unique(["Bản nháp AI cần được kiểm tra; chưa có điểm tin cậy được hiệu chuẩn.",
          ...(conflictingCategories ? ["Các ảnh nhận diện thành những loại vật phẩm khác nhau; hãy chọn ảnh của cùng một món đồ. Chưa tự ghép tên và mô tả."] : []),
          ...(observations.length < results.length ? ["AI nhận nhầm người hoặc bàn tay trong một số ảnh; đã bỏ các nhận xét đó. Hãy chụp rõ món đồ nếu kết quả còn thiếu."] : []),
          ...(!agreedCategory ? ["Chưa xác định được danh mục; vui lòng chọn thủ công."] : []),
          ...results.flatMap(result => result.warnings ?? [])]),
        imageEmbedding: null
      };
    }
  };
}
