import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrivateMediaStorage } from "../application/media-storage.port.js";
import { AppError } from "../domain/app-error.js";
import { mediaContentType } from "../domain/media.js";
import { ensureStoredFileExists, removeStoredFileIfPresent } from "./media-storage.js";

export function createPrivateMediaStorage(options: {
  uploadDir: string;
  namespace: "post-media" | "claim-evidence";
  invalidPathMessage: string;
  notFoundMessage: string;
}): PrivateMediaStorage {
  const root = path.resolve(options.uploadDir, options.namespace);
  const prefix = `private://${options.namespace}/`;

  function resolvePath(secureUrl: string) {
    if (!secureUrl.startsWith(prefix)) throw new AppError("not_found", options.notFoundMessage);
    const parts = secureUrl.slice(prefix.length).split("/");
    if (parts.length !== 2) throw new AppError("not_found", options.notFoundMessage);
    const [ownerId, filename] = parts;
    if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename)) {
      throw new AppError("not_found", options.notFoundMessage);
    }
    const filePath = path.resolve(root, ownerId, filename);
    if (!filePath.startsWith(`${root}${path.sep}`)) throw new AppError("not_found", options.notFoundMessage);
    return filePath;
  }

  return {
    async save(ownerId, mediaId, extension, bytes) {
      const filename = `${mediaId}.${extension}`;
      const directory = path.resolve(root, ownerId);
      const filePath = path.resolve(directory, filename);
      if (!filePath.startsWith(`${root}${path.sep}`)) throw new AppError("bad_request", options.invalidPathMessage);
      await mkdir(directory, { recursive: true });
      await writeFile(filePath, bytes, { flag: "wx" });
      return { secureUrl: `${prefix}${ownerId}/${filename}`, publicId: `${options.namespace}/${ownerId}/${mediaId}` };
    },
    async resolve(secureUrl, format = "jpg") {
      const filePath = resolvePath(secureUrl);
      await ensureStoredFileExists(filePath);
      return { body: await readFile(filePath), contentType: mediaContentType(format as "jpg" | "png" | "webp") };
    },
    async remove(secureUrl) {
      await removeStoredFileIfPresent(resolvePath(secureUrl));
    }
  };
}
