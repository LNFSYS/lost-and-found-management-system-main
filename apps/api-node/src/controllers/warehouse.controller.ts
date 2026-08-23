import type { Request, Response } from "express";
import { warehouseService } from "../services/warehouse.service.js";
import {
  createWarehouseItemSchema,
  listWarehouseItemsQuerySchema,
  updateWarehouseItemSchema,
  warehouseItemIdParamSchema
} from "../validators/warehouse.validator.js";

function routeId(request: Request) {
  return warehouseItemIdParamSchema.parse(request.params).id;
}

function actorId(request: Request) {
  return request.auth?.sub ?? "";
}

export const warehouseController = {
  async getCatalog(_request: Request, response: Response) {
    response.json(await warehouseService.getCatalog());
  },

  async listItems(request: Request, response: Response) {
    response.json(await warehouseService.listItems(listWarehouseItemsQuerySchema.parse(request.query)));
  },

  async createItem(request: Request, response: Response) {
    response.status(201).json(await warehouseService.createItem(createWarehouseItemSchema.parse(request.body), actorId(request)));
  },

  async updateItem(request: Request, response: Response) {
    response.json(await warehouseService.updateItem(routeId(request), updateWarehouseItemSchema.parse(request.body), actorId(request)));
  },

  async listLogs(request: Request, response: Response) {
    response.json({ logs: await warehouseService.listLogs(routeId(request)) });
  }
};
