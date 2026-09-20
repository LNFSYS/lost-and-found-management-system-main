import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AppError } from "../domain/app-error.js";
import { ensureStoredFileExists, removeStoredFileIfPresent } from "./media-storage.js";

test("missing media is converted to a controlled 404", async () => {
  const missing = path.join(os.tmpdir(), `lnfs-missing-${Date.now()}.jpg`);
  await assert.rejects(ensureStoredFileExists(missing), (error: unknown) => (
    error instanceof AppError && error.code === "not_found" && error.message === "Không tìm thấy tệp media"
  ));
});

test("media deletion treats an absent file as already removed", async () => {
  const missing = path.join(os.tmpdir(), `lnfs-already-removed-${Date.now()}.jpg`);
  await removeStoredFileIfPresent(missing);
});

test("media deletion removes files but propagates real filesystem failures", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lnfs-media-test-"));
  const file = path.join(directory, "item.jpg");
  const notAFile = path.join(directory, "folder");
  await writeFile(file, "test", "utf8");
  await mkdir(notAFile);
  try {
    await removeStoredFileIfPresent(file);
    await assert.rejects(access(file));
    await assert.rejects(removeStoredFileIfPresent(notAFile));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
