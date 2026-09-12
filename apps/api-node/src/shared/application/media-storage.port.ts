export interface StoredUpload {
  secureUrl: string;
  publicId: string;
}

export interface ResolvedMedia {
  body: Buffer;
  contentType: string;
}

export interface PrivateMediaStorage {
  save(ownerId: string, mediaId: string, extension: string, bytes: Buffer): Promise<StoredUpload>;
  resolve(secureUrl: string, format?: string): Promise<ResolvedMedia>;
  remove(secureUrl: string): Promise<void>;
}
