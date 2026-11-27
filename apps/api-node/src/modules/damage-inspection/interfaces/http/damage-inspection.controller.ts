import type { Request, Response } from "express";
import { AppError } from "../../../../shared/domain/app-error.js";
import { validateImageUpload } from "../../../../shared/domain/media.js";
import { HttpError } from "../../../../shared/interfaces/http/http-error.js";
import type { DamageInspectionServicePort } from "../../application/damage-inspection.port.js";

export function createDamageInspectionController({ service }: { service: DamageInspectionServicePort }) {
  return {
    async getStatus(_req: Request, res: Response) {
      const status = await service.getStatus();
      res.json(status);
    },

    async analyze(req: Request, res: Response) {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "Vui lòng đính kèm một file ảnh!" });
        }

        // Validate image magic bytes, size limit and supported format
        validateImageUpload({
          buffer: req.file.buffer,
          size: req.file.size,
          mimetype: req.file.mimetype
        });

        const result = await service.analyze(req.file.buffer);
        res.json(result);
      } catch (error: any) {
        if (error instanceof AppError) {
          const status = error.code === "payload_too_large" ? 413
            : error.code === "unsupported_media" ? 400 // Note: client expects 400 for bad image
            : error.code === "bad_request" ? 400
            : error.code === "forbidden" ? 403
            : error.code === "unauthenticated" ? 401
            : 400;
          return res.status(status).json({ message: error.message });
        }
        if (error instanceof HttpError) {
          return res.status(error.status).json({ message: error.message });
        }
        // Sanitize unexpected 500 errors to prevent leaking internal stack or error details
        console.error("[DamageInspection] Error during analysis:", error);
        res.status(500).json({ message: "Lỗi xử lý phân tích khuyết tật bề mặt." });
      }
    }
  };
}

export type DamageInspectionController = ReturnType<typeof createDamageInspectionController>;
