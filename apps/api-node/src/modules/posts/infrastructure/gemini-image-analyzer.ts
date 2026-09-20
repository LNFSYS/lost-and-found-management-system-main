import { z } from "zod";

import type { ImageAnalyzer } from "../application/image-analyzer.port.js";

import type { AnalyzePostImageInput } from "../application/post.dto.js";

import type { ImageUpload } from "../../../shared/domain/upload.js";

import { AppError } from "../../../shared/domain/app-error.js";

const analysisSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(1200),
  categoryName: z.string().trim().max(120),
  visualAttributes: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
  visibleText: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
  confidence: z.coerce.number().min(0).max(1),
  warnings: z.array(z.string().trim().min(1).max(220)).max(6).default([])
});

type GeminiAnalysis = z.infer<typeof analysisSchema>;

function analysisPrompt(type: AnalyzePostImageInput["type"], categoryNames: string[], imageCount: number) {
  const visibilityRule = type === "FOUND"
    ? "Với bài FOUND, mô tả đủ để nhận diện nhưng không công khai toàn bộ serial, mã thiết bị, số giấy tờ hoặc dấu hiệu bí mật có thể dùng để giả mạo chủ sở hữu; hãy đưa phần cần người nhặt giữ kín vào warnings."
    : "Với bài LOST, ưu tiên các đặc điểm giúp phân biệt vật phẩm nhưng vẫn không công khai toàn bộ serial, mã thiết bị, số giấy tờ hoặc dữ liệu cá nhân nhạy cảm.";

  return [
    "Bạn đang hỗ trợ tạo bản nháp bài đăng Lost & Found tại trường đại học.",
    `Loại bài đăng: ${type}.`,
    `Bạn nhận được ${imageCount} ảnh. Hãy đối chiếu các góc chụp để tạo một mô tả thống nhất cho cùng một vật phẩm; không lặp lại chi tiết chỉ vì chúng xuất hiện trong nhiều ảnh. Nếu ảnh có vẻ chứa nhiều vật phẩm khác nhau, phải cảnh báo rõ trong warnings.`,
    "Hãy quan sát ảnh thật kỹ và mô tả vật phẩm cụ thể, giàu chi tiết nhưng tuyệt đối không bịa thông tin không nhìn thấy rõ.",
    "Kiểm tra lần lượt: loại vật phẩm; hãng/logo; dòng sản phẩm, model, phiên bản hoặc biến thể; màu chính và màu phụ; hình dáng, kích thước tương đối và chất liệu; chữ, ký hiệu hoặc nhãn sản phẩm đọc được; số lượng; tình trạng; vết xước, móp, nứt, bẩn hoặc dấu hiệu riêng; phụ kiện đi kèm như ốp lưng, dây đeo, móc khóa, sticker, charm, hộp, cáp hoặc đầu chuyển.",
    "Với thiết bị điện tử, mô tả thêm cụm camera, cổng kết nối, nút bấm, kiểu vỏ và chi tiết thiết kế. Chỉ ghi chính xác kiểu như 'Apple iPhone 13 Pro' khi ảnh có căn cứ đủ rõ; nếu chỉ đoán được hãng hoặc dòng gần đúng thì ghi mức không chắc chắn trong warnings, không khẳng định.",
    "Được phép chép chữ không nhạy cảm trên sản phẩm như logo, tên hãng, tên model hoặc câu chữ trang trí. Không chép đầy đủ số giấy tờ, số điện thoại, email, mã QR, barcode, serial, IMEI hoặc dữ liệu cá nhân; chỉ mô tả rằng chúng tồn tại và che phần nhạy cảm.",
    visibilityRule,
    "visibleText chỉ gồm tối đa 12 cụm chữ không nhạy cảm nhìn thấy rõ như hãng, model hoặc câu trang trí. Không đưa serial đầy đủ, IMEI, QR, barcode, số giấy tờ, email hay số điện thoại vào trường này.",
    "Không suy đoán chủ sở hữu, vị trí, thời gian thất lạc/nhặt được, giá trị hoặc quyền sở hữu từ ảnh.",
    `Chọn categoryName đúng nguyên văn từ danh sách sau nếu nhận diện được, nếu không hãy để chuỗi rỗng: ${categoryNames.join(" | ")}.`,
    "title phải ngắn gọn nhưng cụ thể, ưu tiên cấu trúc: loại vật phẩm + hãng/model chắc chắn + màu hoặc dấu hiệu nổi bật.",
    "description viết bằng tiếng Việt tự nhiên, khoảng 3 đến 6 câu, tổng hợp càng nhiều đặc điểm nhìn thấy hữu ích càng tốt và nêu rõ phụ kiện đi kèm. Không dùng câu chung chung như 'một chiếc điện thoại' nếu ảnh cho thấy thêm thông tin.",
    "visualAttributes gồm 5 đến 12 cụm ngắn, không trùng nhau, ưu tiên hãng/model, màu, vật liệu, phụ kiện, chữ/logo, tình trạng và dấu hiệu phân biệt.",
    "warnings phải nêu từng thông tin chưa chắc chắn, phần ảnh bị che/mờ, dữ liệu cần người dùng tự xác nhận và đặc điểm nên giữ kín để staff kiểm tra. confidence nằm trong khoảng 0 đến 1 và phải phản ánh chất lượng ảnh cũng như độ chắc chắn của nhận diện.",
    "Trả về duy nhất JSON theo schema đã yêu cầu."
  ].join("\n");
}

export function createGeminiImageAnalyzer(options: { apiKey: string | null; model: string; timeoutMs: number; request?: typeof fetch; }): ImageAnalyzer {

  const request: typeof fetch = options.request ?? ((...args) => fetch(...args));

  async function requestGemini(files: ImageUpload[], type: AnalyzePostImageInput["type"], categoryNames: string[]) {
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
          signal: controller.signal,
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
      return analysisSchema.parse(JSON.parse(text)) as GeminiAnalysis;
    } catch (error) {
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
