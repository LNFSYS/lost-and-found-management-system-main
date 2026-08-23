import type { RowDataPacket } from "mysql2";
import type { Pool, PoolConnection } from "mysql2/promise";
import { pool } from "../config/db.js";
import type { WarehouseStatus } from "../validators/warehouse.validator.js";

type DbExecutor = Pool | PoolConnection;
export type StorageLogAction = WarehouseStatus | "OVERDUE_MARKED" | "CONDITION_UPDATED";

export interface WarehouseItem {
  id: string;
  postId: string | null;
  handoverPoint: { id: string; name: string | null; address: string | null } | null;
  itemName: string;
  description: string | null;
  category: { id: string; name: string | null } | null;
  location: {
    area: { id: string; name: string | null } | null;
    building: { id: string; name: string | null } | null;
    roomText: string | null;
  };
  finder: {
    userId: string | null;
    userName: string | null;
    name: string | null;
    contact: string | null;
  };
  status: WarehouseStatus;
  conditionNotes: string | null;
  storageCode: string | null;
  receivedAt: string;
  returnedAt: string | null;
  retentionDeadline: string | null;
  createdBy: { id: string; fullName: string | null };
  createdAt: string;
  updatedAt: string;
  logCount: number;
}

export interface WarehouseStorageLog {
  id: string;
  warehouseItemId: string | null;
  postId: string | null;
  handoverPoint: { id: string; name: string | null } | null;
  actor: { id: string; fullName: string | null };
  action: StorageLogAction;
  fromStatus: string | null;
  toStatus: string | null;
  conditionNotes: string | null;
  storageCode: string | null;
  note: string | null;
  createdAt: string;
}

export interface WarehouseDashboardStats {
  totalItems: number;
  activeItems: number;
  receivedItems: number;
  storedItems: number;
  returnedItems: number;
  overdueItems: number;
}

export interface HandoverItemCount {
  handoverPointId: string;
  name: string;
  address: string;
  itemCount: number;
  storedCount: number;
  overdueCount: number;
}

export interface WarehouseCatalog {
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  areas: Array<{ id: string; name: string }>;
  buildings: Array<{ id: string; areaId: string; name: string }>;
  handoverPoints: Array<{ id: string; name: string; address: string; openingHours: string | null }>;
}

export interface WarehouseItemLock {
  id: string;
  postId: string | null;
  handoverPointId: string;
  status: WarehouseStatus;
  conditionNotes: string | null;
  storageCode: string | null;
}

interface WarehouseItemRow extends RowDataPacket {
  id: string;
  post_id: string | null;
  handover_point_id: string | null;
  handover_point_name: string | null;
  handover_point_address: string | null;
  item_name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  area_id: string | null;
  area_name: string | null;
  building_id: string | null;
  building_name: string | null;
  room_text: string | null;
  finder_user_id: string | null;
  finder_user_name: string | null;
  finder_name: string | null;
  finder_contact: string | null;
  status: WarehouseStatus;
  condition_notes: string | null;
  storage_code: string | null;
  received_at: Date | string;
  returned_at: Date | string | null;
  retention_deadline: Date | string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  log_count: number | string;
}

interface WarehouseItemLockRow extends RowDataPacket {
  id: string;
  post_id: string | null;
  handover_point_id: string;
  status: WarehouseStatus;
  condition_notes: string | null;
  storage_code: string | null;
}

interface StorageLogRow extends RowDataPacket {
  id: string;
  warehouse_item_id: string | null;
  post_id: string | null;
  handover_point_id: string | null;
  handover_point_name: string | null;
  actor_id: string;
  actor_name: string | null;
  action: StorageLogAction;
  from_status: string | null;
  to_status: string | null;
  condition_notes: string | null;
  storage_code: string | null;
  note: string | null;
  created_at: Date | string;
}

interface StatsRow extends RowDataPacket {
  total_items: number | string | null;
  active_items: number | string | null;
  received_items: number | string | null;
  stored_items: number | string | null;
  returned_items: number | string | null;
  overdue_items: number | string | null;
}

interface HandoverCountRow extends RowDataPacket {
  handover_point_id: string;
  name: string;
  address: string;
  item_count: number | string | null;
  stored_count: number | string | null;
  overdue_count: number | string | null;
}

interface CountRow extends RowDataPacket {
  total: number | string;
}

interface IdRow extends RowDataPacket {
  id: string;
}

interface CategoryNameRow extends RowDataPacket {
  id: string;
  name: string;
  parent_name: string | null;
}

interface BuildingRow extends RowDataPacket {
  id: string;
  area_id: string;
}

interface ConfigRow extends RowDataPacket {
  config_value: string;
}

const activeWarehouseStatusSql = "'PENDING_APPROVAL','RECEIVED','STORED','CLAIMED','EXPIRED'";
const itemSelect = `SELECT wi.id, wi.post_id, wi.handover_point_id, hp.name AS handover_point_name, hp.address AS handover_point_address,
  wi.item_name, wi.description, wi.category_id, c.name AS category_name,
  wi.area_id, a.name AS area_name, wi.building_id, b.name AS building_name, wi.room_text,
  wi.finder_user_id, fu.full_name AS finder_user_name, wi.finder_name, wi.finder_contact,
  wi.status, wi.condition_notes, wi.storage_code, wi.received_at, wi.returned_at, wi.retention_deadline,
  wi.created_by, cu.full_name AS created_by_name, wi.created_at, wi.updated_at,
  (SELECT COUNT(*) FROM storage_logs sl WHERE sl.warehouse_item_id = wi.id OR (wi.post_id IS NOT NULL AND sl.post_id = wi.post_id)) AS log_count
  FROM warehouse_items wi
  LEFT JOIN handover_points hp ON hp.id = wi.handover_point_id
  LEFT JOIN item_categories c ON c.id = wi.category_id
  LEFT JOIN campus_areas a ON a.id = wi.area_id
  LEFT JOIN campus_buildings b ON b.id = wi.building_id
  LEFT JOIN users fu ON fu.id = wi.finder_user_id
  INNER JOIN users cu ON cu.id = wi.created_by`;

function iso(value: Date | string | null) {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function mapItem(row: WarehouseItemRow): WarehouseItem {
  return {
    id: row.id,
    postId: row.post_id,
    handoverPoint: row.handover_point_id ? { id: row.handover_point_id, name: row.handover_point_name, address: row.handover_point_address } : null,
    itemName: row.item_name,
    description: row.description,
    category: row.category_id ? { id: row.category_id, name: row.category_name } : null,
    location: {
      area: row.area_id ? { id: row.area_id, name: row.area_name } : null,
      building: row.building_id ? { id: row.building_id, name: row.building_name } : null,
      roomText: row.room_text
    },
    finder: {
      userId: row.finder_user_id,
      userName: row.finder_user_name,
      name: row.finder_name,
      contact: row.finder_contact
    },
    status: row.status,
    conditionNotes: row.condition_notes,
    storageCode: row.storage_code,
    receivedAt: iso(row.received_at) ?? "",
    returnedAt: iso(row.returned_at),
    retentionDeadline: iso(row.retention_deadline),
    createdBy: { id: row.created_by, fullName: row.created_by_name },
    createdAt: iso(row.created_at) ?? "",
    updatedAt: iso(row.updated_at) ?? "",
    logCount: Number(row.log_count ?? 0)
  };
}

function mapLog(row: StorageLogRow): WarehouseStorageLog {
  return {
    id: row.id,
    warehouseItemId: row.warehouse_item_id,
    postId: row.post_id,
    handoverPoint: row.handover_point_id ? { id: row.handover_point_id, name: row.handover_point_name } : null,
    actor: { id: row.actor_id, fullName: row.actor_name },
    action: row.action,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    conditionNotes: row.condition_notes,
    storageCode: row.storage_code,
    note: row.note,
    createdAt: iso(row.created_at) ?? ""
  };
}

function listWhere(input: { q?: string; status?: WarehouseStatus; handoverPointId?: string }) {
  const where = ["wi.deleted_at IS NULL"];
  const values: Array<string> = [];
  if (input.status) {
    where.push("wi.status = ?");
    values.push(input.status);
  }
  if (input.handoverPointId) {
    where.push("wi.handover_point_id = ?");
    values.push(input.handoverPointId);
  }
  if (input.q) {
    where.push("(wi.item_name LIKE ? OR wi.description LIKE ? OR wi.storage_code LIKE ? OR wi.finder_name LIKE ?)");
    const term = `%${input.q}%`;
    values.push(term, term, term, term);
  }
  return { where: where.join(" AND "), values };
}

export const warehouseRepository = {
  async getCatalog(): Promise<WarehouseCatalog> {
    const [categoryRows] = await pool.execute<Array<RowDataPacket & { id: string; name: string; parent_id: string | null }>>(
      "SELECT id, name, parent_id FROM item_categories WHERE is_active = TRUE ORDER BY parent_id IS NOT NULL, sort_order, name"
    );
    const [areaRows] = await pool.execute<Array<RowDataPacket & { id: string; name: string }>>(
      "SELECT id, name FROM campus_areas WHERE is_active = TRUE ORDER BY sort_order, name"
    );
    const [buildingRows] = await pool.execute<Array<RowDataPacket & { id: string; area_id: string; name: string }>>(
      "SELECT id, area_id, name FROM campus_buildings WHERE is_active = TRUE ORDER BY sort_order, name"
    );
    const [handoverRows] = await pool.execute<Array<RowDataPacket & { id: string; name: string; address: string; opening_hours: string | null }>>(
      "SELECT id, name, address, opening_hours FROM handover_points WHERE is_active = TRUE ORDER BY name"
    );
    return {
      categories: categoryRows.map((row) => ({ id: row.id, name: row.name, parentId: row.parent_id })),
      areas: areaRows.map((row) => ({ id: row.id, name: row.name })),
      buildings: buildingRows.map((row) => ({ id: row.id, areaId: row.area_id, name: row.name })),
      handoverPoints: handoverRows.map((row) => ({ id: row.id, name: row.name, address: row.address, openingHours: row.opening_hours }))
    };
  },

  async getStats(): Promise<WarehouseDashboardStats> {
    const [rows] = await pool.execute<StatsRow[]>(`SELECT
      COUNT(*) AS total_items,
      SUM(status IN (${activeWarehouseStatusSql})) AS active_items,
      SUM(status = 'RECEIVED') AS received_items,
      SUM(status = 'STORED') AS stored_items,
      SUM(status = 'RETURNED') AS returned_items,
      SUM(status IN (${activeWarehouseStatusSql}) AND retention_deadline IS NOT NULL AND retention_deadline < UTC_TIMESTAMP()) AS overdue_items
      FROM warehouse_items
      WHERE deleted_at IS NULL`);
    const row = rows[0];
    return {
      totalItems: Number(row?.total_items ?? 0),
      activeItems: Number(row?.active_items ?? 0),
      receivedItems: Number(row?.received_items ?? 0),
      storedItems: Number(row?.stored_items ?? 0),
      returnedItems: Number(row?.returned_items ?? 0),
      overdueItems: Number(row?.overdue_items ?? 0)
    };
  },

  async listHandoverCounts(): Promise<HandoverItemCount[]> {
    const [rows] = await pool.execute<HandoverCountRow[]>(`SELECT hp.id AS handover_point_id, hp.name, hp.address,
      COUNT(wi.id) AS item_count,
      SUM(wi.status = 'STORED') AS stored_count,
      SUM(wi.retention_deadline IS NOT NULL AND wi.retention_deadline < UTC_TIMESTAMP()) AS overdue_count
      FROM handover_points hp
      LEFT JOIN warehouse_items wi ON wi.handover_point_id = hp.id
        AND wi.deleted_at IS NULL
        AND wi.status IN (${activeWarehouseStatusSql})
      WHERE hp.is_active = TRUE
      GROUP BY hp.id, hp.name, hp.address
      ORDER BY hp.name`);
    return rows.map((row) => ({
      handoverPointId: row.handover_point_id,
      name: row.name,
      address: row.address,
      itemCount: Number(row.item_count ?? 0),
      storedCount: Number(row.stored_count ?? 0),
      overdueCount: Number(row.overdue_count ?? 0)
    }));
  },

  async listItems(input: { q?: string; status?: WarehouseStatus; handoverPointId?: string; page: number; pageSize: number }) {
    const { where, values } = listWhere(input);
    const offset = (input.page - 1) * input.pageSize;
    const [rows] = await pool.execute<WarehouseItemRow[]>(
      `${itemSelect} WHERE ${where}
      ORDER BY wi.status IN (${activeWarehouseStatusSql}) DESC,
        wi.retention_deadline IS NULL,
        wi.retention_deadline ASC,
        wi.received_at DESC
      LIMIT ? OFFSET ?`,
      [...values, input.pageSize, offset]
    );
    const [countRows] = await pool.execute<CountRow[]>(`SELECT COUNT(*) AS total FROM warehouse_items wi WHERE ${where}`, values);
    return { total: Number(countRows[0]?.total ?? 0), items: rows.map(mapItem) };
  },

  async findItemById(itemId: string, db: DbExecutor = pool) {
    const [rows] = await db.execute<WarehouseItemRow[]>(`${itemSelect} WHERE wi.id = ? AND wi.deleted_at IS NULL LIMIT 1`, [itemId]);
    return rows[0] ? mapItem(rows[0]) : null;
  },

  async lockItemForUpdate(itemId: string, connection: PoolConnection): Promise<WarehouseItemLock | null> {
    const [rows] = await connection.execute<WarehouseItemLockRow[]>(
      `SELECT id, post_id, handover_point_id, status, condition_notes, storage_code
       FROM warehouse_items
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [itemId]
    );
    const row = rows[0];
    return row ? {
      id: row.id,
      postId: row.post_id,
      handoverPointId: row.handover_point_id,
      status: row.status,
      conditionNotes: row.condition_notes,
      storageCode: row.storage_code
    } : null;
  },

  async createItem(input: {
    id: string;
    postId?: string | null;
    handoverPointId: string;
    itemName: string;
    description?: string | null;
    categoryId?: string | null;
    areaId?: string | null;
    buildingId?: string | null;
    roomText?: string | null;
    finderName?: string | null;
    finderContact?: string | null;
    conditionNotes: string;
    storageCode?: string | null;
    receivedAt: Date;
    retentionDeadline: Date;
    createdBy: string;
  }, db: DbExecutor = pool) {
    await db.execute(
      `INSERT INTO warehouse_items (
        id, post_id, handover_point_id, item_name, description, category_id, area_id, building_id,
        room_text, finder_name, finder_contact, status, condition_notes, storage_code,
        received_at, retention_deadline, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.postId ?? null,
        input.handoverPointId,
        input.itemName,
        input.description ?? null,
        input.categoryId ?? null,
        input.areaId ?? null,
        input.buildingId ?? null,
        input.roomText ?? null,
        input.finderName ?? null,
        input.finderContact ?? null,
        input.conditionNotes,
        input.storageCode ?? null,
        input.receivedAt,
        input.retentionDeadline,
        input.createdBy
      ]
    );
  },

  async updateItemState(itemId: string, input: {
    status?: WarehouseStatus;
    conditionNotes?: string | null;
    storageCode?: string | null;
    returnedAt?: Date | null;
  }, db: DbExecutor = pool) {
    const fields: string[] = [];
    const values: Array<string | Date | null> = [];
    if (input.status !== undefined) {
      fields.push("status = ?");
      values.push(input.status);
    }
    if (input.conditionNotes !== undefined) {
      fields.push("condition_notes = ?");
      values.push(input.conditionNotes);
    }
    if (input.storageCode !== undefined) {
      fields.push("storage_code = ?");
      values.push(input.storageCode);
    }
    if (input.returnedAt !== undefined) {
      fields.push("returned_at = ?");
      values.push(input.returnedAt);
    }
    if (!fields.length) return;
    await db.execute(`UPDATE warehouse_items SET ${fields.join(", ")} WHERE id = ?`, [...values, itemId]);
  },

  async createStorageLog(input: {
    id: string;
    warehouseItemId: string;
    postId?: string | null;
    handoverPointId: string;
    actorId: string;
    action: StorageLogAction;
    fromStatus?: string | null;
    toStatus?: string | null;
    conditionNotes?: string | null;
    storageCode?: string | null;
    note?: string | null;
  }, db: DbExecutor = pool) {
    await db.execute(
      `INSERT INTO storage_logs (
        id, warehouse_item_id, post_id, handover_point_id, actor_id, action,
        from_status, to_status, condition_notes, storage_code, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.warehouseItemId,
        input.postId ?? null,
        input.handoverPointId,
        input.actorId,
        input.action,
        input.fromStatus ?? null,
        input.toStatus ?? null,
        input.conditionNotes ?? null,
        input.storageCode ?? null,
        input.note ?? null
      ]
    );
  },

  async listLogs(itemId: string) {
    const [rows] = await pool.execute<StorageLogRow[]>(
      `SELECT sl.id, sl.warehouse_item_id, sl.post_id, sl.handover_point_id, hp.name AS handover_point_name,
        sl.actor_id, u.full_name AS actor_name, sl.action, sl.from_status, sl.to_status,
        sl.condition_notes, sl.storage_code, sl.note, sl.created_at
       FROM storage_logs sl
       LEFT JOIN handover_points hp ON hp.id = sl.handover_point_id
       INNER JOIN users u ON u.id = sl.actor_id
       WHERE sl.warehouse_item_id = ?
          OR sl.post_id = (SELECT post_id FROM warehouse_items WHERE id = ? AND post_id IS NOT NULL)
       ORDER BY sl.created_at DESC, sl.id DESC`,
      [itemId, itemId]
    );
    return rows.map(mapLog);
  },

  async findHandoverPointById(id: string) {
    const [rows] = await pool.execute<IdRow[]>("SELECT id FROM handover_points WHERE id = ? AND is_active = TRUE LIMIT 1", [id]);
    return rows[0]?.id ?? null;
  },

  async findAreaById(id: string) {
    const [rows] = await pool.execute<IdRow[]>("SELECT id FROM campus_areas WHERE id = ? AND is_active = TRUE LIMIT 1", [id]);
    return rows[0]?.id ?? null;
  },

  async findBuildingById(id: string) {
    const [rows] = await pool.execute<BuildingRow[]>("SELECT id, area_id FROM campus_buildings WHERE id = ? AND is_active = TRUE LIMIT 1", [id]);
    return rows[0] ? { id: rows[0].id, areaId: rows[0].area_id } : null;
  },

  async findPostById(id: string) {
    const [rows] = await pool.execute<IdRow[]>("SELECT id FROM posts WHERE id = ? AND deleted_at IS NULL LIMIT 1", [id]);
    return rows[0]?.id ?? null;
  },

  async findCategoryNames(id: string) {
    const [rows] = await pool.execute<CategoryNameRow[]>(
      `SELECT c.id, c.name, p.name AS parent_name
       FROM item_categories c
       LEFT JOIN item_categories p ON p.id = c.parent_id
       WHERE c.id = ? AND c.is_active = TRUE
       LIMIT 1`,
      [id]
    );
    return rows[0] ? { id: rows[0].id, name: rows[0].name, parentName: rows[0].parent_name } : null;
  },

  async getConfigInt(key: string, fallback: number) {
    const [rows] = await pool.execute<ConfigRow[]>("SELECT config_value FROM config_entries WHERE config_key = ? LIMIT 1", [key]);
    const value = Number.parseInt(rows[0]?.config_value ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
};
