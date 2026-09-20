export interface AvatarRecord {
  publicId: string;
  assetId: string | null;
  version: number;
  format: string;
  resourceType: "image";
  bytes: number;
}

export interface AvatarStorage {
  upload(input: { buffer: Buffer; format: string; }): Promise<AvatarRecord>;
  destroy(publicId: string): Promise<void>;
  download(input: { publicId: string; version: number; format: string; }): Promise<{ body: Buffer; contentType: string; }>;
}
