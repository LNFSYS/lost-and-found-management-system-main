import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { ConfigValueType, ListConfigsQuery } from "./system-config.dto.js";

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

export interface SystemConfigRepository {
  listConfigs(filters: ListConfigsQuery): Promise<{
    total: number;
    page: number;
    pageSize: number;
    items: SystemConfigRecord[];
  }>;
  listPublicConfigs(): Promise<SystemConfigRecord[]>;
  findById(configId: string, connection?: TransactionContext, forUpdate?: boolean): Promise<SystemConfigRecord | null>;
  findByKey(configKey: string, exceptId?: string, connection?: TransactionContext): Promise<SystemConfigRecord | null>;
  createConfig(input: {
    id: string;
    configKey: string;
    configValue: string;
    valueType: ConfigValueType;
    description: string | null;
    isPublic: boolean;
    actorId: string;
  }, connection: TransactionContext): Promise<void>;
  updateConfig(configId: string, input: {
    configKey?: string;
    configValue?: string;
    valueType?: ConfigValueType;
    description?: string | null;
    isPublic?: boolean;
    actorId: string;
  }, connection: TransactionContext): Promise<void>;
  deleteConfig(configId: string, connection: TransactionContext): Promise<boolean>;
  recordHistory(input: {
    id: string;
    configId: string;
    action: string;
    configKey: string;
    oldConfigKey: string | null;
    newConfigKey: string | null;
    oldValue: string | null;
    newValue: string;
    oldValueType: string | null;
    newValueType: string | null;
    oldState: Record<string, unknown> | null;
    newState: Record<string, unknown> | null;
    actorId: string;
    reason: string | null;
  }, connection: TransactionContext): Promise<void>;
  listHistory(configId: string, configKey: string, limit: number, connection?: TransactionContext): Promise<{
    id: string;
    configId: string | null;
    action: string;
    configKey: string;
    oldConfigKey: string | null;
    newConfigKey: string | null;
    oldValue: string | null;
    newValue: string;
    oldValueType: string | null;
    newValueType: string | null;
    oldState: Record<string, unknown> | null;
    newState: Record<string, unknown> | null;
    changedBy: string;
    changedAt: string;
    reason: string | null;
  }[]>;
}
