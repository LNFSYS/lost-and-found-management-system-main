import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authController } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

export const authRoutes = Router();
const otpLimit = rateLimit({ windowMs: 10 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { message: "Bạn đã yêu cầu quá nhiều mã OTP. Vui lòng thử lại sau." } });
const loginLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau." } });
const sensitiveLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: "Quá nhiều yêu cầu. Vui lòng thử lại sau." } });

authRoutes.post("/register/request-otp", otpLimit, (req, res, next) => authController.requestRegistrationOtp(req, res).catch(next));
authRoutes.post("/register", sensitiveLimit, (req, res, next) => authController.register(req, res).catch(next));
authRoutes.post("/login", loginLimit, (req, res, next) => authController.login(req, res).catch(next));
authRoutes.post("/refresh", sensitiveLimit, (req, res, next) => authController.refresh(req, res).catch(next));
authRoutes.post("/logout", (req, res, next) => authController.logout(req, res).catch(next));
authRoutes.post("/forgot-password", otpLimit, (req, res, next) => authController.forgotPassword(req, res).catch(next));
authRoutes.post("/reset-password", sensitiveLimit, (req, res, next) => authController.resetPassword(req, res).catch(next));
authRoutes.get("/me", requireAuth, (req, res, next) => authController.me(req, res).catch(next));
authRoutes.patch("/profile", requireAuth, (req, res, next) => authController.updateProfile(req, res).catch(next));
