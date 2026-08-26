import type { PoolConnection } from "mysql2/promise";
import { withTransaction } from "../config/db.js";
import { systemConfigRepository, type SystemConfigRecord, type SystemConfigRepository } from "../repositories/system-config.repository.js";
import { HttpError } from "../utils/http-error.js";
import { id } from "../utils/security.js";
import type { ConfigValueType, CreateConfigInput, ListConfigsQuery, UpdateConfigInput } from "../validators/system-config.validator.js";

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

function isPublicKeyAllowed(configKey: string) {
  return PUBLIC_CONFIG_KEYS.has(configKey) || configKey.startsWith("client.");
}

function parseConfigValue(value: string, valueType: ConfigValueType): PublicConfigValue {
  if (valueType === "INTEGER") {
    if (!/^-?\d+$/.test(value)) throw new HttpError(422, "Gia tri INTEGER khong hop le");
    return Number.parseInt(value, 10);
  }
  if (valueType === "FLOAT") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new HttpError(422, "Gia tri FLOAT khong hop le");
    return parsed;
  }
  if (valueType === "BOOLEAN") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1"].includes(normalized)) return true;
    if (["false", "0"].includes(normalized)) return false;
    throw new HttpError(422, "Gia tri BOOLEAN khong hop le");
  }
  if (valueType === "JSON") {
    try {
      return JSON.parse(value) as PublicConfigValue;
    } catch {
      throw new HttpError(422, "Gia tri JSON khong hop le");
    }
  }
  return value;
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
  transaction?: TransactionRunner;
  idFactory?: () => string;
} = {}) {
  const repository = options.repository ?? systemConfigRepository;
  const transaction = options.transaction ?? withTransaction;
  const idFactory = options.idFactory ?? id;

  return {
    publicKeyAllowed: isPublicKeyAllowed,
    parseValue: parseConfigValue,

    async listConfigs(filters: ListConfigsQuery) {
      return repository.listConfigs(filters);
    },

    async listPublicConfigs() {
      const configs = await repository.listPublicConfigs();
      const items = configs.filter((config) => config.isPublic && isPublicKeyAllowed(config.configKey)).map(publicConfigItem);
      return { items, values: Object.fromEntries(items.map((item) => [item.key, item.value])) };
    },

    async getConfig(configId: string) {
      const config = await repository.findById(configId);
      if (!config) throw new HttpError(404, "Khong tim thay config");
      return config;
    },

    async createConfig(actorId: string, input: CreateConfigInput) {
      const configKey = input.configKey.trim();
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
        await repository.recordHistory({ id: idFactory(), configKey, oldValue: null, newValue: configValue, actorId }, connection);
        const created = await repository.findById(configId, connection);
        if (!created) throw new HttpError(500, "Khong the tao config");
        return created;
      });
    },

    async updateConfig(actorId: string, configId: string, input: UpdateConfigInput) {
      const current = await this.getConfig(configId);
      const nextKey = input.configKey?.trim() ?? current.configKey;
      const nextType = input.valueType ?? current.valueType;
      const nextValue = input.configValue !== undefined ? canonicalConfigValue(input.configValue, nextType) : current.configValue;
      const nextIsPublic = input.isPublic ?? current.isPublic;
      validatePublicExposure(nextKey, nextIsPublic);
      return transaction(async (connection) => {
        if (nextKey !== current.configKey && await repository.findByKey(nextKey, configId, connection)) throw new HttpError(409, "Config key da ton tai");
        await repository.updateConfig(configId, {
          configKey: input.configKey !== undefined ? nextKey : undefined,
          configValue: input.configValue !== undefined || input.valueType !== undefined ? nextValue : undefined,
          valueType: input.valueType,
          description: input.description,
          isPublic: input.isPublic,
          actorId
        }, connection);
        await repository.recordHistory({ id: idFactory(), configKey: nextKey, oldValue: current.configValue, newValue: nextValue, actorId }, connection);
        const updated = await repository.findById(configId, connection);
        if (!updated) throw new HttpError(404, "Khong tim thay config");
        return updated;
      });
    },

    async deleteConfig(actorId: string, configId: string) {
      const current = await this.getConfig(configId);
      await transaction(async (connection) => {
        await repository.deleteConfig(configId, connection);
        await repository.recordHistory({ id: idFactory(), configKey: current.configKey, oldValue: current.configValue, newValue: "", actorId }, connection);
      });
    }
  };
}

export const systemConfigService = createSystemConfigService();
