import * as ort from "onnxruntime-node";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLASS_NAMES,
  evaluateDamageScore,
  nms,
  type DamageAnalysisResult,
  type DamageInspectionStatus
} from "../domain/damage-inspection.types.js";
import type { DamageInspectionServicePort } from "../application/damage-inspection.port.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class OnnxDamageInspectionService implements DamageInspectionServicePort {
  private session: ort.InferenceSession | null = null;
  private modelPath: string | null = null;

  private getPossiblePaths(): string[] {
    return [
      path.resolve(__dirname, "../../../../../models/best.onnx"),
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

  public async getStatus(): Promise<DamageInspectionStatus> {
    const isReady = await this.initModel();
    return {
      status: isReady ? "ready" : "model_missing",
      runtime: "Node.js (ONNX Runtime)"
    };
  }

  public async analyze(imageBuffer: Buffer): Promise<DamageAnalysisResult> {
    const isReady = await this.initModel();
    if (!isReady || !this.session) {
      throw new Error(
        "Mô hình quét khuyết tật (best.onnx) chưa sẵn sàng! Vui lòng đặt file best.onnx vào thư mục models/."
      );
    }

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

    const finalDetections = nms(candidateBoxes, 0.45);
    console.info(`[DamageInspection] Image (${origW}x${origH}) -> Raw candidates: ${candidateBoxes.length}, Detected after NMS: ${finalDetections.length}`);

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

    return evaluateDamageScore(finalDetections, origW, origH, base64Annotated);
  }
}

export const damageInspectionService = new OnnxDamageInspectionService();
