import { Router } from "express";
import type { AdminCatalogController } from "./admin-catalog.controller.js";

export function createHandoverRoutes({ adminCatalogController }: {
  adminCatalogController: AdminCatalogController;
}) {
  const handoverRoutes = Router();
  handoverRoutes.get("/", (_request, response, next) => {
    adminCatalogController.listPublicHandoverPoints(_request, response).catch(next);
  });
  return handoverRoutes;
}
