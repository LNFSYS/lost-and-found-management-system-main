import { access, unlink } from "node:fs/promises";
import { AppError } from "../domain/app-error.js";

function isMissingFile(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

export async function ensureStoredFileExists(filePath: string) {
  try {
    await access(filePath);
  } catch (error) {
    if (isMissingFile(error)) throw new AppError("not_found", "Không tìm thấy tệp media");
    throw error;
  }
}

export async function removeStoredFileIfPresent(filePath: string) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
}
