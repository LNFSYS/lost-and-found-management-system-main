import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("crafted multipart fields cannot terminate the API upload process", { timeout: 15_000 }, async () => {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const { stdout } = await promisify(execFile)(process.execPath, [
    "--import", "tsx", "--max-old-space-size=64", "src/test/upload-process-safety.mjs"
  ], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    env: environment, timeout: 10_000, windowsHide: true
  });
  assert.match(stdout, /upload_process_survived/);
});
