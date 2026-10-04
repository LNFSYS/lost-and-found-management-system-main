import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

for (const entry of ["server", "notification-email-worker"]) {
  for (const outcome of ["success", "failure"]) {
    test(`${entry} drains ${outcome} email delivery before closing DB and exits naturally`, { timeout: 15_000 }, async () => {
      const environment = { ...process.env };
      delete environment.NODE_TEST_CONTEXT;
      const { stdout } = await promisify(execFile)(process.execPath, [
        "--experimental-test-module-mocks", "--import", "tsx", "src/test/shutdown-process.mjs", entry, outcome
      ], { cwd: fileURLToPath(new URL("../../", import.meta.url)), env: environment, timeout: 10_000, windowsHide: true });
      assert.match(stdout, /shutdown_drained/);
    });
  }
}

test("disabled standalone email worker closes its unused pool and exits", { timeout: 15_000 }, async () => {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const { stdout } = await promisify(execFile)(process.execPath, [
    "--experimental-test-module-mocks", "--import", "tsx", "src/test/shutdown-process.mjs", "notification-email-worker", "disabled"
  ], { cwd: fileURLToPath(new URL("../../", import.meta.url)), env: environment, timeout: 10_000, windowsHide: true });
  assert.match(stdout, /shutdown_drained/);
});
