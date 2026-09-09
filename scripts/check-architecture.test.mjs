import assert from "node:assert/strict";
import test from "node:test";
import { auditArchitecture } from "./check-architecture.mjs";

test("architecture rejects outward, external, deep and circular type dependencies", () => {
  const { errors } = auditArchitecture({
    "modules/a/domain/a.ts": 'import type { X } from "../application/a.js"; import type { Pool } from "mysql2";',
    "modules/a/application/a.ts": 'import type { X } from "../../b/application/b.js"; export type X = string;',
    "modules/b/application/b.ts": 'import type { X } from "../../a/domain/a.js";'
  });
  assert.ok(errors.some(value => value.includes("domain ->")));
  assert.ok(errors.some(value => value.includes("core external")));
  assert.ok(errors.some(value => value.includes("public application contract")));
  assert.ok(errors.some(value => value.includes("Circular dependency")));
});

test("architecture permits inward adapters and public application contracts", () => {
  const { errors } = auditArchitecture({
    "modules/a/application/a.ts": 'import type { X } from "../../b/application/index.js";',
    "modules/b/application/index.ts": 'export type { X } from "./b.js";',
    "modules/b/application/b.ts": 'export type X = string;',
    "modules/a/infrastructure/sql.ts": 'import "../application/a.js"; import "mysql2";'
  });
  assert.deepEqual(errors, []);
});
