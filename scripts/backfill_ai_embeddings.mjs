import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import fs from "node:fs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { v2 as cloudinary } from "cloudinary";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Nạp cấu hình môi trường từ apps/api-node/.env và .env
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

// Cấu hình Cloudinary nếu có
const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() || null;
const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || null;
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || null;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
}

async function resolveImageBuffer(post) {
  const { secure_url, public_id, id: postId, media_id, format } = post;
  if (!secure_url) return null;

  // 1. Thử lấy từ Cloudinary signed delivery URL nếu là cloudinary://
  if (secure_url.startsWith("cloudinary://post-media/")) {
    const rawRef = secure_url.slice("cloudinary://post-media/".length);
    const parts = rawRef.split("/");
    if (parts.length === 2 && cloudName && apiKey && apiSecret) {
      const [ownerId, filename] = parts;
      const dotIndex = filename.lastIndexOf(".");
      const name = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename;
      const ext = format || (dotIndex !== -1 ? filename.slice(dotIndex + 1) : "jpg");
      const pubId = public_id && public_id.startsWith("lnfs/") ? public_id : `lnfs/post-media/${ownerId}/${name}`;

      try {
        const signedUrl = cloudinary.url(pubId, {
          secure: true,
          sign_url: true,
          type: "authenticated",
          resource_type: "image",
          format: ext
        });
        const res = await fetch(signedUrl, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          return Buffer.from(await res.arrayBuffer());
        }
      } catch (err) {
        // Fallback sang phương thức khác
      }
    }
  }

  // 2. Thử đọc từ local upload folder (nếu chạy local hoặc VPS có uploads)
  const uploadDir = process.env.UPLOAD_DIR
    ? path.resolve(repositoryRoot, process.env.UPLOAD_DIR)
    : path.resolve(repositoryRoot, "apps/api-node/uploads");

  const cleanedRef = secure_url.replace(/^cloudinary:\/\/post-media\//, "").replace(/^private:\/\/post-media\//, "");
  const candidates = [
    path.resolve(uploadDir, "post-media", cleanedRef),
    path.resolve(uploadDir, cleanedRef),
    path.resolve(uploadDir, "post-media", postId, `${media_id}.${format || "jpg"}`),
    path.resolve(uploadDir, "post-media", postId, `${media_id}.png`),
    path.resolve(repositoryRoot, "apps/api-node/uploads/post-media", cleanedRef),
    path.resolve(repositoryRoot, secure_url)
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p);
      } catch {}
    }
  }

  // 3. Thử tải qua API node nội bộ (cổng 3001) nếu lnfs-api đang chạy
  if (postId && media_id) {
    try {
      const apiRes = await fetch(`http://127.0.0.1:3001/api/posts/${postId}/media/${media_id}`, {
        signal: AbortSignal.timeout(10000)
      });
      if (apiRes.ok) {
        return Buffer.from(await apiRes.arrayBuffer());
      }
    } catch {}
  }

  // 4. Nếu là HTTP/HTTPS URL trực tiếp
  if (secure_url.startsWith("http://") || secure_url.startsWith("https://")) {
    try {
      const res = await fetch(secure_url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    } catch {}
  }

  return null;
}

async function main() {
  console.log("=== DONG BO VECTOR DINOV2 VA AI TAGS CHO TAT CA BAI VIET ===");
  console.log(`AI Microservice: ${AI_URL}`);
  console.log(`Database target: ${dbUser}@${dbHost}:${dbPort}/${dbName}`);
  console.log(`Cloudinary configured: ${Boolean(cloudName && apiKey && apiSecret)} (cloud: ${cloudName || "none"})`);

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
      SELECT p.id, p.title, p.type,
             MIN(pm.id) AS media_id,
             MIN(pm.secure_url) AS secure_url,
             MIN(pm.public_id) AS public_id,
             MIN(pm.format) AS format
      FROM posts p
      INNER JOIN post_media pm ON pm.post_id = p.id AND pm.media_kind = 'ITEM'
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, p.title, p.type, p.created_at
      ORDER BY p.created_at DESC
    `);

    console.log(`\nTim thay ${posts.length} bai viet co anh can dong bo vector.`);

    let successCount = 0;
    let skipCount = 0;

    for (const post of posts) {
      if (!post.secure_url) {
        skipCount++;
        continue;
      }
      console.log(`\nDang xu ly bai [${post.id.slice(0, 8)}]: "${post.title}"...`);

      try {
        const imgBuffer = await resolveImageBuffer(post);
        if (!imgBuffer || imgBuffer.length === 0) {
          console.warn(`  [WARN] Khong the tai anh (secure_url: ${post.secure_url})`);
          skipCount++;
          continue;
        }

        const blob = new Blob([imgBuffer], { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("file", blob, "image.jpg");

        const res = await fetch(`${AI_URL}/api/extract-features`, {
          method: "POST",
          body: formData,
          signal: AbortSignal.timeout(60000)
        });

        if (!res.ok) {
          console.warn(`  [WARN] AI service tra ve ma HTTP ${res.status}`);
          skipCount++;
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
        successCount++;
      } catch (err) {
        console.error(`  [ERROR] Loi khi xu ly bai ${post.id}:`, err.message);
        skipCount++;
      }
    }

    console.log(`\n=== HOAN TAT DONG BO: ${successCount} thanh cong, ${skipCount} bo qua / loi ===`);
    console.log("Vui long chay 'npm run build' va tai lai trang web (Ctrl + F5) de xem giao dien 60/40 moi!");
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
