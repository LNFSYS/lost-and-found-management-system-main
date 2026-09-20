import { Router } from "express";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { WarehouseController } from "./warehouse.controller.js";

export function createStaffRoutes({ warehouseController, auth }: {
  warehouseController: WarehouseController;
  auth: AuthMiddleware;
}) {
  const { requireAnyRole, requireAuth } = auth;
  const staffRoutes = Router();
  staffRoutes.use(requireAuth, requireAnyRole("STAFF", "ADMIN"));
  staffRoutes.get("/warehouse-items/catalog", (req, res, next) => warehouseController.getCatalog(req, res).catch(next));
  staffRoutes.get("/warehouse-items", (req, res, next) => warehouseController.listItems(req, res).catch(next));
  staffRoutes.post("/warehouse-items", (req, res, next) => warehouseController.createItem(req, res).catch(next));
  staffRoutes.patch("/warehouse-items/:id", (req, res, next) => warehouseController.updateItem(req, res).catch(next));
  staffRoutes.get("/warehouse-items/:id/logs", (req, res, next) => warehouseController.listLogs(req, res).catch(next));
  return staffRoutes;
}
