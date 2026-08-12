import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";

export interface AdminCategory {
  id: string;
  name: string;
  icon: string | null;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
  sortOrder: number;
  childCount: number;
  createdAt: string;
}

export interface AdminArea {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  buildingCount: number;
  createdAt: string;
}

export interface AdminBuilding {
  id: string;
  areaId: string;
  areaName: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface AdminCatalogStats {
  totalPosts: number;
  processingPosts: number;
  totalUsers: number;
  returnedPosts: number;
}

interface CategoryRow extends RowDataPacket {
  id: string;
  name: string;
  icon: string | null;
  parent_id: string | null;
  parent_name: string | null;
  is_active: number | boolean;
  sort_order: number;
  child_count: number | string;
  created_at: Date;
}

interface AreaRow extends RowDataPacket {
  id: string;
  name: string;
  description: string | null;
  is_active: number | boolean;
  sort_order: number;
  building_count: number | string;
  created_at: Date;
}

interface BuildingRow extends RowDataPacket {
  id: string;
  area_id: string;
  area_name: string;
  name: string;
  is_active: number | boolean;
  sort_order: number;
  created_at: Date;
}

interface StatsRow extends RowDataPacket {
  total_posts: number | string;
  processing_posts: number | string;
  total_users: number | string;
  returned_posts: number | string;
}

interface CountRow extends RowDataPacket {
  total: number | string;
}

interface IdRow extends RowDataPacket {
  id: string;
}

const categorySelect = `SELECT c.id, c.name, c.icon, c.parent_id, p.name AS parent_name, c.is_active, c.sort_order, c.created_at,
  COUNT(child.id) AS child_count
  FROM item_categories c
  LEFT JOIN item_categories p ON p.id = c.parent_id
  LEFT JOIN item_categories child ON child.parent_id = c.id`;
const categoryGroup = "GROUP BY c.id, c.name, c.icon, c.parent_id, p.name, c.is_active, c.sort_order, c.created_at";

const areaSelect = `SELECT a.id, a.name, a.description, a.is_active, a.sort_order, a.created_at,
  COUNT(b.id) AS building_count
  FROM campus_areas a
  LEFT JOIN campus_buildings b ON b.area_id = a.id`;
const areaGroup = "GROUP BY a.id, a.name, a.description, a.is_active, a.sort_order, a.created_at";

const buildingSelect = `SELECT b.id, b.area_id, a.name AS area_name, b.name, b.is_active, b.sort_order, b.created_at
  FROM campus_buildings b
  INNER JOIN campus_areas a ON a.id = b.area_id`;

function mapCategory(row: CategoryRow): AdminCategory {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    parentId: row.parent_id,
    parentName: row.parent_name,
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
    childCount: Number(row.child_count),
    createdAt: row.created_at.toISOString()
  };
}

function mapArea(row: AreaRow): AdminArea {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
    buildingCount: Number(row.building_count),
    createdAt: row.created_at.toISOString()
  };
}

function mapBuilding(row: BuildingRow): AdminBuilding {
  return {
    id: row.id,
    areaId: row.area_id,
    areaName: row.area_name,
    name: row.name,
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString()
  };
}

export const adminCatalogRepository = {
  async getStats(): Promise<AdminCatalogStats> {
    const [rows] = await pool.execute<StatsRow[]>(`SELECT
      (SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL) AS total_posts,
      (SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL AND status IN ('OPEN', 'MATCHED')) AS processing_posts,
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL AND status = 'RESOLVED') AS returned_posts`);
    const row = rows[0];
    return {
      totalPosts: Number(row?.total_posts ?? 0),
      processingPosts: Number(row?.processing_posts ?? 0),
      totalUsers: Number(row?.total_users ?? 0),
      returnedPosts: Number(row?.returned_posts ?? 0)
    };
  },

  async listCategories() {
    const [rows] = await pool.execute<CategoryRow[]>(`${categorySelect} ${categoryGroup} ORDER BY c.parent_id IS NOT NULL, c.sort_order, c.name`);
    return rows.map(mapCategory);
  },

  async findCategoryById(id: string) {
    const [rows] = await pool.execute<CategoryRow[]>(`${categorySelect} WHERE c.id = ? ${categoryGroup}`, [id]);
    return rows[0] ? mapCategory(rows[0]) : null;
  },

  async findCategoryByNormalized(nameNormalized: string, exceptId?: string) {
    const [rows] = await pool.execute<IdRow[]>(
      `SELECT id FROM item_categories WHERE name_normalized = ? ${exceptId ? "AND id <> ?" : ""} LIMIT 1`,
      exceptId ? [nameNormalized, exceptId] : [nameNormalized]
    );
    return rows[0]?.id ?? null;
  },

  async createCategory(input: { id: string; name: string; nameNormalized: string; icon?: string | null; parentId?: string | null; isActive?: boolean; sortOrder?: number }) {
    await pool.execute(
      "INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [input.id, input.name, input.nameNormalized, input.icon ?? null, input.parentId ?? null, input.isActive ?? true, input.sortOrder ?? 0]
    );
    return this.findCategoryById(input.id);
  },

  async updateCategory(id: string, input: { name?: string; nameNormalized?: string; icon?: string | null; parentId?: string | null; isActive?: boolean; sortOrder?: number }) {
    const fields: string[] = [];
    const values: Array<string | number | boolean | null> = [];
    if (input.name !== undefined) { fields.push("name = ?"); values.push(input.name); }
    if (input.nameNormalized !== undefined) { fields.push("name_normalized = ?"); values.push(input.nameNormalized); }
    if (input.icon !== undefined) { fields.push("icon = ?"); values.push(input.icon); }
    if (input.parentId !== undefined) { fields.push("parent_id = ?"); values.push(input.parentId); }
    if (input.isActive !== undefined) { fields.push("is_active = ?"); values.push(input.isActive); }
    if (input.sortOrder !== undefined) { fields.push("sort_order = ?"); values.push(input.sortOrder); }
    if (fields.length) await pool.execute(`UPDATE item_categories SET ${fields.join(", ")} WHERE id = ?`, [...values, id]);
    return this.findCategoryById(id);
  },

  async deleteCategory(id: string) {
    await pool.execute("DELETE FROM item_categories WHERE id = ?", [id]);
  },

  async countCategoryReferences(id: string) {
    const [rows] = await pool.execute<CountRow[]>(`SELECT (
      (SELECT COUNT(*) FROM posts WHERE category_id = ?) +
      (SELECT COUNT(*) FROM warehouse_items WHERE category_id = ?) +
      (SELECT COUNT(*) FROM campus_radar_alerts WHERE category_id = ?)
    ) AS total`, [id, id, id]);
    return Number(rows[0]?.total ?? 0);
  },

  async listAreas() {
    const [rows] = await pool.execute<AreaRow[]>(`${areaSelect} ${areaGroup} ORDER BY a.sort_order, a.name`);
    return rows.map(mapArea);
  },

  async findAreaById(id: string) {
    const [rows] = await pool.execute<AreaRow[]>(`${areaSelect} WHERE a.id = ? ${areaGroup}`, [id]);
    return rows[0] ? mapArea(rows[0]) : null;
  },

  async createArea(input: { id: string; name: string; description?: string | null; isActive?: boolean; sortOrder?: number }) {
    await pool.execute(
      "INSERT INTO campus_areas (id, name, description, is_active, sort_order) VALUES (?, ?, ?, ?, ?)",
      [input.id, input.name, input.description ?? null, input.isActive ?? true, input.sortOrder ?? 0]
    );
    return this.findAreaById(input.id);
  },

  async updateArea(id: string, input: { name?: string; description?: string | null; isActive?: boolean; sortOrder?: number }) {
    const fields: string[] = [];
    const values: Array<string | number | boolean | null> = [];
    if (input.name !== undefined) { fields.push("name = ?"); values.push(input.name); }
    if (input.description !== undefined) { fields.push("description = ?"); values.push(input.description); }
    if (input.isActive !== undefined) { fields.push("is_active = ?"); values.push(input.isActive); }
    if (input.sortOrder !== undefined) { fields.push("sort_order = ?"); values.push(input.sortOrder); }
    if (fields.length) await pool.execute(`UPDATE campus_areas SET ${fields.join(", ")} WHERE id = ?`, [...values, id]);
    return this.findAreaById(id);
  },

  async deleteArea(id: string) {
    await pool.execute("DELETE FROM campus_areas WHERE id = ?", [id]);
  },

  async countAreaReferences(id: string) {
    const [rows] = await pool.execute<CountRow[]>(`SELECT (
      (SELECT COUNT(*) FROM posts WHERE area_id = ?) +
      (SELECT COUNT(*) FROM warehouse_items WHERE area_id = ?) +
      (SELECT COUNT(*) FROM handover_points WHERE area_id = ?) +
      (SELECT COUNT(*) FROM campus_radar_events WHERE area_id = ?)
    ) AS total`, [id, id, id, id]);
    return Number(rows[0]?.total ?? 0);
  },

  async listBuildings() {
    const [rows] = await pool.execute<BuildingRow[]>(`${buildingSelect} ORDER BY a.sort_order, a.name, b.sort_order, b.name`);
    return rows.map(mapBuilding);
  },

  async findBuildingById(id: string) {
    const [rows] = await pool.execute<BuildingRow[]>(`${buildingSelect} WHERE b.id = ?`, [id]);
    return rows[0] ? mapBuilding(rows[0]) : null;
  },

  async createBuilding(input: { id: string; areaId: string; name: string; isActive?: boolean; sortOrder?: number }) {
    await pool.execute(
      "INSERT INTO campus_buildings (id, area_id, name, is_active, sort_order) VALUES (?, ?, ?, ?, ?)",
      [input.id, input.areaId, input.name, input.isActive ?? true, input.sortOrder ?? 0]
    );
    return this.findBuildingById(input.id);
  },

  async updateBuilding(id: string, input: { areaId?: string; name?: string; isActive?: boolean; sortOrder?: number }) {
    const fields: string[] = [];
    const values: Array<string | number | boolean> = [];
    if (input.areaId !== undefined) { fields.push("area_id = ?"); values.push(input.areaId); }
    if (input.name !== undefined) { fields.push("name = ?"); values.push(input.name); }
    if (input.isActive !== undefined) { fields.push("is_active = ?"); values.push(input.isActive); }
    if (input.sortOrder !== undefined) { fields.push("sort_order = ?"); values.push(input.sortOrder); }
    if (fields.length) await pool.execute(`UPDATE campus_buildings SET ${fields.join(", ")} WHERE id = ?`, [...values, id]);
    return this.findBuildingById(id);
  },

  async deleteBuilding(id: string) {
    await pool.execute("DELETE FROM campus_buildings WHERE id = ?", [id]);
  },

  async countBuildingReferences(id: string) {
    const [rows] = await pool.execute<CountRow[]>(`SELECT (
      (SELECT COUNT(*) FROM posts WHERE building_id = ?) +
      (SELECT COUNT(*) FROM warehouse_items WHERE building_id = ?) +
      (SELECT COUNT(*) FROM handover_points WHERE building_id = ?) +
      (SELECT COUNT(*) FROM campus_radar_events WHERE building_id = ?)
    ) AS total`, [id, id, id, id]);
    return Number(rows[0]?.total ?? 0);
  }
};
