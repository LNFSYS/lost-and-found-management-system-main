import { Router } from "express";
import { warehouseController } from "../controllers/warehouse.controller.js";
import { requireAnyRole, requireAuth } from "../middlewares/auth.middleware.js";

export const staffRoutes = Router();

staffRoutes.use(requireAuth, requireAnyRole("STAFF", "ADMIN"));

staffRoutes.get("/warehouse-items/catalog", (req, res, next) => warehouseController.getCatalog(req, res).catch(next));
staffRoutes.get("/warehouse-items", (req, res, next) => warehouseController.listItems(req, res).catch(next));
staffRoutes.post("/warehouse-items", (req, res, next) => warehouseController.createItem(req, res).catch(next));
staffRoutes.patch("/warehouse-items/:id", (req, res, next) => warehouseController.updateItem(req, res).catch(next));
staffRoutes.get("/warehouse-items/:id/logs", (req, res, next) => warehouseController.listLogs(req, res).catch(next));
