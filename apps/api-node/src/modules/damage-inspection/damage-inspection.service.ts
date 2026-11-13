import * as ort from "onnxruntime-node";
import Jimp from "jimp";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DefectItem {
  class: string;
  labelVn: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface DamageAnalysisResult {
  conditionScore: number;
  grade: string;
  statusText: string;
  damagePercentage: number;
  totalDefects: number;
  defectCounts: Record<string, number>;
  defectDetails: DefectItem[];
  annotatedImage: string;
}

const CLASS_NAMES = [
  "Loose weave", // 0
  "NG",          // 1
  "Normal",      // 2
  "OK",          // 3
  "Slub",        // 4
  "Stain",       // 5
  "crack",       // 6
  "fade",        // 7
  "hole",        // 8
  "lines",       // 9
  "pilling",     // 10
  "scratch",     // 11
  "spot",        // 12
  "undefined"    // 13
];

const VIETNAMESE_NAMES: Record<string, string> = {
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

const CLASS_WEIGHTS: Record<string, number> = {
  scratch: 1.0,
  lines: 1.0,
  spot: 1.2,
  Stain: 1.5,
  fade: 1.5,
  pilling: 1.5,
  Slub: 1.5,
  "Loose weave": 2.0,
  NG: 2.0,
  hole: 3.0,
  crack: 4.0,
  undefined: 1.5
};

export class DamageInspectionService {
  private session: ort.InferenceSession | null = null;
  private modelPath: string | null = null;

  private getPossiblePaths(): string[] {
    return [
      path.resolve(__dirname, "../../../../models/best.onnx"),
      path.resolve(__dirname, "../../../models/best.onnx"),
      path.resolve("models/best.onnx"),
      path.resolve("apps/api-node/models/best.onnx")
    ];
  }

  public async initModel(): Promise<boolean> {
    if (this.session) return true;

    for (const candidate of this.getPossiblePaths()) {
      if (fs.existsSync(candidate)) {
        try {
          console.info(`[DamageInspection] Loading ONNX model from: ${candidate}`);
          this.session = await ort.InferenceSession.create(candidate);
          this.modelPath = candidate;
          console.info("[DamageInspection] ✅ Model loaded successfully via ONNX Runtime Node.js!");
          return true;
        } catch (e: any) {
          console.error(`[DamageInspection] Failed to load ${candidate}:`, e.message);
        }
      }
    }
    console.warn("[DamageInspection] ⚠️ best.onnx not found in standard paths.");
    return false;
  }

  private calculateIoU(box1: [number, number, number, number], box2: [number, number, number, number]): number {
    const [x1_1, y1_1, x2_1, y2_1] = box1;
    const [x1_2, y1_2, x2_2, y2_2] = box2;

    const xi1 = Math.max(x1_1, x1_2);
    const yi1 = Math.max(y1_1, y1_2);
    const xi2 = Math.min(x2_1, x2_2);
    const yi2 = Math.min(y2_1, y2_2);

    const interArea = Math.max(0, xi2 - xi1) * Math.max(0, yi2 - yi1);
    const box1Area = (x2_1 - x1_1) * (y2_1 - y1_1);
    const box2Area = (x2_2 - x1_2) * (y2_2 - y1_2);
    const unionArea = box1Area + box2Area - interArea;

    return unionArea === 0 ? 0 : interArea / unionArea;
  }

  private nms(
    boxes: Array<{ bbox: [number, number, number, number]; confidence: number; cls_id: number; class_name: string }>,
    iouThreshold = 0.45
  ) {
    boxes.sort((a, b) => b.confidence - a.confidence);
    const selected = [];

    while (boxes.length > 0) {
      const current = boxes.shift()!;
      selected.push(current);
      boxes = boxes.filter((box) => {
        if (box.cls_id !== current.cls_id) return true;
        return this.calculateIoU(box.bbox, current.bbox) < iouThreshold;
      });
    }
    return selected;
  }

  public async analyze(imageBuffer: Buffer): Promise<DamageAnalysisResult> {
    const isReady = await this.initModel();
    if (!isReady || !this.session) {
      throw new Error(
        "Mô hình quét khuyết tật (best.onnx) chưa sẵn sàng! Vui lòng đặt file best.onnx vào thư mục models/ hoặc E:\\semester_9\\AI\\backend\\."
      );
    }

    // 1. Read & preprocess image (supports JPEG, PNG, WEBP)
    let originalImage: Jimp;
    try {
      const isWebP =
        imageBuffer.length > 12 &&
        imageBuffer.toString("ascii", 0, 4) === "RIFF" &&
        imageBuffer.toString("ascii", 8, 12) === "WEBP";

      if (isWebP) {
        const pngBuffer = await sharp(imageBuffer).png().toBuffer();
        originalImage = await Jimp.read(pngBuffer);
      } else {
        originalImage = await Jimp.read(imageBuffer);
      }
    } catch {
      try {
        const pngBuffer = await sharp(imageBuffer).png().toBuffer();
        originalImage = await Jimp.read(pngBuffer);
      } catch (err: any) {
        throw new Error(
          "Định dạng ảnh không được hỗ trợ. Vui lòng sử dụng file ảnh JPEG, PNG hoặc WEBP."
        );
      }
    }
    const origW = originalImage.bitmap.width;
    const origH = originalImage.bitmap.height;

    const resizedImage = originalImage.clone().resize(640, 640);
    const float32Data = new Float32Array(3 * 640 * 640);

    for (let y = 0; y < 640; y++) {
      for (let x = 0; x < 640; x++) {
        const pixelColor = resizedImage.getPixelColor(x, y);
        const rgba = Jimp.intToRGBA(pixelColor);
        float32Data[0 * 640 * 640 + y * 640 + x] = rgba.r / 255.0;
        float32Data[1 * 640 * 640 + y * 640 + x] = rgba.g / 255.0;
        float32Data[2 * 640 * 640 + y * 640 + x] = rgba.b / 255.0;
      }
    }

    // 2. Run ONNX Session
    const tensor = new ort.Tensor("float32", float32Data, [1, 3, 640, 640]);
    const feeds: Record<string, ort.Tensor> = {};
    const inputName = this.session.inputNames[0];
    feeds[inputName] = tensor;

    const outputResults = await this.session.run(feeds);
    const outputName = this.session.outputNames[0];
    const outputTensor = outputResults[outputName];
    const data = outputTensor.data as Float32Array;

    const numClasses = CLASS_NAMES.length;
    const numAnchors = 8400;

    const candidateBoxes = [];

    // 3. Extract candidate boxes
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
        const cx = data[0 * numAnchors + col];
        const cy = data[1 * numAnchors + col];
        const w = data[2 * numAnchors + col];
        const h = data[3 * numAnchors + col];

        const scaleX = origW / 640;
        const scaleY = origH / 640;

        const x1 = Math.max(0, Math.round((cx - w / 2) * scaleX));
        const y1 = Math.max(0, Math.round((cy - h / 2) * scaleY));
        const x2 = Math.min(origW, Math.round((cx + w / 2) * scaleX));
        const y2 = Math.min(origH, Math.round((cy + h / 2) * scaleY));

        candidateBoxes.push({
          bbox: [x1, y1, x2, y2] as [number, number, number, number],
          confidence: maxScore,
          cls_id: maxClassId,
          class_name: className
        });
      }
    }

    // 4. Apply NMS
    const finalDetections = this.nms(candidateBoxes, 0.45);
    console.info(`[DamageInspection] Image (${origW}x${origH}) -> Raw candidates: ${candidateBoxes.length}, Detected after NMS: ${finalDetections.length}`);

    // 5. Draw bounding boxes onto annotated image
    const annotatedImage = originalImage.clone();
    const RED_COLOR = Jimp.rgbaToInt(239, 68, 68, 255);
    const GREEN_COLOR = Jimp.rgbaToInt(16, 185, 129, 255);

    finalDetections.forEach((det) => {
      const [x1, y1, x2, y2] = det.bbox;
      const boxColor = det.class_name === "crack" ? RED_COLOR : GREEN_COLOR;

      for (let t = 0; t < 3; t++) {
        for (let x = x1; x <= x2; x++) {
          annotatedImage.setPixelColor(boxColor, x, Math.min(origH - 1, y1 + t));
          annotatedImage.setPixelColor(boxColor, x, Math.max(0, y2 - t));
        }
        for (let y = y1; y <= y2; y++) {
          annotatedImage.setPixelColor(boxColor, Math.min(origW - 1, x1 + t), y);
          annotatedImage.setPixelColor(boxColor, Math.max(0, x2 - t), y);
        }
      }
    });

    const base64Annotated = await annotatedImage.getBase64Async(Jimp.MIME_JPEG);

    // 6. Calculate Damage Score & Severity
    const numDefects = finalDetections.length;
    let rawDamagePixels = 0;
    let weightedDamagePixels = 0;
    const defectCounts: Record<string, number> = {};
    const defectDetails: DefectItem[] = [];

    const totalSurfacePixels = Math.max(1, origW * origH);

    finalDetections.forEach((det) => {
      const [x1, y1, x2, y2] = det.bbox;
      const area = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const weight = CLASS_WEIGHTS[det.class_name] || 1.0;
      rawDamagePixels += area;
      weightedDamagePixels += area * weight;

      const vnName = VIETNAMESE_NAMES[det.class_name] || det.class_name;
      defectCounts[vnName] = (defectCounts[vnName] || 0) + 1;

      defectDetails.push({
        class: det.class_name,
        labelVn: vnName,
        confidence: Math.round(det.confidence * 1000) / 10,
        bbox: det.bbox
      });
    });

    let conditionScore = 100;
    let grade = "Mới 99% - Like New";
    let statusText = "Vật phẩm ở trạng thái hoàn hảo, không phát hiện vết xước hay hư hỏng nào.";
    let damagePercentage = 0.0;

    if (numDefects > 0) {
      // Physical surface damage percentage is bounded to [0.01%, 100.0%]
      const rawRatio = Math.min(1.0, rawDamagePixels / totalSurfacePixels);
      damagePercentage = Math.round(rawRatio * 10000) / 100;

      // Score penalty combines raw area, weighted severity and defect count
      const penalty = Math.min(100, Math.round(damagePercentage * 1.5 + (weightedDamagePixels / totalSurfacePixels) * 15 + numDefects * 4.0));
      conditionScore = Math.max(0, 100 - penalty);

      if (conditionScore >= 90) {
        grade = "Tốt - Trầy xước dăm nhẹ";
        statusText = "Vật phẩm còn rất mới, chỉ có vài vết xước nhỏ không đáng kể.";
      } else if (conditionScore >= 75) {
        grade = "Khá - Có vết trầy xước thấy rõ";
        statusText = "Vật phẩm có dấu hiệu sử dụng, xuất hiện vết xước hoặc móp nhẹ.";
      } else if (conditionScore >= 50) {
        grade = "Trung bình - Trầy xước nhiều hoặc móp";
        statusText = "Vật phẩm đã qua sử dụng nhiều, có khuyết tật bề mặt rõ rệt.";
      } else {
        grade = "Hỏng nặng - Nứt vỡ / Biến dạng";
        statusText = "Vật phẩm bị hư hại nặng nề, có vết nứt vỡ hoặc biến dạng lớn.";
      }
    }

    return {
      conditionScore,
      grade,
      statusText,
      damagePercentage,
      totalDefects: numDefects,
      defectCounts,
      defectDetails,
      annotatedImage: base64Annotated
    };
  }
}

export const damageInspectionService = new DamageInspectionService();

