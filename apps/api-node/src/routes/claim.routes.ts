import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { claimController } from "../controllers/claim.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { HttpError } from "../utils/http-error.js";
import { mediaPolicy } from "../utils/media.js";

export const claimRoutes = Router();

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: mediaPolicy.maxBytes, files: 1 }
});

const claimCreateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau." }
});

const messageLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Bạn đang gửi tin nhắn quá nhanh. Vui lòng thử lại sau." }
});

const evidenceLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Bạn đã tải lên quá nhiều evidence. Vui lòng thử lại sau." }
});

const verificationLimit = rateLimit({
  windowMs: 60_000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Bạn đang thực hiện quá nhiều thao tác xác minh. Vui lòng thử lại sau." }
});

function uploadSingleEvidence(request: Request, response: Response, next: NextFunction) {
  evidenceUpload.single("file")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return next(new HttpError(status, error.code === "LIMIT_FILE_SIZE" ? "Ảnh evidence vượt quá giới hạn 10 MB." : "Tệp evidence tải lên không hợp lệ."));
    }
    next(error);
  });
}

claimRoutes.use(requireAuth);
claimRoutes.use((_request, response, next) => {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Vary", "Authorization");
  next();
});
claimRoutes.get("/rooms", (req, res, next) => claimController.listRooms(req, res).catch(next));
claimRoutes.get("/", (req, res, next) => claimController.listClaims(req, res).catch(next));
claimRoutes.post("/", claimCreateLimit, (req, res, next) => claimController.createClaim(req, res).catch(next));
claimRoutes.get("/:claimId", (req, res, next) => claimController.getClaim(req, res).catch(next));
claimRoutes.post("/:claimId/decision", verificationLimit, (req, res, next) => claimController.decide(req, res).catch(next));
claimRoutes.get("/:claimId/verification", verificationLimit, (req, res, next) => claimController.getVerification(req, res).catch(next));
claimRoutes.post("/:claimId/verification/questions", verificationLimit, (req, res, next) => claimController.sendVerificationQuestion(req, res).catch(next));
claimRoutes.post("/:claimId/verification/answers", verificationLimit, (req, res, next) => claimController.submitVerificationAnswer(req, res).catch(next));
claimRoutes.post("/:claimId/verification/reviews", verificationLimit, (req, res, next) => claimController.reviewVerificationQuestion(req, res).catch(next));
claimRoutes.post("/:claimId/withdraw", (req, res, next) => claimController.withdraw(req, res).catch(next));
claimRoutes.get("/:claimId/room", (req, res, next) => claimController.getRoom(req, res).catch(next));
claimRoutes.post("/:claimId/room", (req, res, next) => claimController.getRoom(req, res).catch(next));
claimRoutes.get("/:claimId/messages", (req, res, next) => claimController.listMessages(req, res).catch(next));
claimRoutes.post("/:claimId/messages", messageLimit, (req, res, next) => claimController.sendMessage(req, res).catch(next));
claimRoutes.get("/:claimId/evidence", (req, res, next) => claimController.listEvidence(req, res).catch(next));
claimRoutes.post("/:claimId/evidence", evidenceLimit, uploadSingleEvidence, (req, res, next) => claimController.uploadEvidence(req, res).catch(next));
claimRoutes.get("/:claimId/evidence/:evidenceId", (req, res, next) => claimController.getEvidence(req, res).catch(next));
