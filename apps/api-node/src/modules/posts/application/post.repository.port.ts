import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { MediaKind, PostRecord, PostStatus, PostType, StoredMediaRecord, VisibilityMode } from "../domain/post.js";
export type { MediaKind, PostMediaRecord, PostRecord, PostStatus, PostType, StoredMediaRecord, VisibilityMode } from "../domain/post.js";

import type { ListOwnPostsQuery, ListPostsQuery } from "./post.dto.js";

import type { PostReadScope } from "../domain/post-access.js";

export interface PostRepository {
  getFormCatalog(): Promise<{
    categories: {
      id: string;
      name: string;
      parentId: string | null;
    }[];
    areas: {
      id: string;
      name: string;
    }[];
    buildings: {
      id: string;
      areaId: string;
      name: string;
    }[];
    handoverPoints: {
      id: string;
      name: string;
      address: string;
      openingHours: string | null;
    }[];
  }>;
  listBoard(filters: ListPostsQuery, scope: PostReadScope): Promise<{
    total: number;
    page: number;
    pageSize: number;
    items: PostRecord[];
  }>;
  listByOwner(ownerId: string, filters: ListOwnPostsQuery): Promise<{
    total: number;
    page: number;
    pageSize: number;
    items: PostRecord[];
  }>;
  findVisibleById(postId: string): Promise<PostRecord | null>;
  findVisibleByIds(postIds: string[]): Promise<PostRecord[]>;
  findOwnedById(postId: string, ownerId: string, queryable?: TransactionContext): Promise<PostRecord | null>;
  findOwnedByIdForUpdate(postId: string, ownerId: string, queryable: TransactionContext): Promise<PostRecord | null>;
  createPost(input: {
    id: string;
    userId: string;
    type: PostType;
    visibilityMode: VisibilityMode;
    title: string;
    titleNormalized: string;
    description: string;
    descriptionNormalized: string;
    categoryId: string;
    areaId?: string | null;
    buildingId?: string | null;
    roomText?: string | null;
    customLocation?: string | null;
    contactInfo: string;
    lostFoundAt: Date;
    handoverPointId?: string | null;
    expiresAt: Date;
  }, queryable?: TransactionContext): Promise<void>;
  updatePost(postId: string, input: {
    title?: string;
    titleNormalized?: string;
    description?: string;
    descriptionNormalized?: string;
    categoryId?: string;
    areaId?: string | null;
    buildingId?: string | null;
    roomText?: string | null;
    customLocation?: string | null;
    contactInfo?: string;
    lostFoundAt?: Date;
    handoverPointId?: string | null;
    visibilityMode?: VisibilityMode;
    status?: PostStatus;
    resolvedAt?: Date | null;
  }, queryable?: TransactionContext): Promise<void>;
  softDeletePost(postId: string, ownerId: string): Promise<boolean>;
  lockOwnedPostForMedia(postId: string, ownerId: string, queryable: TransactionContext): Promise<{
    id: string;
    status: PostStatus;
  } | null>;
  countMedia(postId: string, queryable?: TransactionContext): Promise<number>;
  createMedia(input: {
    id: string;
    postId: string;
    secureUrl: string;
    publicId: string;
    mediaKind: MediaKind;
    format: string;
    bytes: number;
    sortOrder: number;
  }, queryable?: TransactionContext): Promise<void>;
  findMedia(postId: string, mediaId: string, queryable?: TransactionContext, forUpdate?: boolean): Promise<StoredMediaRecord | null>;
  deleteMedia(postId: string, mediaId: string, queryable?: TransactionContext): Promise<boolean>;
  findActiveCategory(categoryId: string): Promise<string>;
  findActiveArea(areaId: string): Promise<string>;
  findActiveBuilding(buildingId: string): Promise<{
    id: string;
    areaId: string;
  } | null>;
  findActiveHandoverPoint(handoverPointId: string): Promise<string>;
}
