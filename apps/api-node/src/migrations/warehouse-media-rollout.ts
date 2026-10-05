import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { PrivateMediaStorage } from "../shared/application/media-storage.port.js";
import type { ImageFormat } from "../shared/domain/media.js";

export type WarehouseMediaTable = "warehouse_intake_images" | "warehouse_private_proofs";
export interface LegacyWarehouseMedia {
  table: WarehouseMediaTable; id: string; ownerId: string; storageRef: string;
  format: ImageFormat; bytes: number; intakeId: string | null;
}
export interface MediaRolloutEntry {
  row: LegacyWarehouseMedia; newRef: string; sourceSha256: string;
  deliverySha256?: string; state: "PLANNED" | "VERIFIED" | "COMMITTED" | "CONFLICT" | "REVIEW_REQUIRED";
  reason?: string;
}

export const digest = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

export function encryptMediaArchive(value: unknown, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(gzipSync(JSON.stringify(value))), cipher.final()]);
  return Buffer.concat([Buffer.from("LNFSWM01"), iv, cipher.getAuthTag(), body]);
}

export function decryptMediaArchive(bytes: Buffer, key: Buffer): unknown {
  if (bytes.subarray(0, 8).toString() !== "LNFSWM01") throw new Error("Unsupported warehouse media archive");
  const cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(8, 20));
  cipher.setAuthTag(bytes.subarray(20, 36));
  return JSON.parse(gunzipSync(Buffer.concat([cipher.update(bytes.subarray(36)), cipher.final()])).toString());
}

export async function writeMediaArchive(file: string, value: unknown, key: Buffer) {
  await writeFile(file, encryptMediaArchive(value, key), { flag: "wx", mode: 0o600 });
  if (JSON.stringify(decryptMediaArchive(await readFile(file), key)) !== JSON.stringify(value)) throw new Error("Media archive verification failed");
}

export function legacyMediaPath(reference: string) {
  const match = reference.match(/^private:\/\/warehouse-proof\/([0-9a-f-]{36})\/([0-9a-f-]{36}\.(jpg|png|webp))$/i);
  if (!match) throw new Error("Unsupported local warehouse reference");
  return `${match[1]}/${match[2]}`;
}

export function createWarehouseMediaRolloutRepository(pool: Pool) {
  return {
    async inventory(): Promise<LegacyWarehouseMedia[]> {
      const result: LegacyWarehouseMedia[] = [];
      for (const table of ["warehouse_intake_images", "warehouse_private_proofs"] as const) {
        const [rows] = await pool.query<RowDataPacket[]>(`SELECT id,uploaded_by,storage_ref,format,byte_size,${table === "warehouse_intake_images" ? "intake_id" : "NULL AS intake_id"} FROM ?? WHERE storage_ref LIKE 'private://warehouse-proof/%' ORDER BY id`, [table]);
        for (const row of rows) {
          if (!["jpg", "png", "webp"].includes(row.format)) throw new Error("Unsupported warehouse image format");
          result.push({ table, id: row.id, ownerId: row.uploaded_by, storageRef: row.storage_ref, format: row.format, bytes: Number(row.byte_size), intakeId: row.intake_id });
        }
      }
      return result;
    },
    async replace(row: LegacyWarehouseMedia, newRef: string) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        // Draft cleanup locks the parent first; use the same order.
        if (row.intakeId) await connection.query("SELECT id FROM warehouse_intake_sessions WHERE id=? FOR UPDATE", [row.intakeId]);
        const [updated] = await connection.query<ResultSetHeader>("UPDATE ?? SET storage_ref=? WHERE id=? AND storage_ref=? AND uploaded_by=? AND format=? AND byte_size=?",
          [row.table, newRef, row.id, row.storageRef, row.ownerId, row.format, row.bytes]);
        await connection.commit();
        return updated.affectedRows === 1;
      } catch (error) {
        // A failed COMMIT may already have succeeded remotely. Preserve the asset.
        connection.destroy();
        throw error;
      } finally { connection.release(); }
    },
    async referenceInUse(reference: string) {
      const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM warehouse_intake_images WHERE storage_ref=? UNION ALL SELECT id FROM warehouse_private_proofs WHERE storage_ref=? LIMIT 1", [reference, reference]);
      return rows.length > 0;
    }
  };
}

export async function migrateWarehouseMedia(options: {
  rows: LegacyWarehouseMedia[];
  source: (row: LegacyWarehouseMedia) => Promise<Buffer>;
  storage: PrivateMediaStorage; independentStorage: PrivateMediaStorage;
  repository: Pick<ReturnType<typeof createWarehouseMediaRolloutRepository>, "replace" | "referenceInUse">;
  journal: (entry: MediaRolloutEntry) => Promise<void>;
  id?: () => string;
}) {
  const entries: MediaRolloutEntry[] = [];
  for (const row of options.rows) {
    legacyMediaPath(row.storageRef);
    if (!/^[0-9a-f-]{36}$/i.test(row.ownerId)) throw new Error("Invalid warehouse uploader");
    const bytes = await options.source(row);
    if (bytes.length !== row.bytes) throw new Error("Source image size changed");
    const entry: MediaRolloutEntry = { row, newRef: `cloudinary://warehouse-proof/${row.ownerId}/${(options.id ?? randomUUID)()}.${row.format}`, sourceSha256: digest(bytes), state: "PLANNED" };
    await options.journal({ ...entry });
    let uploaded = false;
    try {
      const saved = await options.storage.save(row.ownerId, entry.newRef.split("/").at(-1)!.split(".")[0], row.format, bytes);
      if (saved.secureUrl !== entry.newRef) throw new Error("Provider reference differs from planned reference");
      uploaded = true;
      const a = await options.storage.resolve(entry.newRef, row.format);
      const b = await options.independentStorage.resolve(entry.newRef, row.format);
      const expectedType = row.format === "jpg" ? "image/jpeg" : `image/${row.format}`;
      if (!a.body.length || a.contentType !== expectedType || b.contentType !== expectedType || !a.body.equals(b.body)) throw new Error("Independent provider delivery mismatch");
      entry.deliverySha256 = digest(a.body);
      entry.state = "VERIFIED";
      await options.journal({ ...entry });
    } catch {
      entry.state = "REVIEW_REQUIRED";
      entry.reason = uploaded ? "PROVIDER_VERIFICATION_FAILED" : "UPLOAD_OUTCOME_REQUIRES_REVIEW";
      await options.journal({ ...entry });
      entries.push(entry);
      break;
    }
    try {
      const replaced = await options.repository.replace(row, entry.newRef);
      entry.state = replaced ? "COMMITTED" : "CONFLICT";
      if (!replaced && !await options.repository.referenceInUse(entry.newRef)) await options.storage.remove(entry.newRef);
    } catch {
      entry.state = "REVIEW_REQUIRED";
      entry.reason = "DATABASE_OR_CLEANUP_OUTCOME_REQUIRES_REVIEW";
    }
    await options.journal({ ...entry });
    entries.push(entry);
    if (entry.state === "REVIEW_REQUIRED") break;
  }
  return entries;
}
