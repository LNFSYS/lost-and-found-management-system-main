import * as ort from "onnxruntime-node";
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

    // 1. Decode and resize with Sharp. It supports JPEG, PNG and WebP without
    // loading the legacy Jimp dependency tree.
    let origW: number;
    let origH: number;
    let resizedPixels: Buffer;
    try {
      const decoder = sharp(imageBuffer, { failOn: "error" });
      const metadata = await decoder.metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error("Missing dimensions");
      }
      origW = metadata.width;
      origH = metadata.height;
      resizedPixels = await decoder
        .resize(640, 640, { fit: "fill" })
        .ensureAlpha()
        .raw()
        .toBuffer();
    } catch {
      throw new Error("Định dạng ảnh không được hỗ trợ. Vui lòng sử dụng file ảnh JPEG, PNG hoặc WEBP.");
    }

    const float32Data = new Float32Array(3 * 640 * 640);

    for (let y = 0; y < 640; y++) {
      for (let x = 0; x < 640; x++) {
        const offset = (y * 640 + x) * 4;
        float32Data[0 * 640 * 640 + y * 640 + x] = resizedPixels[offset] / 255.0;
        float32Data[1 * 640 * 640 + y * 640 + x] = resizedPixels[offset + 1] / 255.0;
        float32Data[2 * 640 * 640 + y * 640 + x] = resizedPixels[offset + 2] / 255.0;
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

    // 5. Draw bounding boxes as an SVG overlay and return a compact JPEG data URL.
    const boxes = finalDetections
      .map(({ bbox: [x1, y1, x2, y2], class_name }) => {
        const color = class_name === "crack" ? "#ef4444" : "#10b981";
        return `<rect x="${x1}" y="${y1}" width="${Math.max(1, x2 - x1)}" height="${Math.max(1, y2 - y1)}" fill="none" stroke="${color}" stroke-width="3"/>`;
      })
      .join("");
    const overlay = Buffer.from(
      `<svg width="${origW}" height="${origH}" xmlns="http://www.w3.org/2000/svg">${boxes}</svg>`
    );
    const annotated = await sharp(imageBuffer)
      .composite([{ input: overlay }])
      .jpeg({ quality: 85 })
      .toBuffer();
    const base64Annotated = `data:image/jpeg;base64,${annotated.toString("base64")}`;

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

