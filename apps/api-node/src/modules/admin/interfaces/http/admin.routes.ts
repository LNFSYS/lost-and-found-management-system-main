import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import { HttpError } from "../../../../shared/interfaces/http/http-error.js";
import type { AdminCatalogController } from "./admin-catalog.controller.js";
import type { AdminReportingController } from "./admin-reporting.controller.js";
import type { AdminUserController } from "./admin-user.controller.js";

export function createAdminRoutes({ adminCatalogController, adminReportingController, adminUserController, auth }: {
  adminCatalogController: AdminCatalogController;
  adminReportingController: AdminReportingController;
  adminUserController: AdminUserController;
  auth: AuthMiddleware;
}) {
  const { requireAnyRole, requireAuth } = auth;
  const adminRoutes = Router();
  const handoverMapUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1 }
  });
  function uploadHandoverMap(request: Request, response: Response, next: NextFunction) {
    handoverMapUpload.single("file")(request, response, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        return next(new HttpError(
          error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
          error.code === "LIMIT_FILE_SIZE" ? "Ảnh bản đồ không được vượt quá 2 MB" : "Tệp ảnh bản đồ không hợp lệ"
        ));
      }
      next(error);
    });
  }
  adminRoutes.use(requireAuth, requireAnyRole("ADMIN"));
  adminRoutes.get("/catalog", (req, res, next) => adminCatalogController.getCatalog(req, res).catch(next));
  adminRoutes.get("/reports", (req, res, next) => adminReportingController.listReports(req, res).catch(next));
  adminRoutes.patch("/reports/:id/review", (req, res, next) => adminReportingController.reviewReport(req, res).catch(next));
  adminRoutes.get("/dashboard/kpis", (req, res, next) => adminReportingController.getDashboardKpis(req, res).catch(next));
  adminRoutes.post("/statistics/export", (req, res, next) => adminReportingController.exportStatistics(req, res).catch(next));
  adminRoutes.get("/users", (req, res, next) => adminUserController.listUsers(req, res).catch(next));
  adminRoutes.post("/users", (req, res, next) => adminUserController.createUser(req, res).catch(next));
  adminRoutes.get("/users/:id", (req, res, next) => adminUserController.getUser(req, res).catch(next));
  adminRoutes.patch("/users/:id", (req, res, next) => adminUserController.updateUser(req, res).catch(next));
  adminRoutes.patch("/users/:id/role", (req, res, next) => adminUserController.changeRole(req, res).catch(next));
  adminRoutes.patch("/users/:id/status", (req, res, next) => adminUserController.changeStatus(req, res).catch(next));
  adminRoutes.delete("/users/:id", (req, res, next) => adminUserController.deleteUser(req, res).catch(next));
  adminRoutes.post("/categories", (req, res, next) => adminCatalogController.createCategory(req, res).catch(next));
  adminRoutes.patch("/categories/:id", (req, res, next) => adminCatalogController.updateCategory(req, res).catch(next));
  adminRoutes.delete("/categories/:id", (req, res, next) => adminCatalogController.deleteCategory(req, res).catch(next));
  adminRoutes.post("/areas", (req, res, next) => adminCatalogController.createArea(req, res).catch(next));
  adminRoutes.patch("/areas/:id", (req, res, next) => adminCatalogController.updateArea(req, res).catch(next));
  adminRoutes.delete("/areas/:id", (req, res, next) => adminCatalogController.deleteArea(req, res).catch(next));
  adminRoutes.post("/buildings", (req, res, next) => adminCatalogController.createBuilding(req, res).catch(next));
  adminRoutes.patch("/buildings/:id", (req, res, next) => adminCatalogController.updateBuilding(req, res).catch(next));
  adminRoutes.delete("/buildings/:id", (req, res, next) => adminCatalogController.deleteBuilding(req, res).catch(next));
  adminRoutes.post("/handover-points", (req, res, next) => adminCatalogController.createHandoverPoint(req, res).catch(next));
  adminRoutes.patch("/handover-points/:id", (req, res, next) => adminCatalogController.updateHandoverPoint(req, res).catch(next));
  adminRoutes.post("/handover-points/:id/map-image", uploadHandoverMap, (req, res, next) => adminCatalogController.uploadHandoverMapImage(req, res).catch(next));
  adminRoutes.delete("/handover-points/:id", (req, res, next) => adminCatalogController.deleteHandoverPoint(req, res).catch(next));
  return adminRoutes;
}
