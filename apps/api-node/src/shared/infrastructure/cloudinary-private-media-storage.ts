import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import type { PrivateMediaStorage, ResolvedMedia } from "../application/media-storage.port.js";
import { AppError } from "../domain/app-error.js";
import { mediaContentType, type ImageFormat } from "../domain/media.js";

type CloudinaryClient = typeof cloudinary;
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type CloudinaryConfig = { cloudName: string | null; apiKey: string | null; apiSecret: string | null; };
type ConfiguredCloudinary = { cloudName: string; apiKey: string; apiSecret: string; };
type MediaNamespace = "post-media" | "claim-evidence" | "warehouse-proof";
const DELIVERY_TIMEOUT_MS = 15_000;

function deliveryFailure(error: unknown): AppError {
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
  const code = typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : undefined;
  const timedOut = (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))
    || code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT";
  return new AppError(timedOut ? "upstream_timeout" : "upstream_failure", timedOut
    ? "Dịch vụ ảnh phản hồi quá chậm, vui lòng thử lại"
    : "Dịch vụ ảnh tạm thời không khả dụng, vui lòng thử lại");
}

function deliveryCauseCode(error: unknown): string | undefined {
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
  if (typeof cause !== "object" || cause === null || !("code" in cause)) return undefined;
  const code = String(cause.code);
  return /^[A-Z][A-Z0-9_]{1,40}$/.test(code) ? code : undefined;
}

function isConfigured(config: CloudinaryConfig): config is ConfiguredCloudinary {
  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
}

function configuredClient(client: CloudinaryClient, config: CloudinaryConfig) {
  if (!isConfigured(config)) {
    throw new AppError("unavailable", "Dịch vụ lưu ảnh chưa được cấu hình");
  }
  client.config({ cloud_name: config.cloudName, api_key: config.apiKey, api_secret: config.apiSecret, secure: true });
  return client;
}

function uploadBuffer(client: CloudinaryClient, buffer: Buffer, options: UploadApiOptions) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = client.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      if (!result) return reject(new Error("Cloudinary không trả về kết quả tải ảnh lên"));
      resolve(result);
    });
    stream.end(buffer);
  });
}

function imageFormat(value: string | undefined): ImageFormat {
  if (value === "png" || value === "webp") return value;
  return "jpg";
}

export function createCloudinaryPrivateMediaStorage(options: {
  config: CloudinaryConfig;
  namespace: MediaNamespace;
  fallback?: PrivateMediaStorage;
  allowLocalWrites?: boolean;
  client?: CloudinaryClient;
  fetcher?: Fetcher;
}): PrivateMediaStorage {
  const client = options.client ?? cloudinary;
  const fetcher = options.fetcher ?? fetch;
  const prefix = `cloudinary://${options.namespace}/`;
  const folder = `lnfs/${options.namespace}`;

  function parseReference(secureUrl: string) {
    if (!secureUrl.startsWith(prefix)) return null;
    const parts = secureUrl.slice(prefix.length).split("/");
    if (parts.length !== 2) throw new AppError("not_found", "Ảnh không hợp lệ");
    const [ownerId, filename] = parts;
    const match = filename.match(/^([0-9a-f-]{36})\.(jpg|png|webp)$/i);
    if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !match) throw new AppError("not_found", "Ảnh không hợp lệ");
    return {
      publicId: `${folder}/${ownerId}/${match[1]}`,
      format: imageFormat(match[2])
    };
  }

  async function download(secureUrl: string, format?: string): Promise<ResolvedMedia> {
    const reference = parseReference(secureUrl);
    if (!reference) {
      if (options.fallback) return options.fallback.resolve(secureUrl, format);
      throw new AppError("not_found", "Ảnh không hợp lệ");
    }
    const image = imageFormat(format ?? reference.format);
    const deliveryUrl = configuredClient(client, options.config).url(reference.publicId, {
      secure: true,
      sign_url: true,
      type: "authenticated",
      resource_type: "image",
      format: image
    });
    let response: Response;
    try {
      response = await fetcher(deliveryUrl, { signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS) });
    } catch (error) {
      console.warn("media_delivery_failed", { namespace: options.namespace, stage: "fetch", causeCode: deliveryCauseCode(error) });
      throw deliveryFailure(error);
    }
    if (!response.ok) {
      console.warn("media_delivery_failed", { namespace: options.namespace, stage: "response", status: response.status });
      throw new AppError(response.status === 404 ? "not_found" : "upstream_failure", response.status === 404
        ? "Không thể tải ảnh" : "Dịch vụ ảnh tạm thời không khả dụng, vui lòng thử lại");
    }
    try {
      return { body: Buffer.from(await response.arrayBuffer()), contentType: mediaContentType(image) };
    } catch (error) {
      console.warn("media_delivery_failed", { namespace: options.namespace, stage: "body", causeCode: deliveryCauseCode(error) });
      throw deliveryFailure(error);
    }
  }

  return {
    async save(ownerId, mediaId, extension, bytes) {
      if (!isConfigured(options.config) && options.fallback && options.allowLocalWrites !== false) {
        return options.fallback.save(ownerId, mediaId, extension, bytes);
      }
      const image = imageFormat(extension);
      const configured = configuredClient(client, options.config);
      let result: UploadApiResponse;
      try {
        result = await uploadBuffer(configured, bytes, {
          folder,
          public_id: `${ownerId}/${mediaId}`,
          resource_type: "image",
          type: "authenticated",
          format: image,
          overwrite: false,
          unique_filename: false
        });
      } catch {
        throw new AppError("upstream_failure", "Dịch vụ lưu ảnh tạm thời không khả dụng");
      }
      const expectedId = `${folder}/${ownerId}/${mediaId}`;
      if (result.public_id && result.public_id !== expectedId) throw new AppError("upstream_failure", "Dịch vụ lưu ảnh trả về mã tham chiếu không hợp lệ");
      if (result.existing) await download(`${prefix}${ownerId}/${mediaId}.${image}`, image);
      else if (!result.public_id) throw new AppError("upstream_failure", "Dịch vụ lưu ảnh không xác nhận được tệp");
      return {
        secureUrl: `${prefix}${ownerId}/${mediaId}.${image}`,
        publicId: expectedId
      };
    },

    async resolve(secureUrl, format) {
      return download(secureUrl, format);
    },

    async remove(secureUrl) {
      const reference = parseReference(secureUrl);
      if (!reference) {
        if (options.fallback) return options.fallback.remove(secureUrl);
        throw new AppError("not_found", "Ảnh không hợp lệ");
      }
      await configuredClient(client, options.config).uploader.destroy(reference.publicId, {
        resource_type: "image",
        type: "authenticated",
        invalidate: true
      });
    }
  };
}
