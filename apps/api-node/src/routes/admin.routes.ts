import { Router } from "express";
import { adminCatalogController } from "../controllers/admin-catalog.controller.js";
import { requireAnyRole, requireAuth } from "../middlewares/auth.middleware.js";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireAnyRole("ADMIN"));

adminRoutes.get("/catalog", (req, res, next) => adminCatalogController.getCatalog(req, res).catch(next));

adminRoutes.post("/categories", (req, res, next) => adminCatalogController.createCategory(req, res).catch(next));
adminRoutes.patch("/categories/:id", (req, res, next) => adminCatalogController.updateCategory(req, res).catch(next));
adminRoutes.delete("/categories/:id", (req, res, next) => adminCatalogController.deleteCategory(req, res).catch(next));

adminRoutes.post("/areas", (req, res, next) => adminCatalogController.createArea(req, res).catch(next));
adminRoutes.patch("/areas/:id", (req, res, next) => adminCatalogController.updateArea(req, res).catch(next));
adminRoutes.delete("/areas/:id", (req, res, next) => adminCatalogController.deleteArea(req, res).catch(next));

adminRoutes.post("/buildings", (req, res, next) => adminCatalogController.createBuilding(req, res).catch(next));
adminRoutes.patch("/buildings/:id", (req, res, next) => adminCatalogController.updateBuilding(req, res).catch(next));
adminRoutes.delete("/buildings/:id", (req, res, next) => adminCatalogController.deleteBuilding(req, res).catch(next));
