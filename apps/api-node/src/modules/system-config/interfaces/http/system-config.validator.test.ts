import assert from "node:assert/strict";
import test from "node:test";
import { createConfigSchema, listConfigsQuerySchema, updateConfigSchema } from "./system-config.validator.js";

test("system config validator accepts a typed config", () => {
  const result = createConfigSchema.safeParse({
    configKey: "client.max_title_length",
    configValue: "120",
    valueType: "INTEGER",
    isPublic: true
  });
  assert.equal(result.success, true);
});

test("system config validator rejects unsafe key format and empty update", () => {
  assert.equal(createConfigSchema.safeParse({ configKey: "JWT_SECRET", configValue: "x", valueType: "STRING" }).success, false);
  assert.equal(updateConfigSchema.safeParse({}).success, false);
});

test("system config query parser preserves false boolean filter", () => {
  const result = listConfigsQuerySchema.parse({ isPublic: "false" });
  assert.equal(result.isPublic, false);
});

test("system config validator accepts an optional audit reason", () => {
  const result = updateConfigSchema.safeParse({ isPublic: false, reason: "Hide from client" });
  assert.equal(result.success, true);
});
