import * as ort from "onnxruntime-node";
import Jimp from "jimp";
import fs from "node:fs";
import path from "node:path";

const CLASS_NAMES = [
  "Loose weave", "NG", "Normal", "OK", "Slub", "Stain", 
  "crack", "fade", "hole", "lines", "pilling", "scratch", "spot", "undefined"
];

const VIETNAMESE_NAMES = {
  scratch: "Vết trầy xước",
  crack: "Vết nứt / Vỡ kính",
  hole: "Lỗ thủng / Vết rách",
  lines: "Vết xước dạng sọc",
  spot: "Đốm ố / Vết tróc",
  Stain: "Vết ố bẩn",
  fade: "Bạc màu / Bay màu",
  pilling: "Xù lông / Sờn vải",
  Slub: "Sờn chỉ / Gút sợi",
  "Loose weave": "Vải thưa / Lỏng dệt",
  NG: "Lỗi bề mặt",
  undefined: "Khuyết tật khác",
  OK: "Bình thường",
  Normal: "Bình thường"
};

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.log("Vui long truyen duong dan anh can test:");
    console.log("Vi du: node scripts/test-damage.mjs duong_dan_anh.jpg");
    return;
  }

  console.log("=================================================");
  console.log("   KIEM TRA TUNG BUOC MO HINH ONNX (STEP-BY-STEP)");
  console.log("=================================================");

  // BƯỚC 1: ĐỌC ẢNH
  console.log("\n[BUOC 1] Doc file anh...");
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Khong tim thay file anh tai: ${imagePath}`);
    return;
  }
  const img = await Jimp.read(imagePath);
  const origW = img.bitmap.width;
  const origH = img.bitmap.height;
  console.log(`✅ Anh hop le! Kich thuoc goc: ${origW} x ${origH} pixels`);

  // BƯỚC 2: NẠP MODEL
  console.log("\n[BUOC 2] Nap mo hinh ONNX...");
  const modelPath = path.resolve("apps/api-node/models/best.onnx");
  if (!fs.existsSync(modelPath)) {
    console.error(`❌ Khong tim thay file best.onnx tai: ${modelPath}`);
    return;
  }
  const session = await ort.InferenceSession.create(modelPath);
  console.log(`✅ Mo hinh da san sang! (Tong so classes: ${CLASS_NAMES.length})`);

  // BƯỚC 3: TIỀN XỬ LÝ (RESIZE & NORMALIZE)
  console.log("\n[BUOC 3] Resize anh ve 640x640 va chuan hoa Tensor...");
  const resized = img.clone().resize(640, 640);
  const float32Data = new Float32Array(3 * 640 * 640);
  for (let y = 0; y < 640; y++) {
    for (let x = 0; x < 640; x++) {
      const pixelColor = resized.getPixelColor(x, y);
      const rgba = Jimp.intToRGBA(pixelColor);
      float32Data[0 * 640 * 640 + y * 640 + x] = rgba.r / 255.0;
      float32Data[1 * 640 * 640 + y * 640 + x] = rgba.g / 255.0;
      float32Data[2 * 640 * 640 + y * 640 + x] = rgba.b / 255.0;
    }
  }
  const tensor = new ort.Tensor("float32", float32Data, [1, 3, 640, 640]);
  console.log(`✅ Tensor tao thanh cong voi kich thuoc: [1, 3, 640, 640]`);

  // BƯỚC 4: CHẠY SUY LUẬN (INFERENCE)
  console.log("\n[BUOC 4] Chay mo hinh YOLO...");
  const startTime = Date.now();
  const out = await session.run({ images: tensor });
  const latency = Date.now() - startTime;
  console.log(`✅ Suy luan hoan tat trong ${latency} ms!`);

  // BƯỚC 5: TRÍCH XUẤT CÁC VẾT LỖI
  console.log("\n[BUOC 5] Quet 8.400 vi tri toa do de tim khuyet tat...");
  const data = out.output0.data;
  const numAnchors = 8400;
  const numClasses = CLASS_NAMES.length;

  const rawDetections = [];
  for (let col = 0; col < numAnchors; col++) {
    let maxScore = -1;
    let maxClassId = -1;
    for (let c = 0; c < numClasses; c++) {
      const score = data[(4 + c) * numAnchors + col];
      if (score > maxScore) {
        maxScore = score;
        maxClassId = c;
      }
    }
    const className = CLASS_NAMES[maxClassId];
    if (maxScore > 0.25 && className !== "OK" && className !== "Normal") {
      rawDetections.push({
        class: className,
        labelVn: VIETNAMESE_NAMES[className] || className,
        confidence: Math.round(maxScore * 1000) / 10,
        col
      });
    }
  }

  console.log(`🔍 So luong vet loi thoa man nguong (conf > 25%): ${rawDetections.length} vi tri`);

  if (rawDetections.length === 0) {
    console.log("ℹ️ Khong tim thay vet loi nao -> Xep hang: Grade A+ (Like New)");
  } else {
    console.log("\nDanh sach cac loi phat hien tieu bieu:");
    rawDetections.slice(0, 8).forEach((d, idx) => {
      console.log(`   ${idx + 1}. [${d.labelVn}] - Do tin cay: ${d.confidence}%`);
    });

    const penalty = rawDetections.length * 4;
    const score = Math.max(0, 100 - penalty);
    console.log("\n=================================================");
    console.log(`⭐ DIEM TINH TRANG: ${score} / 100 diem`);
    console.log(`🏷️ XEP HANG:       ${score >= 90 ? "Grade A" : score >= 75 ? "Grade B" : score >= 50 ? "Grade C" : "Grade D"}`);
    console.log("=================================================");
  }
}

main().catch(console.error);

