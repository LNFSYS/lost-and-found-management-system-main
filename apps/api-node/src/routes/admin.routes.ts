import { Router } from "express";
import { adminCatalogController } from "../controllers/admin-catalog.controller.js";
import { adminUserController } from "../controllers/admin-user.controller.js";
import { requireAnyRole, requireAuth } from "../middlewares/auth.middleware.js";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireAnyRole("ADMIN"));

adminRoutes.get("/catalog", (req, res, next) => adminCatalogController.getCatalog(req, res).catch(next));

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
