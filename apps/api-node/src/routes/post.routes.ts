import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { postController } from "../controllers/post.controller.js";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware.js";
import { HttpError } from "../utils/http-error.js";
import { mediaPolicy } from "../utils/media.js";

export const postRoutes = Router();

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: mediaPolicy.maxBytes, files: 1 }
});

const analysisUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: mediaPolicy.maxBytes, files: 5 }
});

const imageAnalysisLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Bạn đã phân tích quá nhiều ảnh. Vui lòng thử lại sau." }
});

const matchingRecalculationLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Bạn đã yêu cầu tính lại matching quá nhiều lần. Vui lòng thử lại sau." }
});

function uploadSingleImage(request: Request, response: Response, next: NextFunction) {
  mediaUpload.single("file")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return next(new HttpError(status, error.code === "LIMIT_FILE_SIZE" ? "Ảnh vượt quá giới hạn 10 MB." : "Tệp ảnh tải lên không hợp lệ."));
    }
    next(error);
  });
}

function uploadAnalysisImages(request: Request, response: Response, next: NextFunction) {
  analysisUpload.fields([
    { name: "files", maxCount: 5 },
    { name: "file", maxCount: 1 }
  ])(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "Mỗi ảnh phân tích không được vượt quá 10 MB."
        : error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE"
          ? "Chỉ được phân tích tối đa 5 ảnh trong một lần."
          : "Danh sách ảnh phân tích không hợp lệ.";
      return next(new HttpError(status, message));
    }
    next(error);
  });
}

postRoutes.get("/", optionalAuth, (req, res, next) => postController.listBoard(req, res).catch(next));
postRoutes.get("/catalog", requireAuth, (req, res, next) => postController.getFormCatalog(req, res).catch(next));
postRoutes.get("/mine", requireAuth, (req, res, next) => postController.listMine(req, res).catch(next));
postRoutes.post("/analyze-image", requireAuth, imageAnalysisLimit, uploadAnalysisImages, (req, res, next) => postController.analyzeImage(req, res).catch(next));
postRoutes.post("/", requireAuth, (req, res, next) => postController.createPost(req, res).catch(next));
postRoutes.get("/:id/matches", requireAuth, (req, res, next) => postController.listMatches(req, res).catch(next));
postRoutes.post("/:id/matches/recalculate", requireAuth, matchingRecalculationLimit, (req, res, next) => postController.recalculateMatches(req, res).catch(next));
postRoutes.get("/:id", optionalAuth, (req, res, next) => postController.getPost(req, res).catch(next));
postRoutes.patch("/:id", requireAuth, (req, res, next) => postController.updatePost(req, res).catch(next));
postRoutes.delete("/:id", requireAuth, (req, res, next) => postController.softDeletePost(req, res).catch(next));
postRoutes.post("/:id/media", requireAuth, uploadSingleImage, (req, res, next) => postController.uploadMedia(req, res).catch(next));
postRoutes.get("/:postId/media/:mediaId", optionalAuth, (req, res, next) => postController.getMedia(req, res).catch(next));
postRoutes.delete("/:postId/media/:mediaId", requireAuth, (req, res, next) => postController.deleteMedia(req, res).catch(next));
