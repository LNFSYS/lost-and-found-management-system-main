import type { Request, Response } from "express";
import { adminCatalogService } from "../services/admin-catalog.service.js";
import {
  createAreaSchema,
  createBuildingSchema,
  createCategorySchema,
  idParamSchema,
  updateAreaSchema,
  updateBuildingSchema,
  updateCategorySchema
} from "../validators/admin-catalog.validator.js";

function routeId(request: Request) {
  return idParamSchema.parse(request.params).id;
}

export const adminCatalogController = {
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
  }
};
