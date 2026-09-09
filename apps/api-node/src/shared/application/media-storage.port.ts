export interface StoredUpload {
  secureUrl: string;
  publicId: string;
}

export interface PrivateMediaStorage {
  save(ownerId: string, mediaId: string, extension: string, bytes: Buffer): Promise<StoredUpload>;
  resolve(secureUrl: string): Promise<string>;
  remove(secureUrl: string): Promise<void>;
}
