import { Router } from "express";
import { adminCatalogController } from "../controllers/admin-catalog.controller.js";

export const handoverRoutes = Router();

handoverRoutes.get("/", (_request, response, next) => {
  adminCatalogController.listPublicHandoverPoints(_request, response).catch(next);
});
