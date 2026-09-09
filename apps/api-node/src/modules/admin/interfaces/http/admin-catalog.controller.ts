import type { Request, Response } from "express";
import { validateImageUpload } from "../../../../shared/domain/media.js";
import { HttpError } from "../../../../shared/interfaces/http/http-error.js";
import type { AdminCatalogUseCases } from "../../application/admin-catalog.use-cases.js";
import {
  createAreaSchema,
  createBuildingSchema,
  createCategorySchema,
  createHandoverPointSchema,
  idParamSchema,
  updateAreaSchema,
  updateBuildingSchema,
  updateCategorySchema,
  updateHandoverPointSchema
} from "./admin-catalog.validator.js";

export function createAdminCatalogController({ adminCatalogService }: {
  adminCatalogService: AdminCatalogUseCases;
}) {
  function routeId(request: Request) {
    return idParamSchema.parse(request.params).id;
  }
  const adminCatalogController = {
    async getCatalog(_request: Request, response: Response) {
      response.json(await adminCatalogService.getCatalog());
    },

    async createCategory(request: Request, response: Response) {
      response.status(201).json(await adminCatalogService.createCategory(createCategorySchema.parse(request.body)));
    },

    async updateCategory(request: Request, response: Response) {
      response.json(await adminCatalogService.updateCategory(routeId(request), updateCategorySchema.parse(request.body)));
    },

    async deleteCategory(request: Request, response: Response) {
      await adminCatalogService.deleteCategory(routeId(request));
      response.status(204).send();
    },

    async createArea(request: Request, response: Response) {
      response.status(201).json(await adminCatalogService.createArea(createAreaSchema.parse(request.body)));
    },

    async updateArea(request: Request, response: Response) {
      response.json(await adminCatalogService.updateArea(routeId(request), updateAreaSchema.parse(request.body)));
    },

    async deleteArea(request: Request, response: Response) {
      await adminCatalogService.deleteArea(routeId(request));
      response.status(204).send();
    },

    async createBuilding(request: Request, response: Response) {
      response.status(201).json(await adminCatalogService.createBuilding(createBuildingSchema.parse(request.body)));
    },

    async updateBuilding(request: Request, response: Response) {
      response.json(await adminCatalogService.updateBuilding(routeId(request), updateBuildingSchema.parse(request.body)));
    },

    async deleteBuilding(request: Request, response: Response) {
      await adminCatalogService.deleteBuilding(routeId(request));
      response.status(204).send();
    },

    async listPublicHandoverPoints(_request: Request, response: Response) {
      response.json({ handoverPoints: await adminCatalogService.getPublicHandoverPoints() });
    },

    async createHandoverPoint(request: Request, response: Response) {
      response.status(201).json(await adminCatalogService.createHandoverPoint(
        request.auth!.sub,
        createHandoverPointSchema.parse(request.body)
      ));
    },

    async updateHandoverPoint(request: Request, response: Response) {
      response.json(await adminCatalogService.updateHandoverPoint(routeId(request), updateHandoverPointSchema.parse(request.body)));
    },

    async uploadHandoverMapImage(request: Request, response: Response) {
      if (!request.file) throw new HttpError(400, "Cần chọn một ảnh bản đồ");
      const image = validateImageUpload(request.file);
      const dataUrl = `data:${image.mimeType};base64,${request.file.buffer.toString("base64")}`;
      response.json(await adminCatalogService.updateHandoverMapImage(routeId(request), dataUrl));
    },

    async deleteHandoverPoint(request: Request, response: Response) {
      await adminCatalogService.deleteHandoverPoint(routeId(request));
      response.status(204).send();
    }
  };
  return adminCatalogController;
}
export type AdminCatalogController = ReturnType<typeof createAdminCatalogController>;
