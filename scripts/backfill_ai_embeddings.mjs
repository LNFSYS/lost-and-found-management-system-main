import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Nạp file cấu hình môi trường chuẩn từ apps/api-node/.env và .env
dotenv.config({ path: path.resolve(repositoryRoot, "apps/api-node/.env"), override: true });
dotenv.config({ path: path.resolve(process.cwd(), "apps/api-node/.env"), override: true });
dotenv.config({ path: path.resolve(repositoryRoot, ".env"), override: false });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

const dbHost = process.env.DB_HOST || "localhost";
const dbPort = Number(process.env.DB_PORT) || 3306;
const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD || "";
const dbName = process.env.DB_NAME || "lnfs_auth";
const AI_URL = process.env.LNFS_AI_SERVICE_URL || "http://127.0.0.1:5000";

async function main() {
  console.log("=== DONG BO VECTOR DINOV2 VA AI TAGS CHO TAT CA BAI VIET ===");
  console.log(`AI Microservice: ${AI_URL}`);
  console.log(`Database target: ${dbUser}@${dbHost}:${dbPort}/${dbName}`);

  const pool = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 5
  });

  try {
    const [posts] = await pool.execute(`
      SELECT p.id, p.title, p.type, MIN(pm.secure_url) AS secure_url
      FROM posts p
      INNER JOIN post_media pm ON pm.post_id = p.id AND pm.media_kind = 'ITEM'
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, p.title, p.type, p.created_at
      ORDER BY p.created_at DESC
    `);

    console.log(`\nTim thay ${posts.length} bai viet co anh can dong bo vector.`);

    for (const post of posts) {
      if (!post.secure_url) continue;
      console.log(`\nDang xu ly bai [${post.id.slice(0, 8)}]: "${post.title}"...`);

      try {
        const imgRes = await fetch(post.secure_url);
        if (!imgRes.ok) {
          console.warn(`  [WARN] Khong the tai anh tu Cloudinary: HTTP ${imgRes.status}`);
          continue;
        }
        const imgBuffer = await imgRes.arrayBuffer();
        const blob = new Blob([imgBuffer], { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("file", blob, "image.jpg");

        const res = await fetch(`${AI_URL}/api/extract-features`, {
          method: "POST",
          body: formData
        });

        if (!res.ok) {
          console.warn(`  [WARN] AI service tra ve ma HTTP ${res.status}`);
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
        console.log(`  -> Da cap nhat thuoc tinh: mau="${data.color}", tinh trang="${data.condition}", OCR=[${data.visibleText?.join(", ") || "khong co"}]`);
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
