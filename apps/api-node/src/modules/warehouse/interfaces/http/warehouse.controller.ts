import type { Request, Response } from "express";
import type { WarehouseUseCases } from "../../application/warehouse.use-cases.js";
import {
  createWarehouseItemSchema,
  listWarehouseItemsQuerySchema,
  updateWarehouseItemSchema,
  warehouseItemIdParamSchema
} from "./warehouse.validator.js";

export function createWarehouseController({ warehouseService }: {
  warehouseService: WarehouseUseCases;
}) {
  function routeId(request: Request) {
    return warehouseItemIdParamSchema.parse(request.params).id;
  }
  function actorId(request: Request) {
    return request.auth?.sub ?? "";
  }
  const warehouseController = {
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
  return warehouseController;
}
export type WarehouseController = ReturnType<typeof createWarehouseController>;
