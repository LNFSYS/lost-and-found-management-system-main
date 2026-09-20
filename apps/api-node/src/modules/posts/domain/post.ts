export type PostType = "LOST" | "FOUND";

export type PostStatus = "OPEN" | "MATCHED" | "RESOLVED" | "CLOSED" | "EXPIRED" | "HIDDEN";

export type VisibilityMode = "PUBLIC" | "PRIVATE_DETAILS";

export type MediaKind = "ITEM" | "EVIDENCE";

export interface PostMediaRecord {
  id: string;
  postId: string;
  mediaKind: MediaKind;
  resourceType: string;
  format: string | null;
  bytes: number | null;
  sortOrder: number;
  createdAt: string;
}

export interface StoredMediaRecord extends PostMediaRecord {
  secureUrl: string;
  publicId: string;
  ownerId: string;
  postStatus: PostStatus;
  postVisibilityMode: VisibilityMode;
  postDeletedAt: string | null;
}

export interface PostRecord {
  id: string;
  userId: string;
  ownerName: string;
  type: PostType;
  status: PostStatus;
  visibilityMode: VisibilityMode;
  title: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  areaId: string | null;
  areaName: string | null;
  buildingId: string | null;
  buildingName: string | null;
  roomText: string | null;
  customLocation: string | null;
  contactInfo: string | null;
  lostFoundAt: string | null;
  handoverPointId: string | null;
  handoverPointName: string | null;
  handoverPointAddress: string | null;
  expiresAt: string | null;
  resolvedAt: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  media: PostMediaRecord[];
}
