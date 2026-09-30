import type { Request, Response } from "express";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { HttpError } from "../../../../shared/interfaces/http/http-error.js";
import { validateImageUpload } from "../../../../shared/domain/media.js";
import { env } from "../../../../shared/infrastructure/config/env.js";
import type { WarehouseUseCases } from "../../application/warehouse.use-cases.js";
import {
  createWarehouseItemSchema,
  listWarehouseItemsQuerySchema,
  updateWarehouseItemSchema,
  warehouseItemIdParamSchema,
  returnWarehouseItemSchema
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
    },

    async returnItem(request: Request, response: Response) {
      response.json(await warehouseService.returnItem(routeId(request), returnWarehouseItemSchema.parse(request.body), actorId(request)));
    },

    async uploadProof(request: Request, response: Response) {
      if (!request.file) throw new HttpError(400, "Cần chọn một tệp ảnh bằng chứng");
      const image = validateImageUpload(request.file);
      let url: string;
      if (env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret) {
        try {
          cloudinary.config({
            cloud_name: env.cloudinary.cloudName,
            api_key: env.cloudinary.apiKey,
            api_secret: env.cloudinary.apiSecret,
            secure: true
          });
          const result = await new Promise<UploadApiResponse>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "lnfs/warehouse-proof", resource_type: "image" },
              (err, res) => (err || !res ? reject(err || new Error("Cloudinary upload failed")) : resolve(res))
            );
            stream.end(request.file!.buffer);
          });
          url = result.secure_url;
        } catch (err) {
          url = `data:${image.mimeType};base64,${request.file.buffer.toString("base64")}`;
        }
      } else {
        url = `data:${image.mimeType};base64,${request.file.buffer.toString("base64")}`;
      }
      response.json({ url });
    }
  };
  return warehouseController;
}
export type WarehouseController = ReturnType<typeof createWarehouseController>;
