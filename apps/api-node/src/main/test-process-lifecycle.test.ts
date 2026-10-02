import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

test("app tests and skipped integration suites exit without forcing process shutdown", { timeout: 40_000 }, async () => {
  const childEnvironment: NodeJS.ProcessEnv = { ...process.env, LNFS_DB_INTEGRATION: "0", LNFS_TEST_USE_EXTERNAL_ENV: "0" };
  // A nested runner must not inherit the parent's internal reporting context.
  delete childEnvironment.NODE_TEST_CONTEXT;
  const { stdout } = await promisify(execFile)(process.execPath, [
    "--import", "tsx", "--import", "./src/test/setup-env.ts", "--test",
    "src/main/app.test.ts",
    "src/integration/custody-safety.integration.test.ts",
    "src/integration/database.integration.test.ts",
    "src/integration/migration-reconciliation.integration.test.ts"
  ], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    env: childEnvironment,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true
  });
  assert.match(stdout, /# fail 0\b/);
  assert.match(stdout, /# skipped 3\b/);
});
