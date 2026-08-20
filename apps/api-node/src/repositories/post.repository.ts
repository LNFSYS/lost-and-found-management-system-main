import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import { normalizeVietnameseText } from "../utils/text.js";
import type { ListOwnPostsQuery, ListPostsQuery } from "../validators/post.validator.js";

export type PostType = "LOST" | "FOUND";
export type PostStatus = "OPEN" | "MATCHED" | "RESOLVED" | "CLOSED" | "EXPIRED" | "HIDDEN";
export type VisibilityMode = "PUBLIC" | "PRIVATE_DETAILS";
export type MediaKind = "ITEM" | "EVIDENCE";

type SqlValue = string | number | Date | null;

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

interface PostRow extends RowDataPacket {
  id: string;
  user_id: string;
  owner_name: string;
  type: PostType;
  status: PostStatus;
  visibility_mode: VisibilityMode;
  title: string;
  description: string;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  area_id: string | null;
  area_name: string | null;
  building_id: string | null;
  building_name: string | null;
  room_text: string | null;
  custom_location: string | null;
  contact_info: string | null;
  lost_found_at: Date | string | null;
  handover_point_id: string | null;
  handover_point_name: string | null;
  handover_point_address: string | null;
  expires_at: Date | string | null;
  resolved_at: Date | string | null;
  view_count: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

interface MediaRow extends RowDataPacket {
  id: string;
  post_id: string;
  media_kind: MediaKind;
  resource_type: string;
  format: string | null;
  bytes: number | null;
  sort_order: number;
  created_at: Date | string;
}

interface StoredMediaRow extends MediaRow {
  secure_url: string;
  public_id: string;
  owner_id: string;
  post_status: PostStatus;
  post_visibility_mode: VisibilityMode;
  post_deleted_at: Date | string | null;
}

interface CountRow extends RowDataPacket {
  total: number | string;
}

interface IdRow extends RowDataPacket {
  id: string;
}

interface BuildingRefRow extends RowDataPacket {
  id: string;
  area_id: string;
}

interface CatalogRow extends RowDataPacket {
  id: string;
  name: string;
  parent_id?: string | null;
  area_id?: string;
  address?: string;
  opening_hours?: string | null;
}

const postSelect = `SELECT
  p.id, p.user_id, u.full_name AS owner_name, p.type, p.status, p.visibility_mode,
  p.title, p.description, p.category_id, c.name AS category_name, c.icon AS category_icon,
  p.area_id, a.name AS area_name, p.building_id, b.name AS building_name,
  p.room_text, p.custom_location, p.contact_info, p.lost_found_at,
  p.handover_point_id, hp.name AS handover_point_name, hp.address AS handover_point_address,
  p.expires_at, p.resolved_at, p.view_count, p.created_at, p.updated_at, p.deleted_at
FROM posts p
INNER JOIN users u ON u.id = p.user_id
LEFT JOIN item_categories c ON c.id = p.category_id
LEFT JOIN campus_areas a ON a.id = p.area_id
LEFT JOIN campus_buildings b ON b.id = p.building_id
LEFT JOIN handover_points hp ON hp.id = p.handover_point_id`;

const sortSql: Record<ListPostsQuery["sort"], string> = {
  newest: "p.created_at DESC, p.id DESC",
  oldest: "p.created_at ASC, p.id ASC",
  incident_newest: "p.lost_found_at DESC, p.created_at DESC",
  incident_oldest: "p.lost_found_at ASC, p.created_at ASC"
};

function toIso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export const normalizePostText = normalizeVietnameseText;

function mapMedia(row: MediaRow): PostMediaRecord {
  return {
    id: row.id,
    postId: row.post_id,
    mediaKind: row.media_kind,
    resourceType: row.resource_type,
    format: row.format,
    bytes: row.bytes === null ? null : Number(row.bytes),
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at)!
  };
}

function mapPost(row: PostRow, media: PostMediaRecord[] = []): PostRecord {
  return {
    id: row.id,
    userId: row.user_id,
    ownerName: row.owner_name,
    type: row.type,
    status: row.status,
    visibilityMode: row.visibility_mode,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    areaId: row.area_id,
    areaName: row.area_name,
    buildingId: row.building_id,
    buildingName: row.building_name,
    roomText: row.room_text,
    customLocation: row.custom_location,
    contactInfo: row.contact_info,
    lostFoundAt: toIso(row.lost_found_at),
    handoverPointId: row.handover_point_id,
    handoverPointName: row.handover_point_name,
    handoverPointAddress: row.handover_point_address,
    expiresAt: toIso(row.expires_at),
    resolvedAt: toIso(row.resolved_at),
    viewCount: row.view_count,
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
    deletedAt: toIso(row.deleted_at),
    media
  };
}

function buildListWhere(filters: ListPostsQuery | ListOwnPostsQuery, ownerId?: string) {
  const where = ["p.deleted_at IS NULL"];
  const values: SqlValue[] = [];

  if (ownerId) {
    where.push("p.user_id = ?");
    values.push(ownerId);
    if (filters.status) {
      where.push("p.status = ?");
      values.push(filters.status);
    } else {
      where.push("p.status <> 'HIDDEN'");
    }
  } else {
    if (filters.status) {
      where.push("p.status = ?");
      values.push(filters.status);
    } else {
      where.push("p.status IN ('OPEN', 'MATCHED')");
    }
  }

  if (filters.type) {
    where.push("p.type = ?");
    values.push(filters.type);
  }
  if (filters.categoryId) {
    where.push("p.category_id = ?");
    values.push(filters.categoryId);
  }
  if (filters.areaId) {
    where.push("p.area_id = ?");
    values.push(filters.areaId);
  }
  if (filters.buildingId) {
    where.push("p.building_id = ?");
    values.push(filters.buildingId);
  }
  if (filters.q) {
    where.push("(p.title_normalized LIKE ? OR p.description_normalized LIKE ?)");
    const q = `%${normalizePostText(filters.q)}%`;
    values.push(q, q);
  }

  return { sql: where.join(" AND "), values };
}

async function loadMedia(postIds: string[]) {
  if (!postIds.length) return new Map<string, PostMediaRecord[]>();
  const placeholders = postIds.map(() => "?").join(", ");
  const [rows] = await pool.execute<MediaRow[]>(
    `SELECT id, post_id, media_kind, resource_type, format, bytes, sort_order, created_at
     FROM post_media
     WHERE post_id IN (${placeholders})
     ORDER BY post_id, sort_order, created_at`,
    postIds
  );

  const byPost = new Map<string, PostMediaRecord[]>();
  for (const row of rows) {
    const media = mapMedia(row);
    byPost.set(media.postId, [...(byPost.get(media.postId) ?? []), media]);
  }
  return byPost;
}

async function listPosts(filters: ListPostsQuery | ListOwnPostsQuery, ownerId?: string) {
  const { sql, values } = buildListWhere(filters, ownerId);
  const limit = filters.pageSize;
  const offset = (filters.page - 1) * filters.pageSize;
  const [countRows] = await pool.execute<CountRow[]>(`SELECT COUNT(*) AS total FROM posts p WHERE ${sql}`, values);
  const [rows] = await pool.execute<PostRow[]>(
    `${postSelect} WHERE ${sql} ORDER BY ${sortSql[filters.sort]} LIMIT ${limit} OFFSET ${offset}`,
    values
  );

  const mediaByPost = await loadMedia(rows.map((row) => row.id));
  return {
    total: Number(countRows[0]?.total ?? 0),
    page: filters.page,
    pageSize: filters.pageSize,
    items: rows.map((row) => mapPost(row, mediaByPost.get(row.id) ?? []))
  };
}

async function findPost(where: string, values: SqlValue[]) {
  const [rows] = await pool.execute<PostRow[]>(`${postSelect} WHERE ${where} LIMIT 1`, values);
  const row = rows[0];
  if (!row) return null;
  const mediaByPost = await loadMedia([row.id]);
  return mapPost(row, mediaByPost.get(row.id) ?? []);
}

export const postRepository = {
  async getFormCatalog() {
    const [categories, areas, buildings, handoverPoints] = await Promise.all([
      pool.execute<CatalogRow[]>(`SELECT c.id, c.name, c.parent_id
        FROM item_categories c
        LEFT JOIN item_categories parent ON parent.id = c.parent_id
        WHERE c.is_active = TRUE AND (c.parent_id IS NULL OR parent.is_active = TRUE)
        ORDER BY c.parent_id IS NOT NULL, c.sort_order, c.name`),
      pool.execute<CatalogRow[]>("SELECT id, name FROM campus_areas WHERE is_active = TRUE ORDER BY sort_order, name"),
      pool.execute<CatalogRow[]>("SELECT id, area_id, name FROM campus_buildings WHERE is_active = TRUE ORDER BY sort_order, name"),
      pool.execute<CatalogRow[]>("SELECT id, name, address, opening_hours FROM handover_points WHERE is_active = TRUE ORDER BY name")
    ]);
    return {
      categories: categories[0].map((row) => ({ id: row.id, name: row.name, parentId: row.parent_id ?? null })),
      areas: areas[0].map((row) => ({ id: row.id, name: row.name })),
      buildings: buildings[0].map((row) => ({ id: row.id, areaId: row.area_id!, name: row.name })),
      handoverPoints: handoverPoints[0].map((row) => ({ id: row.id, name: row.name, address: row.address!, openingHours: row.opening_hours ?? null }))
    };
  },

  listBoard(filters: ListPostsQuery) {
    return listPosts(filters);
  },

  listByOwner(ownerId: string, filters: ListOwnPostsQuery) {
    return listPosts(filters, ownerId);
  },

  findVisibleById(postId: string) {
    return findPost("p.id = ? AND p.deleted_at IS NULL AND p.status <> 'HIDDEN'", [postId]);
  },

  async findVisibleByIds(postIds: string[]) {
    const uniqueIds = [...new Set(postIds)].filter(Boolean);
    if (!uniqueIds.length) return [];
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const [rows] = await pool.execute<PostRow[]>(
      `${postSelect}
       WHERE p.id IN (${placeholders})
         AND p.deleted_at IS NULL
         AND p.status <> 'HIDDEN'`,
      uniqueIds
    );
    const mediaByPost = await loadMedia(rows.map((row) => row.id));
    const order = new Map(uniqueIds.map((postId, index) => [postId, index]));
    return rows
      .map((row) => mapPost(row, mediaByPost.get(row.id) ?? []))
      .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  },

  findOwnedById(postId: string, ownerId: string) {
    return findPost("p.id = ? AND p.user_id = ? AND p.deleted_at IS NULL AND p.status <> 'HIDDEN'", [postId, ownerId]);
  },

  async createPost(input: {
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
  }) {
    await pool.execute(
      `INSERT INTO posts (
        id, user_id, type, visibility_mode, status, title, title_normalized,
        description, description_normalized, category_id, area_id, building_id,
        room_text, custom_location, contact_info, lost_found_at, handover_point_id, expires_at
      ) VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id, input.userId, input.type, input.visibilityMode, input.title, input.titleNormalized,
        input.description, input.descriptionNormalized, input.categoryId, input.areaId ?? null,
        input.buildingId ?? null, input.roomText ?? null, input.customLocation ?? null,
        input.contactInfo, input.lostFoundAt, input.handoverPointId ?? null, input.expiresAt
      ]
    );
    return this.findOwnedById(input.id, input.userId);
  },

  async updatePost(postId: string, input: {
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
  }) {
    const fields: string[] = [];
    const values: SqlValue[] = [];
    if (input.title !== undefined) { fields.push("title = ?"); values.push(input.title); }
    if (input.titleNormalized !== undefined) { fields.push("title_normalized = ?"); values.push(input.titleNormalized); }
    if (input.description !== undefined) { fields.push("description = ?"); values.push(input.description); }
    if (input.descriptionNormalized !== undefined) { fields.push("description_normalized = ?"); values.push(input.descriptionNormalized); }
    if (input.categoryId !== undefined) { fields.push("category_id = ?"); values.push(input.categoryId); }
    if (input.areaId !== undefined) { fields.push("area_id = ?"); values.push(input.areaId); }
    if (input.buildingId !== undefined) { fields.push("building_id = ?"); values.push(input.buildingId); }
    if (input.roomText !== undefined) { fields.push("room_text = ?"); values.push(input.roomText); }
    if (input.customLocation !== undefined) { fields.push("custom_location = ?"); values.push(input.customLocation); }
    if (input.contactInfo !== undefined) { fields.push("contact_info = ?"); values.push(input.contactInfo); }
    if (input.lostFoundAt !== undefined) { fields.push("lost_found_at = ?"); values.push(input.lostFoundAt); }
    if (input.handoverPointId !== undefined) { fields.push("handover_point_id = ?"); values.push(input.handoverPointId); }
    if (input.visibilityMode !== undefined) { fields.push("visibility_mode = ?"); values.push(input.visibilityMode); }
    if (input.status !== undefined) { fields.push("status = ?"); values.push(input.status); }
    if (input.resolvedAt !== undefined) { fields.push("resolved_at = ?"); values.push(input.resolvedAt); }
    if (!fields.length) return;
    await pool.execute(`UPDATE posts SET ${fields.join(", ")} WHERE id = ?`, [...values, postId]);
  },

  async softDeletePost(postId: string, ownerId: string) {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE posts SET status = 'HIDDEN', deleted_at = UTC_TIMESTAMP() WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
      [postId, ownerId]
    );
    return result.affectedRows > 0;
  },

  async countMedia(postId: string) {
    const [rows] = await pool.execute<CountRow[]>("SELECT COUNT(*) AS total FROM post_media WHERE post_id = ?", [postId]);
    return Number(rows[0]?.total ?? 0);
  },

  async createMedia(input: {
    id: string;
    postId: string;
    secureUrl: string;
    publicId: string;
    mediaKind: MediaKind;
    format: string;
    bytes: number;
    sortOrder: number;
  }) {
    await pool.execute(
      `INSERT INTO post_media (id, post_id, secure_url, public_id, resource_type, media_kind, format, bytes, sort_order)
       VALUES (?, ?, ?, ?, 'image', ?, ?, ?, ?)`,
      [input.id, input.postId, input.secureUrl, input.publicId, input.mediaKind, input.format, input.bytes, input.sortOrder]
    );
  },

  async findMedia(postId: string, mediaId: string): Promise<StoredMediaRecord | null> {
    const [rows] = await pool.execute<StoredMediaRow[]>(
      `SELECT pm.id, pm.post_id, pm.secure_url, pm.public_id, pm.media_kind, pm.resource_type, pm.format, pm.bytes,
              pm.sort_order, pm.created_at, p.user_id AS owner_id, p.status AS post_status,
              p.visibility_mode AS post_visibility_mode, p.deleted_at AS post_deleted_at
       FROM post_media pm
       INNER JOIN posts p ON p.id = pm.post_id
       WHERE pm.id = ? AND pm.post_id = ?
       LIMIT 1`,
      [mediaId, postId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      ...mapMedia(row),
      secureUrl: row.secure_url,
      publicId: row.public_id,
      ownerId: row.owner_id,
      postStatus: row.post_status,
      postVisibilityMode: row.post_visibility_mode,
      postDeletedAt: toIso(row.post_deleted_at)
    };
  },

  async deleteMedia(postId: string, mediaId: string) {
    const [result] = await pool.execute<ResultSetHeader>("DELETE FROM post_media WHERE id = ? AND post_id = ?", [mediaId, postId]);
    return result.affectedRows > 0;
  },

  async findActiveCategory(categoryId: string) {
    const [rows] = await pool.execute<IdRow[]>(`SELECT child.id
      FROM item_categories child
      INNER JOIN item_categories parent ON parent.id = child.parent_id AND parent.is_active = TRUE
      WHERE child.id = ? AND child.is_active = TRUE
      LIMIT 1`, [categoryId]);
    return rows[0]?.id ?? null;
  },

  async findActiveArea(areaId: string) {
    const [rows] = await pool.execute<IdRow[]>("SELECT id FROM campus_areas WHERE id = ? AND is_active = TRUE LIMIT 1", [areaId]);
    return rows[0]?.id ?? null;
  },

  async findActiveBuilding(buildingId: string) {
    const [rows] = await pool.execute<BuildingRefRow[]>("SELECT id, area_id FROM campus_buildings WHERE id = ? AND is_active = TRUE LIMIT 1", [buildingId]);
    return rows[0] ? { id: rows[0].id, areaId: rows[0].area_id } : null;
  },

  async findActiveHandoverPoint(handoverPointId: string) {
    const [rows] = await pool.execute<IdRow[]>("SELECT id FROM handover_points WHERE id = ? AND is_active = TRUE LIMIT 1", [handoverPointId]);
    return rows[0]?.id ?? null;
  }
};
