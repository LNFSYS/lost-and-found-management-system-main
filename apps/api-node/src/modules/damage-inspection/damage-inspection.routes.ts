import { Router, type Request, type Response } from "express";
import multer from "multer";
import { damageInspectionService } from "./damage-inspection.service.js";

export function createDamageInspectionRoutes() {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB
  });

  router.get("/status", async (_req: Request, res: Response) => {
    const isReady = await damageInspectionService.initModel();
    res.json({
      status: isReady ? "ready" : "model_missing",
      runtime: "Node.js (ONNX Runtime)"
    });
  });

  router.post("/analyze", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Vui lòng đính kèm một file ảnh!" });
      }

      const result = await damageInspectionService.analyze(req.file.buffer);
      res.json(result);
    } catch (error: any) {
      console.error("[DamageInspection] Error during analysis:", error);
      res.status(500).json({ message: error.message || "Lỗi xử lý phân tích khuyết tật bề mặt." });
    }
  });

  return router;
}

