import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../config/db.js";
import type { ConfigValueType, ListConfigsQuery } from "../validators/system-config.validator.js";

type Queryable = Pick<PoolConnection, "execute">;
type SqlValue = string | number | boolean | null;

export interface SystemConfigRecord {
  id: string;
  configKey: string;
  configValue: string;
  valueType: ConfigValueType;
  description: string | null;
  isPublic: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

interface ConfigRow extends RowDataPacket {
  id: string;
  config_key: string;
  config_value: string;
  value_type: ConfigValueType;
  description: string | null;
  is_public: 0 | 1 | boolean;
  updated_by: string | null;
  updated_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number | string;
}

function mapConfig(row: ConfigRow): SystemConfigRecord {
  return {
    id: row.id,
    configKey: row.config_key,
    configValue: row.config_value,
    valueType: row.value_type,
    description: row.description,
    isPublic: Boolean(row.is_public),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at.toISOString()
  };
}

function buildFilters(filters: ListConfigsQuery) {
  const where: string[] = [];
  const values: SqlValue[] = [];
  if (filters.q) {
    where.push("(config_key LIKE ? OR description LIKE ?)");
    const q = `%${filters.q}%`;
    values.push(q, q);
  }
  if (filters.valueType) {
    where.push("value_type = ?");
    values.push(filters.valueType);
  }
  if (filters.isPublic !== undefined) {
    where.push("is_public = ?");
    values.push(filters.isPublic);
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", values };
}

export const systemConfigRepository = {
  async listConfigs(filters: ListConfigsQuery) {
    const { sql, values } = buildFilters(filters);
    const limit = filters.pageSize;
    const offset = (filters.page - 1) * filters.pageSize;
    const [countRows] = await pool.execute<CountRow[]>(`SELECT COUNT(*) AS total FROM config_entries ${sql}`, values);
    const [rows] = await pool.execute<ConfigRow[]>(
      `SELECT id, config_key, config_value, value_type, description, is_public, updated_by, updated_at
       FROM config_entries ${sql}
       ORDER BY config_key ASC
       LIMIT ${limit} OFFSET ${offset}`,
      values
    );
    return { total: Number(countRows[0]?.total ?? 0), page: filters.page, pageSize: filters.pageSize, items: rows.map(mapConfig) };
  },

  async listPublicConfigs() {
    const [rows] = await pool.execute<ConfigRow[]>(
      `SELECT id, config_key, config_value, value_type, description, is_public, updated_by, updated_at
       FROM config_entries
       WHERE is_public = TRUE
       ORDER BY config_key ASC`
    );
    return rows.map(mapConfig);
  },

  async findById(configId: string, connection: Queryable = pool) {
    const [rows] = await connection.execute<ConfigRow[]>(
      `SELECT id, config_key, config_value, value_type, description, is_public, updated_by, updated_at
       FROM config_entries WHERE id = ? LIMIT 1`,
      [configId]
    );
    return rows[0] ? mapConfig(rows[0]) : null;
  },

  async findByKey(configKey: string, exceptId?: string, connection: Queryable = pool): Promise<SystemConfigRecord | null> {
    const [rows] = await connection.execute<ConfigRow[]>(
      `SELECT id, config_key, config_value, value_type, description, is_public, updated_by, updated_at
       FROM config_entries
       WHERE config_key = ? ${exceptId ? "AND id <> ?" : ""}
       LIMIT 1`,
      exceptId ? [configKey, exceptId] : [configKey]
    );
    return rows[0] ? mapConfig(rows[0]) : null;
  },

  async createConfig(input: {
    id: string;
    configKey: string;
    configValue: string;
    valueType: ConfigValueType;
    description: string | null;
    isPublic: boolean;
    actorId: string;
  }, connection: Queryable) {
    await connection.execute(
      `INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.id, input.configKey, input.configValue, input.valueType, input.description, input.isPublic, input.actorId]
    );
  },

  async updateConfig(configId: string, input: {
    configKey?: string;
    configValue?: string;
    valueType?: ConfigValueType;
    description?: string | null;
    isPublic?: boolean;
    actorId: string;
  }, connection: Queryable) {
    const fields: string[] = [];
    const values: SqlValue[] = [];
    if (input.configKey !== undefined) { fields.push("config_key = ?"); values.push(input.configKey); }
    if (input.configValue !== undefined) { fields.push("config_value = ?"); values.push(input.configValue); }
    if (input.valueType !== undefined) { fields.push("value_type = ?"); values.push(input.valueType); }
    if (input.description !== undefined) { fields.push("description = ?"); values.push(input.description); }
    if (input.isPublic !== undefined) { fields.push("is_public = ?"); values.push(input.isPublic); }
    fields.push("updated_by = ?");
    values.push(input.actorId);
    await connection.execute(`UPDATE config_entries SET ${fields.join(", ")} WHERE id = ?`, [...values, configId]);
  },

  async deleteConfig(configId: string, connection: Queryable) {
    const [result] = await connection.execute<ResultSetHeader>("DELETE FROM config_entries WHERE id = ?", [configId]);
    return result.affectedRows > 0;
  },

  async recordHistory(input: { id: string; configKey: string; oldValue: string | null; newValue: string; actorId: string }, connection: Queryable) {
    await connection.execute(
      "INSERT INTO config_history (id, config_key, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)",
      [input.id, input.configKey, input.oldValue, input.newValue, input.actorId]
    );
  }
};

export type SystemConfigRepository = typeof systemConfigRepository;
