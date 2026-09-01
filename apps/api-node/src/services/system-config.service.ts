import type { PoolConnection } from "mysql2/promise";
import { withTransaction } from "../config/db.js";
import { adminAuditRepository, type AdminAuditRepository } from "../repositories/admin-audit.repository.js";
import { systemConfigRepository, type SystemConfigRecord, type SystemConfigRepository } from "../repositories/system-config.repository.js";
import { HttpError } from "../utils/http-error.js";
import { id } from "../utils/security.js";
import type { ConfigValueType, CreateConfigInput, ConfigHistoryQuery, ListConfigsQuery, UpdateConfigInput } from "../validators/system-config.validator.js";

type TransactionRunner = <T>(work: (connection: PoolConnection) => Promise<T>) => Promise<T>;
type PublicConfigValue = string | number | boolean | unknown[] | Record<string, unknown>;

const PUBLIC_CONFIG_KEYS = new Set([
  "post.expiration_days",
  "post.max_per_user_per_day",
  "post.max_images",
  "post.max_image_size_mb",
  "post.allowed_image_formats",
  "matching.threshold",
  "matching.suggestion_threshold",
  "matching.notification_threshold",
  "privacy.private_found_enabled"
]);
const SENSITIVE_CONFIG_KEY = /(^|[._])(secret|password|pass|token|credential|credentials|private[_-]?key|api[_-]?key|access[_-]?key|client[_-]?secret|jwt[_-]?secret|encryption[_-]?key|salt)([._]|$)/i;
const REDACTED = "[REDACTED]";

function isPublicKeyAllowed(configKey: string) {
  return PUBLIC_CONFIG_KEYS.has(configKey) || configKey.startsWith("client.");
}

function isSensitiveConfigKey(configKey: string) {
  return SENSITIVE_CONFIG_KEY.test(configKey);
}

function validateWritableKey(configKey: string) {
  if (isSensitiveConfigKey(configKey)) {
    throw new HttpError(422, "Config nhay cam phai duoc quan ly bang bien moi truong");
  }
}

function parseConfigValue(value: string, valueType: ConfigValueType): PublicConfigValue {
  const normalizedValue = value.trim();
  if (valueType === "INTEGER") {
    if (!/^-?\d+$/.test(normalizedValue)) throw new HttpError(422, "Gia tri INTEGER khong hop le");
    const parsed = Number(normalizedValue);
    if (!Number.isSafeInteger(parsed)) throw new HttpError(422, "Gia tri INTEGER vuot qua gioi han an toan");
    return parsed;
  }
  if (valueType === "FLOAT") {
    const parsed = Number(normalizedValue);
    if (!Number.isFinite(parsed)) throw new HttpError(422, "Gia tri FLOAT khong hop le");
    return parsed;
  }
  if (valueType === "BOOLEAN") {
    if (["true", "1"].includes(normalizedValue.toLowerCase())) return true;
    if (["false", "0"].includes(normalizedValue.toLowerCase())) return false;
    throw new HttpError(422, "Gia tri BOOLEAN khong hop le");
  }
  if (valueType === "JSON") {
    try {
      return JSON.parse(normalizedValue) as PublicConfigValue;
    } catch {
      throw new HttpError(422, "Gia tri JSON khong hop le");
    }
  }
  return normalizedValue;
}

function canonicalConfigValue(value: string, valueType: ConfigValueType) {
  const parsed = parseConfigValue(value, valueType);
  if (valueType === "BOOLEAN") return parsed ? "1" : "0";
  if (valueType === "JSON") return JSON.stringify(parsed);
  return String(parsed);
}

function validatePublicExposure(configKey: string, isPublic: boolean) {
  if (isPublic && !isPublicKeyAllowed(configKey)) {
    throw new HttpError(422, "Config nay khong duoc phep cong khai");
  }
}

function historyValue(configKey: string, value: string | null) {
  return value === null ? null : isSensitiveConfigKey(configKey) ? REDACTED : value;
}

function configState(config: SystemConfigRecord, value = config.configValue): Record<string, unknown> {
  return {
    configKey: config.configKey,
    configValue: historyValue(config.configKey, value),
    valueType: config.valueType,
    description: config.description,
    isPublic: config.isPublic
  };
}

function safeConfigRecord(config: SystemConfigRecord): SystemConfigRecord {
  return isSensitiveConfigKey(config.configKey) ? { ...config, configValue: REDACTED } : config;
}

function safeHistoryState(state: Record<string, unknown> | null, sensitive: boolean) {
  if (!state || !sensitive) return state;
  return { ...state, configValue: REDACTED };
}

function safeHistoryEntry(entry: Awaited<ReturnType<SystemConfigRepository["listHistory"]>>[number]) {
  const sensitive = isSensitiveConfigKey(entry.configKey)
    || isSensitiveConfigKey(entry.oldConfigKey ?? "")
    || isSensitiveConfigKey(entry.newConfigKey ?? "");
  if (!sensitive) return entry;
  return {
    ...entry,
    oldValue: entry.oldValue === null ? null : REDACTED,
    newValue: REDACTED,
    oldState: safeHistoryState(entry.oldState, true),
    newState: safeHistoryState(entry.newState, true)
  };
}

function publicConfigItem(config: SystemConfigRecord) {
  return {
    key: config.configKey,
    value: parseConfigValue(config.configValue, config.valueType),
    valueType: config.valueType,
    description: config.description
  };
}

export function createSystemConfigService(options: {
  repository?: SystemConfigRepository;
  auditRepository?: AdminAuditRepository;
  transaction?: TransactionRunner;
  idFactory?: () => string;
} = {}) {
  const repository = options.repository ?? systemConfigRepository;
  const audit = options.auditRepository ?? adminAuditRepository;
  const transaction = options.transaction ?? withTransaction;
  const idFactory = options.idFactory ?? id;

  async function recordAudit(input: {
    actorId: string;
    action: string;
    targetId: string;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
    reason?: string | null;
  }, connection: PoolConnection) {
    await audit.record({
      id: idFactory(),
      actorId: input.actorId,
      action: input.action,
      targetType: "SYSTEM_CONFIG",
      targetId: input.targetId,
      beforeState: input.beforeState,
      afterState: input.afterState,
      reason: input.reason ?? null
    }, connection);
  }

  return {
    publicKeyAllowed: isPublicKeyAllowed,
    sensitiveKey: isSensitiveConfigKey,
    parseValue: parseConfigValue,

    async listConfigs(filters: ListConfigsQuery) {
      const result = await repository.listConfigs(filters);
      return { ...result, items: result.items.map(safeConfigRecord) };
    },

    async listPublicConfigs() {
      const configs = await repository.listPublicConfigs();
      const items = configs.filter((config) => config.isPublic && isPublicKeyAllowed(config.configKey)).map(publicConfigItem);
      return { items, values: Object.fromEntries(items.map((item) => [item.key, item.value])) };
    },

    async getConfig(configId: string) {
      const config = await repository.findById(configId);
      if (!config) throw new HttpError(404, "Khong tim thay config");
      return safeConfigRecord(config);
    },

    async listHistory(configId: string, query: ConfigHistoryQuery) {
      const config = await repository.findById(configId);
      if (!config) throw new HttpError(404, "Khong tim thay config");
      const items = await repository.listHistory(config.id, config.configKey, query.limit);
      return { items: items.map(safeHistoryEntry) };
    },

    async createConfig(actorId: string, input: CreateConfigInput) {
      const configKey = input.configKey.trim();
      validateWritableKey(configKey);
      const configValue = canonicalConfigValue(input.configValue, input.valueType);
      validatePublicExposure(configKey, input.isPublic);
      return transaction(async (connection) => {
        if (await repository.findByKey(configKey, undefined, connection)) throw new HttpError(409, "Config key da ton tai");
        const configId = idFactory();
        await repository.createConfig({
          id: configId,
          configKey,
          configValue,
          valueType: input.valueType,
          description: input.description ?? null,
          isPublic: input.isPublic,
          actorId
        }, connection);
        const created = await repository.findById(configId, connection);
        if (!created) throw new HttpError(500, "Khong the tao config");
        await repository.recordHistory({
          id: idFactory(),
          configId,
          action: "CREATE",
          configKey,
          oldConfigKey: null,
          newConfigKey: configKey,
          oldValue: null,
          newValue: historyValue(configKey, configValue) ?? "",
          oldValueType: null,
          newValueType: input.valueType,
          oldState: null,
          newState: configState(created),
          actorId,
          reason: input.reason ?? null
        }, connection);
        await recordAudit({
          actorId,
          action: "ADMIN_CONFIG_CREATED",
          targetId: configId,
          beforeState: null,
          afterState: configState(created),
          reason: input.reason ?? null
        }, connection);
        return created;
      });
    },

    async updateConfig(actorId: string, configId: string, input: UpdateConfigInput) {
      return transaction(async (connection) => {
        const current = await repository.findById(configId, connection, true);
        if (!current) throw new HttpError(404, "Khong tim thay config");
        const nextKey = input.configKey?.trim() ?? current.configKey;
        const nextType = input.valueType ?? current.valueType;
        const nextValue = input.configValue !== undefined || input.valueType !== undefined
          ? canonicalConfigValue(input.configValue ?? current.configValue, nextType)
          : current.configValue;
        const nextIsPublic = input.isPublic ?? current.isPublic;
        validateWritableKey(nextKey);
        validatePublicExposure(nextKey, nextIsPublic);
        if (nextKey !== current.configKey && await repository.findByKey(nextKey, configId, connection)) {
          throw new HttpError(409, "Config key da ton tai");
        }
        await repository.updateConfig(configId, {
          configKey: input.configKey !== undefined ? nextKey : undefined,
          configValue: input.configValue !== undefined || input.valueType !== undefined ? nextValue : undefined,
          valueType: input.valueType,
          description: input.description,
          isPublic: input.isPublic,
          actorId
        }, connection);
        const updated = await repository.findById(configId, connection);
        if (!updated) throw new HttpError(404, "Khong tim thay config");
        await repository.recordHistory({
          id: idFactory(),
          configId,
          action: "UPDATE",
          configKey: nextKey,
          oldConfigKey: current.configKey,
          newConfigKey: nextKey,
          oldValue: historyValue(current.configKey, current.configValue),
          newValue: historyValue(nextKey, nextValue) ?? "",
          oldValueType: current.valueType,
          newValueType: nextType,
          oldState: configState(current),
          newState: configState(updated),
          actorId,
          reason: input.reason ?? null
        }, connection);
        await recordAudit({
          actorId,
          action: "ADMIN_CONFIG_UPDATED",
          targetId: configId,
          beforeState: configState(current),
          afterState: configState(updated),
          reason: input.reason
        }, connection);
        return updated;
      });
    },

    async deleteConfig(actorId: string, configId: string, reason?: string | null) {
      await transaction(async (connection) => {
        const current = await repository.findById(configId, connection, true);
        if (!current) throw new HttpError(404, "Khong tim thay config");
        if (!await repository.deleteConfig(configId, connection)) throw new HttpError(404, "Khong tim thay config");
        await repository.recordHistory({
          id: idFactory(),
          configId,
          action: "DELETE",
          configKey: current.configKey,
          oldConfigKey: current.configKey,
          newConfigKey: null,
          oldValue: historyValue(current.configKey, current.configValue),
          newValue: "",
          oldValueType: current.valueType,
          newValueType: null,
          oldState: configState(current),
          newState: null,
          actorId,
          reason: reason ?? null
        }, connection);
        await recordAudit({
          actorId,
          action: "ADMIN_CONFIG_DELETED",
          targetId: configId,
          beforeState: configState(current),
          afterState: null,
          reason: reason ?? null
        }, connection);
      });
    }
  };
}

export const systemConfigService = createSystemConfigService();
