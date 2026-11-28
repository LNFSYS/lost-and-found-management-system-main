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

export interface DamageInspectionStatus {
  status: "ready" | "model_missing";
  runtime: string;
}

export const CLASS_NAMES = [
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
] as const;

export const VIETNAMESE_NAMES: Record<string, string> = {
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

export const CLASS_WEIGHTS: Record<string, number> = {
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

export function calculateIoU(box1: [number, number, number, number], box2: [number, number, number, number]): number {
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

export function nms(
  boxes: Array<{ bbox: [number, number, number, number]; confidence: number; cls_id: number; class_name: string }>,
  iouThreshold = 0.45
) {
  let remaining = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const selected: Array<{ bbox: [number, number, number, number]; confidence: number; cls_id: number; class_name: string }> = [];

  while (remaining.length > 0) {
    const current = remaining.shift()!;
    selected.push(current);
    remaining = remaining.filter((box) => {
      if (box.cls_id !== current.cls_id) return true;
      return calculateIoU(box.bbox, current.bbox) < iouThreshold;
    });
  }
  return selected;
}

export function evaluateDamageScore(
  finalDetections: Array<{ bbox: [number, number, number, number]; confidence: number; cls_id: number; class_name: string }>,
  origW: number,
  origH: number,
  base64Annotated: string
): DamageAnalysisResult {
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
    const rawRatio = Math.min(1.0, rawDamagePixels / totalSurfacePixels);
    damagePercentage = Math.round(rawRatio * 10000) / 100;

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
