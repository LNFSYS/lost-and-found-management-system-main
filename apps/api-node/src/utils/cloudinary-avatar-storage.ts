import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import { env } from "../config/env.js";
import { HttpError } from "./http-error.js";

export interface CloudinaryAvatarRecord {
  publicId: string;
  assetId: string | null;
  version: number;
  format: string;
  resourceType: "image";
  bytes: number;
}

export interface AvatarStorage {
  upload(input: { buffer: Buffer; format: string }): Promise<CloudinaryAvatarRecord>;
  destroy(publicId: string): Promise<void>;
  download(input: { publicId: string; version: number; format: string }): Promise<{ body: Buffer; contentType: string }>;
}

type CloudinaryClient = typeof cloudinary;
type Fetcher = (input: string) => Promise<Response>;

function configuredClient(client: CloudinaryClient) {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new HttpError(503, "Dich vu luu anh dai dien chua duoc cau hinh");
  }
  client.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
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
  client?: CloudinaryClient;
  fetcher?: Fetcher;
} = {}): AvatarStorage {
  const client = options.client ?? cloudinary;
  const fetcher = options.fetcher ?? fetch;

  return {
    async upload(input) {
      const result = await uploadBuffer(configuredClient(client), input.buffer, {
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
      await configuredClient(client).uploader.destroy(publicId, {
        resource_type: "image",
        type: "authenticated",
        invalidate: true
      });
    },

    async download(input) {
      const deliveryUrl = configuredClient(client).url(input.publicId, {
        secure: true,
        sign_url: true,
        type: "authenticated",
        resource_type: "image",
        version: input.version,
        format: input.format
      });
      const response = await fetcher(deliveryUrl);
      if (!response.ok) throw new HttpError(404, "Khong the tai anh dai dien");
      return {
        body: Buffer.from(await response.arrayBuffer()),
        contentType: contentTypeFor(input.format)
      };
    }
  };
}

export const cloudinaryAvatarStorage = createCloudinaryAvatarStorage();
