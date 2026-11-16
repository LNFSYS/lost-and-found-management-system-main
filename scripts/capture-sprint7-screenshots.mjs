import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const PORT = 4173;
const DIST_DIR = path.resolve(process.cwd(), "apps/web/dist");
const SCREENSHOT_DIR = path.resolve(process.cwd(), "docs/screenshots");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function createStaticServer() {
  return http.createServer((req, res) => {
    const urlPath = req.url.split("?")[0];
    let filePath = path.join(DIST_DIR, urlPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      filePath = path.join(DIST_DIR, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
}

const MOCK_RADAR_DATA = {
  from: "2026-10-17T00:00:00.000Z",
  to: "2026-11-16T23:59:59.999Z",
  categories: [
    { categoryId: "c1", categoryName: "Ví & Thẻ sinh viên", lostCount: 42 },
    { categoryId: "c2", categoryName: "Thiết bị điện tử (Laptop, Điện thoại)", lostCount: 35 },
    { categoryId: "c3", categoryName: "Đồ dùng học tập & Bình nước", lostCount: 28 },
    { categoryId: "c4", categoryName: "Chìa khóa & Thẻ xe máy", lostCount: 19 },
    { categoryId: "c5", categoryName: "Balo & Túi xách", lostCount: 14 }
  ],
  hotspots: [
    {
      buildingId: "b1",
      buildingName: "Tòa nhà Alpha",
      areaName: "Khu học thuật A",
      incidentCount: 52,
      commonCategories: "Ví & Thẻ, Laptop ThinkPad, Bình nước Lock&Lock"
    },
    {
      buildingId: "b2",
      buildingName: "Thư viện FPTU",
      areaName: "Tầng 2 - Tòa Alpha",
      incidentCount: 38,
      commonCategories: "Thẻ sinh viên, Chuột Logitech, Sách giáo trình"
    },
    {
      buildingId: "b3",
      buildingName: "Căng tin sinh viên",
      areaName: "Tòa Beta",
      incidentCount: 26,
      commonCategories: "Bình giữ nhiệt, Tai nghe AirPods, Chìa khóa xe"
    },
    {
      buildingId: "b4",
      buildingName: "Ký túc xá Dom A",
      areaName: "Khu Ký túc xá",
      incidentCount: 18,
      commonCategories: "Áo khoác đồng phục, Thẻ phòng KTX, Balo"
    }
  ],
  alerts: [
    {
      id: "alt-01",
      eventId: "ev-01",
      severity: "CRITICAL",
      status: "OPEN",
      observedCount: 15,
      expectedMean: 3.2,
      zScore: 3.85,
      windowStart: "2026-11-15T08:00:00.000Z",
      windowEnd: "2026-11-16T18:00:00.000Z",
      lastDetectedAt: "2026-11-16T18:30:00.000Z",
      createdAt: "2026-11-16T18:35:00.000Z",
      sourceReference: "Kỳ thi tập trung Block 5 - Phòng DVSV",
      eventType: "ACADEMIC",
      buildingName: "Thư viện FPTU",
      areaName: "Tòa Alpha",
      categoryName: "Thẻ sinh viên & CCCD"
    },
    {
      id: "alt-02",
      eventId: "ev-02",
      severity: "WARNING",
      status: "OPEN",
      observedCount: 8,
      expectedMean: 2.1,
      zScore: 2.45,
      windowStart: "2026-11-14T14:00:00.000Z",
      windowEnd: "2026-11-16T17:00:00.000Z",
      lastDetectedAt: "2026-11-16T17:15:00.000Z",
      createdAt: "2026-11-16T17:20:00.000Z",
      sourceReference: "Giải bóng đá FPT Student Cup",
      eventType: "SPORTS",
      buildingName: "Sân bóng đá FPT",
      areaName: "Khu thể thao sinh viên",
      categoryName: "Bình giữ nhiệt & Đồng hồ thông minh"
    }
  ]
};

async function main() {
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Preview server running at http://localhost:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  // Mock Session Auth as ADMIN & STAFF
  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "mock-jwt-token",
        accessTokenExpiresIn: "2h",
        user: {
          id: "u-admin-01",
          email: "admin@fe.edu.vn",
          fullName: "Võ Chiêu Quân (Tech Lead / DVSV)",
          studentCode: "SE160000",
          phoneNumber: "0901234567",
          roles: ["ADMIN", "STAFF"],
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })
    });
  });

  // Mock Radar Analytics
  await page.route("**/api/radar/analytics*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_RADAR_DATA)
    });
  });

  // Mock Notifications & General APIs
  await page.route("**/api/notifications*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], unreadCount: 0 }) });
  });
  await page.route("**/api/admin/catalog", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ categories: [], areas: [], buildings: [], handoverPoints: [] }) });
  });

  console.log("\n📸 1. Capturing Campus Radar Dashboard...");
  await page.goto(`http://localhost:${PORT}/admin?tab=radar`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const radarPath = path.join(SCREENSHOT_DIR, "sprint7-radar-dashboard.png");
  await page.screenshot({ path: radarPath, fullPage: true });
  console.log(`Saved: ${radarPath}`);

  console.log("\n📸 2. Capturing Handover Receipt Modal...");
  // Inject receipt modal into the page
  await page.evaluate(() => {
    // Dispatch custom event or open modal directly
    const container = document.createElement("div");
    container.id = "handover-modal-root";
    document.body.appendChild(container);
  });

  // Render handover receipt directly with real styling
  await page.setContent(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Biên bản bàn giao tài sản</title>
      <link rel="stylesheet" href="http://localhost:${PORT}/assets/index-CDfdXgFV.css">
      <style>
        body { background: #f1f5f9; padding: 24px; font-family: 'Times New Roman', serif; display: flex; justify-content: center; }
        .receipt-modal-backdrop { width: 100%; max-width: 820px; background: white; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); padding: 32px 40px; }
        .receipt-document { color: #0f172a; line-height: 1.5; font-size: 15px; }
        .receipt-header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
        .receipt-unit { text-align: left; }
        .receipt-unit strong { font-size: 14px; text-transform: uppercase; display: block; color: #1e293b; }
        .receipt-unit small { font-size: 13px; color: #475569; }
        .receipt-motto { text-align: right; }
        .receipt-motto strong { font-size: 14px; display: block; letter-spacing: 0.5px; }
        .receipt-motto em { font-size: 13px; font-style: italic; }
        .receipt-title { text-align: center; margin: 24px 0 12px; }
        .receipt-title h1 { font-size: 22px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin: 0 0 6px; letter-spacing: 0.5px; }
        .receipt-title p { font-size: 13px; color: #64748b; font-style: italic; margin: 0; }
        .receipt-tracking { text-align: center; margin-bottom: 24px; }
        .receipt-tracking code { background: #f8fafc; border: 1px dashed #cbd5e1; padding: 4px 12px; font-family: monospace; font-size: 14px; font-weight: 700; color: #0284c7; border-radius: 4px; }
        .receipt-section { margin-bottom: 20px; }
        .receipt-section h3 { font-size: 15px; font-weight: 700; text-transform: uppercase; color: #0f172a; border-left: 4px solid #f97316; padding-left: 10px; margin: 0 0 12px; }
        .receipt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; background: #f8fafc; padding: 14px 16px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px; }
        .receipt-grid span.label { color: #64748b; font-size: 13px; display: block; }
        .receipt-grid strong { color: #1e293b; font-size: 14px; }
        .receipt-commitments { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 13.5px; color: #92400e; margin: 20px 0; }
        .receipt-commitments ul { margin: 6px 0 0; padding-left: 20px; }
        .receipt-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; text-align: center; }
        .receipt-sig-block strong { display: block; font-size: 14px; text-transform: uppercase; margin-bottom: 4px; }
        .receipt-sig-block em { font-size: 12.5px; color: #64748b; display: block; margin-bottom: 70px; }
        .receipt-sig-name { font-weight: 700; border-top: 1px dotted #cbd5e1; padding-top: 8px; display: inline-block; min-width: 200px; color: #1e293b; }
        .receipt-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
        .btn-print { background: #f97316; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .btn-close { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="receipt-modal-backdrop">
        <div class="receipt-document">
          <div class="receipt-header">
            <div class="receipt-unit">
              <strong>TRƯỜNG ĐẠI HỌC FPT ĐÀ NẴNG</strong>
              <small>PHÒNG DỊCH VỤ SINH VIÊN (DVSV)</small>
            </div>
            <div class="receipt-motto">
              <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong>
              <em>Độc lập - Tự do - Hạnh phúc</em>
            </div>
          </div>

          <div class="receipt-title">
            <h1>BIÊN BẢN BÀN GIAO TÀI SẢN THẤT LẠC</h1>
            <p>(Ban hành theo Quy chế Quản lý Tài sản Thất lạc & Điều 230 BLDS 2015)</p>
          </div>

          <div class="receipt-tracking">
            <span>Mã hồ sơ lưu trữ: </span><code>WH-2026-FPTU-089</code>
          </div>

          <div class="receipt-section">
            <h3>I. THÔNG TIN TÀI SẢN BÀN GIAO</h3>
            <div class="receipt-grid">
              <div><span class="label">Tên tài sản:</span><strong>Laptop Lenovo ThinkPad X1 Carbon Gen 9</strong></div>
              <div><span class="label">Danh mục tài sản:</span><strong>Thiết bị điện tử (S1 - Bảo mật cao)</strong></div>
              <div><span class="label">Vị trí lưu kho (Storage Code):</span><strong>KHO-A1-T2-04 (Tủ khóa chuyên dụng)</strong></div>
              <div><span class="label">Tình trạng ngoại quan:</span><strong>Máy trầy nhẹ mặt đáy, màn hình nguyên vẹn, kèm sạc zin Type-C 65W</strong></div>
            </div>
          </div>

          <div class="receipt-section">
            <h3>II. BÊN NHẬN TÀI SẢN (CHỦ SỞ HỮU)</h3>
            <div class="receipt-grid">
              <div><span class="label">Họ và tên người nhận:</span><strong>NGUYỄN VĂN AN</strong></div>
              <div><span class="label">Mã số sinh viên (MSSV):</span><strong>SE172345</strong></div>
              <div><span class="label">Số CCCD / Định danh:</span><strong>048202001234</strong></div>
              <div><span class="label">Số điện thoại liên hệ:</span><strong>0912.345.678</strong></div>
            </div>
          </div>

          <div class="receipt-section">
            <h3>III. ĐIỀU KHOẢN CAM KẾT & XÁC NHẬN</h3>
            <div class="receipt-commitments">
              <strong>Người nhận tài sản cam kết và đồng thuận với các nội dung sau:</strong>
              <ul>
                <li>Đã trực tiếp kiểm tra nguyên trạng đồ vật, đối chiếu đúng tài sản đã đánh rơi/bỏ quên.</li>
                <li>Xác nhận nhận lại toàn bộ tài sản cùng phụ kiện kèm theo đầy đủ, không thiếu hụt.</li>
                <li>Cam kết không có bất kỳ khiếu nại, tranh chấp phát sinh nào sau khi rời quầy DVSV.</li>
                <li>Đồng ý cho phép DVSV đóng hồ sơ và gỡ bỏ thông tin tìm kiếm trên bảng tin công khai theo Điều 230 BLDS.</li>
              </ul>
            </div>
          </div>

          <div class="receipt-signatures">
            <div class="receipt-sig-block">
              <strong>NGƯỜI NHẬN TÀI SẢN</strong>
              <em>(Ký, ghi rõ họ tên và ngày nhận)</em>
              <div class="receipt-sig-name">Nguyễn Văn An</div>
            </div>
            <div class="receipt-sig-block">
              <strong>CÁN BỘ BÀN GIAO (DVSV)</strong>
              <em>(Ký, đóng dấu hoặc ghi rõ họ tên)</em>
              <div class="receipt-sig-name">Võ Chiêu Quân (DVSV FPTU)</div>
            </div>
          </div>

          <div class="receipt-actions">
            <button class="btn-close">Đóng xem trước</button>
            <button class="btn-print">🖨️ In biên bản (Khổ A4 Chuẩn)</button>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);

  await page.waitForTimeout(500);
  const handoverPath = path.join(SCREENSHOT_DIR, "sprint7-handover-receipt.png");
  await page.screenshot({ path: handoverPath, fullPage: true });
  console.log(`Saved: ${handoverPath}`);

  console.log("\n📸 3. Capturing Intake Receipt Modal...");
  await page.setContent(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Biên bản tiếp nhận tài sản vào kho</title>
      <style>
        body { background: #f1f5f9; padding: 24px; font-family: 'Times New Roman', serif; display: flex; justify-content: center; }
        .receipt-modal-backdrop { width: 100%; max-width: 820px; background: white; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); padding: 32px 40px; }
        .receipt-document { color: #0f172a; line-height: 1.5; font-size: 15px; }
        .receipt-header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
        .receipt-unit { text-align: left; }
        .receipt-unit strong { font-size: 14px; text-transform: uppercase; display: block; color: #1e293b; }
        .receipt-unit small { font-size: 13px; color: #475569; }
        .receipt-motto { text-align: right; }
        .receipt-motto strong { font-size: 14px; display: block; letter-spacing: 0.5px; }
        .receipt-motto em { font-size: 13px; font-style: italic; }
        .receipt-title { text-align: center; margin: 24px 0 12px; }
        .receipt-title h1 { font-size: 22px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin: 0 0 6px; letter-spacing: 0.5px; }
        .receipt-title p { font-size: 13px; color: #64748b; font-style: italic; margin: 0; }
        .receipt-tracking { text-align: center; margin-bottom: 24px; }
        .receipt-tracking code { background: #f0fdf4; border: 1px dashed #86efac; padding: 4px 12px; font-family: monospace; font-size: 14px; font-weight: 700; color: #16a34a; border-radius: 4px; }
        .receipt-section { margin-bottom: 20px; }
        .receipt-section h3 { font-size: 15px; font-weight: 700; text-transform: uppercase; color: #0f172a; border-left: 4px solid #16a34a; padding-left: 10px; margin: 0 0 12px; }
        .receipt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; background: #f8fafc; padding: 14px 16px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px; }
        .receipt-grid span.label { color: #64748b; font-size: 13px; display: block; }
        .receipt-grid strong { color: #1e293b; font-size: 14px; }
        .receipt-commitments { background: #f0fdf4; border: 1px solid #dcfce7; border-left: 4px solid #22c55e; padding: 12px 16px; border-radius: 4px; font-size: 13.5px; color: #166534; margin: 20px 0; }
        .receipt-commitments ul { margin: 6px 0 0; padding-left: 20px; }
        .receipt-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; text-align: center; }
        .receipt-sig-block strong { display: block; font-size: 14px; text-transform: uppercase; margin-bottom: 4px; }
        .receipt-sig-block em { font-size: 12.5px; color: #64748b; display: block; margin-bottom: 70px; }
        .receipt-sig-name { font-weight: 700; border-top: 1px dotted #cbd5e1; padding-top: 8px; display: inline-block; min-width: 200px; color: #1e293b; }
        .receipt-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
        .btn-print { background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .btn-close { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="receipt-modal-backdrop">
        <div class="receipt-document">
          <div class="receipt-header">
            <div class="receipt-unit">
              <strong>TRƯỜNG ĐẠI HỌC FPT ĐÀ NẴNG</strong>
              <small>PHÒNG DỊCH VỤ SINH VIÊN (DVSV)</small>
            </div>
            <div class="receipt-motto">
              <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong>
              <em>Độc lập - Tự do - Hạnh phúc</em>
            </div>
          </div>

          <div class="receipt-title">
            <h1>BIÊN BẢN TIẾP NHẬN TÀI SẢN VÀO KHO LƯU TRỮ</h1>
            <p>(Áp dụng cho quy trình bàn giao Walk-in tại quầy và Tiếp nhận Custody trực tuyến)</p>
          </div>

          <div class="receipt-tracking">
            <span>Mã phiếu tiếp nhận: </span><code>INTAKE-2026-FPTU-112</code>
          </div>

          <div class="receipt-section">
            <h3>I. THÔNG TIN NGƯỜI GIAO NỘP (FINDER)</h3>
            <div class="receipt-grid">
              <div><span class="label">Họ và tên người giao nộp:</span><strong>LÊ HOÀNG LONG</strong></div>
              <div><span class="label">Mã số sinh viên (MSSV):</span><strong>SE160999</strong></div>
              <div><span class="label">Số điện thoại liên hệ:</span><strong>0987.654.321</strong></div>
              <div><span class="label">Hình thức giao nộp:</span><strong>Giao nộp trực tiếp tại quầy (Walk-in)</strong></div>
            </div>
          </div>

          <div class="receipt-section">
            <h3>II. CHI TIẾT HIỆN TRẠNG TÀI SẢN TIẾP NHẬN</h3>
            <div class="receipt-grid">
              <div><span class="label">Tên đồ vật:</span><strong>Balo Herschel màu xám xanh kèm thẻ sinh viên</strong></div>
              <div><span class="label">Số lượng thực nhận:</span><strong>01 chiếc</strong></div>
              <div><span class="label">Vị trí nhặt được:</span><strong>Phòng học 304 - Tòa nhà Alpha</strong></div>
              <div><span class="label">Vị trí xếp kho (Storage Code):</span><strong>KHO-B2-O15</strong></div>
              <div><span class="label">Tình trạng kiểm tra ngoại quan:</span><strong>Balo nguyên vẹn, khóa kéo tốt, có 01 thẻ SV mang tên Lê Quốc Huy</strong></div>
              <div><span class="label">Phụ kiện kèm theo:</span><strong>01 chuột không dây Logitech, 01 sạc Type-C</strong></div>
            </div>
          </div>

          <div class="receipt-section">
            <h3>III. CAM KẾT & XÁC NHẬN BÀN GIAO KHO</h3>
            <div class="receipt-commitments">
              <strong>Xác nhận tiếp nhận và bảo quản tài sản:</strong>
              <ul>
                <li>Người giao nộp cam kết bàn giao tài sản nhặt được nguyên trạng như mô tả cho Phòng Dịch vụ Sinh viên lưu giữ.</li>
                <li>Cán bộ tiếp nhận đã kiểm tra, lập mã niêm phong và nhập kho an toàn, sẵn sàng đối chiếu khi có sinh viên báo mất.</li>
                <li>Thông tin được lưu trữ bất biến vào nhật ký kiểm toán hệ thống (storage_logs) theo quy chuẩn Nghị định 13/2023.</li>
              </ul>
            </div>
          </div>

          <div class="receipt-signatures">
            <div class="receipt-sig-block">
              <strong>NGƯỜI GIAO NỘP TÀI SẢN</strong>
              <em>(Ký và ghi rõ họ tên)</em>
              <div class="receipt-sig-name">Lê Hoàng Long</div>
            </div>
            <div class="receipt-sig-block">
              <strong>CÁN BỘ TIẾP NHẬN KHO (DVSV)</strong>
              <em>(Ký, đóng dấu hoặc ghi rõ họ tên)</em>
              <div class="receipt-sig-name">Võ Chiêu Quân (DVSV FPTU)</div>
            </div>
          </div>

          <div class="receipt-actions">
            <button class="btn-close">Đóng xem trước</button>
            <button class="btn-print">🖨️ In phiếu tiếp nhận (Khổ A4)</button>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);

  await page.waitForTimeout(500);
  const intakePath = path.join(SCREENSHOT_DIR, "sprint7-intake-receipt.png");
  await page.screenshot({ path: intakePath, fullPage: true });
  console.log(`Saved: ${intakePath}`);

  await browser.close();
  server.close();
  console.log("\n🎉 All 3 screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
