import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import { AppError } from "../../../shared/domain/app-error.js";

import type { AvatarStorage } from "../application/avatar-storage.port.js";
export type { AvatarStorage, AvatarRecord as CloudinaryAvatarRecord } from "../application/avatar-storage.port.js";

type CloudinaryClient = typeof cloudinary;
type Fetcher = (input: string) => Promise<Response>;

type CloudinaryConfig = { cloudName: string | null; apiKey: string | null; apiSecret: string | null; };

function configuredClient(client: CloudinaryClient, config: CloudinaryConfig) {
  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    throw new AppError("unavailable", "Dich vu luu anh dai dien chua duoc cau hinh");
  }
  client.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true
  });
  return client;
}

function uploadBuffer(client: CloudinaryClient, buffer: Buffer, options: UploadApiOptions) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = client.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      if (!result) {
        reject(new Error("Cloudinary khong tra ve ket qua upload"));
        return;
      }
      resolve(result);
    });
    stream.end(buffer);
  });
}

function contentTypeFor(format: string) {
  if (format === "jpg" || format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  return "image/webp";
}

export function createCloudinaryAvatarStorage(options: {
  config: CloudinaryConfig;
  client?: CloudinaryClient;
  fetcher?: Fetcher;
}): AvatarStorage {
  const client = options.client ?? cloudinary;
  const fetcher = options.fetcher ?? fetch;

  return {
    async upload(input) {
      const result = await uploadBuffer(configuredClient(client, options.config), input.buffer, {
        folder: "lnfs/avatars",
        resource_type: "image",
        type: "authenticated",
        format: input.format,
        overwrite: false,
        unique_filename: true
      });
      return {
        publicId: result.public_id,
        assetId: result.asset_id ?? null,
        version: result.version,
        format: result.format,
        resourceType: "image",
        bytes: result.bytes
      };
    },

    async destroy(publicId) {
      await configuredClient(client, options.config).uploader.destroy(publicId, {
        resource_type: "image",
        type: "authenticated",
        invalidate: true
      });
    },

    async download(input) {
      const deliveryUrl = configuredClient(client, options.config).url(input.publicId, {
        secure: true,
        sign_url: true,
        type: "authenticated",
        resource_type: "image",
        version: input.version,
        format: input.format
      });
      const response = await fetcher(deliveryUrl);
      if (!response.ok) throw new AppError("not_found", "Khong the tai anh dai dien");
      return {
        body: Buffer.from(await response.arrayBuffer()),
        contentType: contentTypeFor(input.format)
      };
    }
  };
}
