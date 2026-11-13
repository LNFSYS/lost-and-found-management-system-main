import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const envPath of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(repositoryRoot, ".env"),
  path.resolve(repositoryRoot, "apps/api-node/.env")
]) {
  dotenv.config({ path: envPath, override: false });
}

const AI_URL = process.env.LNFS_AI_SERVICE_URL || "http://127.0.0.1:5000";

async function main() {
  console.log("=== DONG BO VECTOR DINOV2 VA AI TAGS CHO TAT CA BAI VIET ===");
  console.log(`Connecting to AI service at: ${AI_URL}`);

  const pool = mysql.createPool({
    host: process.env.LNFS_DB_HOST || "127.0.0.1",
    port: Number(process.env.LNFS_DB_PORT || 3306),
    user: process.env.LNFS_DB_USER || "root",
    password: process.env.LNFS_DB_PASSWORD || "",
    database: process.env.LNFS_DB_NAME || "lnfs_db",
    waitForConnections: true,
    connectionLimit: 5
  });

  try {
    const [posts] = await pool.execute(`
      SELECT p.id, p.title, p.type, pm.secure_url
      FROM posts p
      INNER JOIN post_media pm ON pm.post_id = p.id AND pm.media_kind = 'ITEM'
      WHERE p.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    console.log(`Tim thay ${posts.length} bai viet co anh tren he thong.`);

    for (const post of posts) {
      if (!post.secure_url) continue;
      console.log(`\nDang xu ly bai [${post.id.slice(0, 8)}]: "${post.title}" (${post.secure_url})...`);

      try {
        const formData = new FormData();
        formData.append("image_url", post.secure_url);

        const res = await fetch(`${AI_URL}/api/extract-features`, {
          method: "POST",
          body: formData
        });

        if (!res.ok) {
          console.warn(`  [WARN] Khong the trich xuat cho bai ${post.id}: HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();
        if (data.embedding && data.embedding.length > 0) {
          await pool.execute(
            "UPDATE posts SET image_embedding = ? WHERE id = ?",
            [JSON.stringify(data.embedding), post.id]
          );
          console.log(`  -> Da luu vector DINOv2 (${data.embedding.length} chieu).`);
        }

        await pool.execute("DELETE FROM ai_tags WHERE post_id = ? AND source IN ('VISION_LABEL', 'VISION_OBJECT', 'OCR')", [post.id]);
        if (data.visualAttributes) {
          for (const attr of data.visualAttributes) {
            await pool.execute(
              "INSERT INTO ai_tags (id, post_id, tag, confidence, source) VALUES (?, ?, ?, ?, 'VISION_OBJECT')",
              [crypto.randomUUID(), post.id, String(attr).slice(0, 100), 0.85]
            );
          }
        }
        if (data.visibleText) {
          for (const word of data.visibleText) {
            await pool.execute(
              "INSERT INTO ai_tags (id, post_id, tag, confidence, source) VALUES (?, ?, ?, ?, 'OCR')",
              [crypto.randomUUID(), post.id, String(word).slice(0, 100), 0.85]
            );
          }
        }
        console.log(`  -> Da cap nhat thuoc tinh AI: mau="${data.color}", tinh trang="${data.condition}", OCR=[${data.visibleText?.join(", ") || "none"}].`);
      } catch (err) {
        console.error(`  [ERROR] Loi khi xu ly bai ${post.id}:`, err.message);
      }
    }

    console.log("\n=== HOAN TAT DONG BO VECTOR VA TAGS CHO TAT CA BAI VIET ===");
    console.log("Ban co the tai lai trang hoac bam 'Tinh lai matching' de xem ket qua 60/40.");
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
