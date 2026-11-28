import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import { HttpError } from "../../../../shared/interfaces/http/http-error.js";
import type { DamageInspectionController } from "./damage-inspection.controller.js";

export function createDamageInspectionRoutes({
  controller,
  auth
}: {
  controller: DamageInspectionController;
  auth: AuthMiddleware;
}) {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 10, fieldSize: 1024 * 1024, parts: 20 },
    fileFilter: (_req, file, cb) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
        return cb(new HttpError(400, "Định dạng file không được hỗ trợ. Chỉ chấp nhận JPEG, PNG hoặc WEBP."));
      }
      cb(null, true);
    }
  });

  function uploadSingleFile(req: Request, res: Response, next: NextFunction) {
    upload.single("file")(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        return next(
          new HttpError(
            error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
            error.code === "LIMIT_FILE_SIZE" ? "Ảnh vượt quá giới hạn 10 MB" : "Tệp ảnh không hợp lệ"
          )
        );
      }
      next(error);
    });
  }

  const damageInspectionLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Bạn đã thực hiện quá nhiều lượt phân tích khuyết tật. Vui lòng thử lại sau." }
  });

  router.use(auth.requireAuth, auth.requireAnyRole("STAFF", "ADMIN"));

  router.get("/status", (req: Request, res: Response, next: NextFunction) => {
    controller.getStatus(req, res).catch(next);
  });

  router.post(
    "/analyze",
    damageInspectionLimit,
    uploadSingleFile,
    (req: Request, res: Response, next: NextFunction) => {
      controller.analyze(req, res).catch(next);
    }
  );

  return router;
}
