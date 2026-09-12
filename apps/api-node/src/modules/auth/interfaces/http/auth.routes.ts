import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { avatarMediaPolicy } from "../../../../shared/domain/media.js";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import { HttpError } from "../../../../shared/interfaces/http/http-error.js";
import type { AuthController } from "./auth.controller.js";

export function createAuthRoutes({ authController, auth }: {
  authController: AuthController;
  auth: AuthMiddleware;
}) {
  const { requireAuth } = auth;
  const authRoutes = Router();
  const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: avatarMediaPolicy.maxBytes, files: 1 }
  });
  const otpLimit = rateLimit({ windowMs: 10 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { message: "Bạn đã yêu cầu quá nhiều mã OTP. Vui lòng thử lại sau." } });
  const loginLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau." } });
  const sensitiveLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: "Quá nhiều yêu cầu. Vui lòng thử lại sau." } });
  function uploadAvatar(request: Request, response: Response, next: NextFunction) {
    avatarUpload.single("file")(request, response, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return next(new HttpError(status, error.code === "LIMIT_FILE_SIZE" ? "Anh dai dien vuot qua gioi han 1MB" : "Anh dai dien khong hop le"));
      }
      next(error);
    });
  }
  authRoutes.post("/register/request-otp", otpLimit, (req, res, next) => authController.requestRegistrationOtp(req, res).catch(next));
  authRoutes.post("/register", sensitiveLimit, (req, res, next) => authController.register(req, res).catch(next));
  authRoutes.post("/login", loginLimit, (req, res, next) => authController.login(req, res).catch(next));
  authRoutes.post("/refresh", sensitiveLimit, (req, res, next) => authController.refresh(req, res).catch(next));
  authRoutes.post("/logout", (req, res, next) => authController.logout(req, res).catch(next));
  authRoutes.post("/forgot-password", otpLimit, (req, res, next) => authController.forgotPassword(req, res).catch(next));
  authRoutes.post("/reset-password", sensitiveLimit, (req, res, next) => authController.resetPassword(req, res).catch(next));
  authRoutes.get("/me", requireAuth, (req, res, next) => authController.me(req, res).catch(next));
  authRoutes.patch("/profile", requireAuth, (req, res, next) => authController.updateProfile(req, res).catch(next));
  authRoutes.patch("/profile/avatar", requireAuth, uploadAvatar, (req, res, next) => authController.updateAvatar(req, res).catch(next));
  authRoutes.get("/profile/avatar", requireAuth, (req, res, next) => authController.getAvatar(req, res).catch(next));
  authRoutes.get("/activity", requireAuth, (req, res, next) => authController.activity(req, res).catch(next));
  return authRoutes;
}
