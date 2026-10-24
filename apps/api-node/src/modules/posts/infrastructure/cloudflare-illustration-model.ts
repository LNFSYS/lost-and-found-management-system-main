import type { IllustrationModel } from "../application/illustration.port.js";
import { AppError } from "../../../shared/domain/app-error.js";
import { mediaPolicy, validateImageUpload } from "../../../shared/domain/media.js";

export function createCloudflareIllustrationModel(options: {
  token: string | null; accountId: string | null; steps: number; timeoutMs: number;
  guard: IllustrationModel; request?: typeof fetch; now?: () => number;
}): IllustrationModel {
  const request = options.request ?? fetch;
  const configured = Boolean(options.token) && /^[a-f0-9]{32}$/i.test(options.accountId ?? "");
  const now = options.now ?? Date.now;
  let blocked: { until: number; message: string } | null = null;
  const cooldown = () => [blocked, options.guard.cooldown].filter(value => value && value.until > now())
    .sort((a, b) => b!.until - a!.until)[0] ?? null;
  function check() {
    if (!configured || !options.guard.available) throw new AppError("unavailable", "Chức năng tạo ảnh chưa được cấu hình đầy đủ.");
    const pause = cooldown();
    if (pause) throw new AppError("rate_limited", pause.message, Math.ceil((pause.until - now()) / 1000));
  }
  return {
    available: configured && options.guard.available,
    get cooldown() { return cooldown(); },
    async describe(input, context) { check(); return options.guard.describe(input, context); },
    verify: (image, spec, context) => options.guard.verify(image, spec, context),
    async generate(spec, context) {
      check();
      const signal = AbortSignal.timeout(options.timeoutMs);
      let status: number | undefined;
      try {
        const prompt = "One lost physical object on a plain light background. Follow only the supplied object attributes and reference. "
            + "No people, extra objects, personal data, readable documents, serial numbers or QR codes. Hypothetical illustration. "
            + JSON.stringify({ reference: context.reference, object: spec });
        if (prompt.length > 2048) throw new AppError("invalid_input", "Mô tả tạo ảnh quá dài. Vui lòng rút gọn đặc điểm vật phẩm.");
        const response = await request(`https://api.cloudflare.com/client/v4/accounts/${options.accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
          method: "POST", signal, headers: { Authorization: `Bearer ${options.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, steps: Math.max(1, Math.min(8, Math.trunc(options.steps))) })
        });
        status = response.status;
        if (!response.ok) { await response.body?.cancel(); throw new Error("Provider rejected request"); }
        // Bound the JSON/base64 response before buffering or decoding provider data.
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Missing image response");
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > Math.ceil(mediaPolicy.maxBytes * 4 / 3) + 4096) {
              await reader.cancel();
              throw new AppError("payload_too_large", "Ảnh tạo ra vượt giới hạn 10 MB.");
            }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { success?: boolean; result?: { image?: unknown } };
        const encoded = payload.result?.image;
        if (payload.success !== true || typeof encoded !== "string" || !encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("Invalid image response");
        const buffer = Buffer.from(encoded, "base64");
        const image = { buffer, size: buffer.length, mimetype: "image/jpeg", originalname: "lost-illustration" };
        validateImageUpload(image);
        return image;
      } catch (error) {
        if (error instanceof AppError) throw error;
        const timedOut = signal.aborted || error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
        const message = status === 402 ? "Cloudflare yêu cầu kiểm tra hạn mức tài khoản."
          : status === 429 ? "Cloudflare đang giới hạn yêu cầu hoặc hết quota. Vui lòng thử lại sau."
          : status === 401 || status === 403 ? "Cloudflare chưa cho phép tạo ảnh. Vui lòng kiểm tra Account ID và quyền Workers AI của token."
          : status === 404 ? "Model tạo ảnh chưa khả dụng trên provider đã chọn."
          : timedOut ? "Dịch vụ tạo ảnh chưa phản hồi kịp. Vui lòng kiểm tra trạng thái trước khi thử lại."
          : "Dịch vụ tạo ảnh tạm thời không khả dụng. Vui lòng thử lại sau.";
        blocked = { until: now() + 60_000, message };
        throw new AppError(timedOut ? "upstream_timeout" : status === 429 ? "rate_limited"
          : [401, 402, 403, 404].includes(status ?? 0) ? "unavailable" : "upstream_failure", message, 60);
      }
    }
  };
}
