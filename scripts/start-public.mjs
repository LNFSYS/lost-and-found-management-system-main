import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import fs from "node:fs";

const rootDir = process.cwd();
const cloudflaredPath = path.resolve(rootDir, "scripts", "bin", "cloudflared.exe");

console.log("\n=================================================================");
console.log("🚀 Đang khởi động FPTU Lost & Found...");
console.log("   - Backend Node.js API (Cổng 3001)");
console.log("   - Frontend Vite Web (Cổng 5173)");
console.log("   - Custom Domain Tunnel: fptu-lostandfound");
console.log("=================================================================\n");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const processes = [];

// 1. Chạy API & WEB
const devProcess = spawn(npmCmd, ["run", "dev"], {
  cwd: rootDir,
  shell: true,
  stdio: "inherit",
});
processes.push(devProcess);

let customUrlFound = false;
let cloudflareUrl = "";

function printBanner(customUrl, cfUrl) {
  console.log("\n╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                                                                            ║");
  console.log("║  🎉 HỆ THỐNG ĐÃ ONLINE! BẠN CÓ THỂ TRUY CẬP VỚI TÊN ĐƯỜNG DẪN CỐ ĐỊNH:    ║");
  console.log("║                                                                            ║");
  if (customUrl) {
    console.log(`║  👉 LINK CHÍNH: \x1b[32m\x1b[1m${customUrl.padEnd(57)}\x1b[0m ║`);
  }
  if (cfUrl) {
    console.log(`║  👉 LINK PHỤ (Cloudflare): \x1b[36m${cfUrl.padEnd(46)}\x1b[0m ║`);
  }
  console.log("║                                                                            ║");
  console.log("║  (Mở link trên bằng điện thoại 4G/5G hoặc máy khác để truy cập)            ║");
  console.log("║  Nhấn Ctrl + C để dừng server.                                             ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");
}

function startTunnels() {
  // 1. Chạy LocalTunnel với subdomain fptu-lost-found
  const ltProc = spawn(npxCmd, ["-y", "localtunnel", "--port", "5173", "--subdomain", "fptu-lost-found"], {
    cwd: rootDir,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  processes.push(ltProc);

  function handleLtOutput(chunk) {
    const text = chunk.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.loca\.lt/i);
    if (match && !customUrlFound) {
      customUrlFound = true;
      printBanner(match[0], cloudflareUrl);
    }
  }
  ltProc.stdout.on("data", handleLtOutput);
  ltProc.stderr.on("data", handleLtOutput);

  // 2. Chạy kèm Cloudflare Tunnel để dự phòng
  if (fs.existsSync(cloudflaredPath)) {
    const cfProc = spawn(cloudflaredPath, ["tunnel", "--url", "http://localhost:5173"], {
      cwd: rootDir,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    processes.push(cfProc);

    function handleCfOutput(chunk) {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match && !cloudflareUrl) {
        cloudflareUrl = match[0];
        if (customUrlFound) {
          printBanner("https://fptu-lostandfound.loca.lt", cloudflareUrl);
        }
      }
    }
    cfProc.stdout.on("data", handleCfOutput);
    cfProc.stderr.on("data", handleCfOutput);
  }
}

// Chờ 3 giây để Web & API sẵn sàng rồi bật tunnel
setTimeout(startTunnels, 3000);

function cleanup() {
  console.log("\n[INFO] Đang dừng toàn bộ server và tunnel...");
  for (const p of processes) {
    try {
      if (process.platform === "win32" && p.pid) {
        spawn("taskkill", ["/pid", p.pid.toString(), "/f", "/t"]);
      } else {
        p.kill();
      }
    } catch {}
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
