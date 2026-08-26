import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import type { SystemConfigRecord, SystemConfigRepository } from "../repositories/system-config.repository.js";
import { HttpError } from "../utils/http-error.js";
import { createSystemConfigService } from "./system-config.service.js";

function makeConfig(overrides: Partial<SystemConfigRecord> = {}): SystemConfigRecord {
  return {
    id: overrides.id ?? "config-id",
    configKey: overrides.configKey ?? "client.max_title_length",
    configValue: overrides.configValue ?? "120",
    valueType: overrides.valueType ?? "INTEGER",
    description: overrides.description ?? null,
    isPublic: overrides.isPublic ?? true,
    updatedBy: overrides.updatedBy ?? null,
    updatedAt: overrides.updatedAt ?? "2026-08-24T00:00:00.000Z"
  };
}

function fakeRepository(seed: SystemConfigRecord[] = []) {
  const configs = new Map(seed.map((config) => [config.id, { ...config }]));
  const history: Array<{ configKey: string; oldValue: string | null; newValue: string; actorId: string }> = [];
  const repository: SystemConfigRepository = {
    async listConfigs(filters) {
      const items = [...configs.values()].filter((config) => (
        (!filters.valueType || config.valueType === filters.valueType) &&
        (filters.isPublic === undefined || config.isPublic === filters.isPublic)
      ));
      return { total: items.length, page: filters.page, pageSize: filters.pageSize, items };
    },
    async listPublicConfigs() {
      return [...configs.values()].filter((config) => config.isPublic);
    },
    async findById(configId) {
      return configs.get(configId) ?? null;
    },
    async findByKey(configKey, exceptId) {
      return [...configs.values()].find((config) => config.configKey === configKey && config.id !== exceptId) ?? null;
    },
    async createConfig(input) {
      configs.set(input.id, makeConfig({
        id: input.id,
        configKey: input.configKey,
        configValue: input.configValue,
        valueType: input.valueType,
        description: input.description,
        isPublic: input.isPublic,
        updatedBy: input.actorId
      }));
    },
    async updateConfig(configId, input) {
      const config = configs.get(configId);
      if (!config) return;
      if (input.configKey !== undefined) config.configKey = input.configKey;
      if (input.configValue !== undefined) config.configValue = input.configValue;
      if (input.valueType !== undefined) config.valueType = input.valueType;
      if (input.description !== undefined) config.description = input.description;
      if (input.isPublic !== undefined) config.isPublic = input.isPublic;
      config.updatedBy = input.actorId;
    },
    async deleteConfig(configId) {
      return configs.delete(configId);
    },
    async recordHistory(input) {
      history.push(input);
    }
  };
  return { repository, configs, history };
}

function serviceFor(repository: SystemConfigRepository) {
  let index = 0;
  return createSystemConfigService({
    repository,
    transaction: async (work) => work({} as PoolConnection),
    idFactory: () => `id-${++index}`
  });
}

test("system config service supports admin CRUD and records history", async () => {
  const { repository, history } = fakeRepository();
  const service = serviceFor(repository);
  const created = await service.createConfig("admin-id", {
    configKey: "client.max_title_length",
    configValue: "120",
    valueType: "INTEGER",
    description: "Max title length",
    isPublic: true
  });
  assert.equal(created.configValue, "120");
  assert.equal(history.length, 1);

  const updated = await service.updateConfig("admin-id", created.id, { configValue: "150" });
  assert.equal(updated.configValue, "150");
  assert.equal(history.length, 2);

  const listed = await service.listConfigs({ page: 1, pageSize: 20 });
  assert.equal(listed.total, 1);

  await service.deleteConfig("admin-id", created.id);
  assert.equal(history.at(-1)?.newValue, "");
});

test("system config service exposes only allowed public keys", async () => {
  const { repository } = fakeRepository([
    makeConfig({ id: "safe", configKey: "post.max_images", configValue: "5", valueType: "INTEGER", isPublic: true }),
    makeConfig({ id: "unsafe", configKey: "security.jwt_secret", configValue: "secret", valueType: "STRING", isPublic: true })
  ]);
  const result = await serviceFor(repository).listPublicConfigs();
  assert.deepEqual(result.values, { "post.max_images": 5 });
  assert.equal(result.items.length, 1);
});

test("system config service validates values by type", async () => {
  const service = serviceFor(fakeRepository().repository);
  await assert.rejects(() => service.createConfig("admin-id", {
    configKey: "client.max_title_length",
    configValue: "many",
    valueType: "INTEGER",
    isPublic: true
  }), (error: unknown) => error instanceof HttpError && error.status === 422);
});

test("system config service rejects public exposure outside allowlist", async () => {
  const service = serviceFor(fakeRepository().repository);
  await assert.rejects(() => service.createConfig("admin-id", {
    configKey: "security.jwt_secret",
    configValue: "secret",
    valueType: "STRING",
    isPublic: true
  }), (error: unknown) => error instanceof HttpError && error.status === 422);
});
