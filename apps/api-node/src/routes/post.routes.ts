import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { postController } from "../controllers/post.controller.js";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware.js";
import { HttpError } from "../utils/http-error.js";
import { mediaPolicy } from "../utils/media.js";

export const postRoutes = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: mediaPolicy.maxBytes, files: 1 }
});

function uploadSingleImage(request: Request, response: Response, next: NextFunction) {
  upload.single("file")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return next(new HttpError(status, error.code === "LIMIT_FILE_SIZE" ? "Anh vuot qua gioi han 10MB" : "Upload media khong hop le"));
    }
    next(error);
  });
}

postRoutes.get("/", optionalAuth, (req, res, next) => postController.listBoard(req, res).catch(next));
postRoutes.get("/catalog", requireAuth, (req, res, next) => postController.getFormCatalog(req, res).catch(next));
postRoutes.get("/mine", requireAuth, (req, res, next) => postController.listMine(req, res).catch(next));
postRoutes.post("/", requireAuth, (req, res, next) => postController.createPost(req, res).catch(next));
postRoutes.get("/:id", optionalAuth, (req, res, next) => postController.getPost(req, res).catch(next));
postRoutes.patch("/:id", requireAuth, (req, res, next) => postController.updatePost(req, res).catch(next));
postRoutes.delete("/:id", requireAuth, (req, res, next) => postController.softDeletePost(req, res).catch(next));
postRoutes.post("/:id/media", requireAuth, uploadSingleImage, (req, res, next) => postController.uploadMedia(req, res).catch(next));
postRoutes.get("/:postId/media/:mediaId", optionalAuth, (req, res, next) => postController.getMedia(req, res).catch(next));
postRoutes.delete("/:postId/media/:mediaId", requireAuth, (req, res, next) => postController.deleteMedia(req, res).catch(next));
