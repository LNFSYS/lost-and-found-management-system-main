import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import type { PrivateMediaStorage, ResolvedMedia } from "../application/media-storage.port.js";
import { AppError } from "../domain/app-error.js";
import { mediaContentType, type ImageFormat } from "../domain/media.js";

type CloudinaryClient = typeof cloudinary;
type Fetcher = (input: string) => Promise<Response>;
type CloudinaryConfig = { cloudName: string | null; apiKey: string | null; apiSecret: string | null; };
type ConfiguredCloudinary = { cloudName: string; apiKey: string; apiSecret: string; };
type MediaNamespace = "post-media" | "claim-evidence";

function isConfigured(config: CloudinaryConfig): config is ConfiguredCloudinary {
  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
}

function configuredClient(client: CloudinaryClient, config: CloudinaryConfig) {
  if (!isConfigured(config)) {
    throw new AppError("unavailable", "Dich vu luu anh chua duoc cau hinh");
  }
  client.config({ cloud_name: config.cloudName, api_key: config.apiKey, api_secret: config.apiSecret, secure: true });
  return client;
}

function uploadBuffer(client: CloudinaryClient, buffer: Buffer, options: UploadApiOptions) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = client.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      if (!result) return reject(new Error("Cloudinary khong tra ve ket qua upload"));
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
    if (parts.length !== 2) throw new AppError("not_found", "Media khong hop le");
    const [ownerId, filename] = parts;
    const match = filename.match(/^([0-9a-f-]{36})\.(jpg|png|webp)$/i);
    if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !match) throw new AppError("not_found", "Media khong hop le");
    return {
      publicId: `${folder}/${ownerId}/${match[1]}`,
      format: imageFormat(match[2])
    };
  }

  async function download(secureUrl: string, format?: string): Promise<ResolvedMedia> {
    const reference = parseReference(secureUrl);
    if (!reference) {
      if (options.fallback) return options.fallback.resolve(secureUrl, format);
      throw new AppError("not_found", "Media khong hop le");
    }
    const image = imageFormat(format ?? reference.format);
    const deliveryUrl = configuredClient(client, options.config).url(reference.publicId, {
      secure: true,
      sign_url: true,
      type: "authenticated",
      resource_type: "image",
      format: image
    });
    const response = await fetcher(deliveryUrl);
    if (!response.ok) throw new AppError("not_found", "Khong the tai anh media");
    return { body: Buffer.from(await response.arrayBuffer()), contentType: mediaContentType(image) };
  }

  return {
    async save(ownerId, mediaId, extension, bytes) {
      if (!isConfigured(options.config) && options.fallback) {
        return options.fallback.save(ownerId, mediaId, extension, bytes);
      }
      const image = imageFormat(extension);
      const result = await uploadBuffer(configuredClient(client, options.config), bytes, {
        folder,
        public_id: `${ownerId}/${mediaId}`,
        resource_type: "image",
        type: "authenticated",
        format: image,
        overwrite: false,
        unique_filename: false
      });
      return {
        secureUrl: `${prefix}${ownerId}/${mediaId}.${image}`,
        publicId: result.public_id
      };
    },

    async resolve(secureUrl, format) {
      return download(secureUrl, format);
    },

    async remove(secureUrl) {
      const reference = parseReference(secureUrl);
      if (!reference) {
        if (options.fallback) return options.fallback.remove(secureUrl);
        throw new AppError("not_found", "Media khong hop le");
      }
      await configuredClient(client, options.config).uploader.destroy(reference.publicId, {
        resource_type: "image",
        type: "authenticated",
        invalidate: true
      });
    }
  };
}
