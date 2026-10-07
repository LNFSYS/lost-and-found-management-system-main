import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../../../shared/interfaces/http/http-error.js";
import type { WarehouseUseCases } from "../../application/warehouse.use-cases.js";
import {
  createWarehouseItemSchema,
  listWarehouseItemsQuerySchema,
  updateWarehouseItemSchema,
  warehouseItemIdParamSchema,
  returnWarehouseItemSchema,
  verifyCustodyClaimSchema
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
      const { itemId } = z.object({ itemId: z.string().uuid() }).parse(request.body);
      response.json(await warehouseService.uploadProof(itemId, request.file, actorId(request)));
    },
    async uploadIntakeImage(request: Request, response: Response) {
      if (!request.file) throw new HttpError(400, "Cần chọn ảnh tình trạng tiếp nhận");
      const input = z.object({ intakeKey: z.string().uuid(), custodyRequestId: z.string().uuid().optional(), capturedAt: z.coerce.date().optional() }).parse(request.body);
      response.status(201).json(await warehouseService.uploadIntakeImage(input, request.file, actorId(request)));
    },
    async listImages(request: Request, response: Response) {
      response.setHeader("Cache-Control", "private, no-store");
      response.json(await warehouseService.listImages(routeId(request), actorId(request)));
    },
    async deleteIntakeImage(request: Request, response: Response) {
      const { intakeKey } = z.object({ intakeKey: z.string().uuid() }).parse(request.body);
      response.json(await warehouseService.deleteIntakeImage(intakeKey, routeId(request), actorId(request)));
    },
    async getImage(request: Request, response: Response) {
      const { provenance } = z.object({ provenance: z.enum(["SOURCE_POST", "CONTACT_PHOTO", "INTAKE", "RETURN"]) }).parse(request.query);
      const image = await warehouseService.getImage(routeId(request), provenance, actorId(request));
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("Vary", "Authorization");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.type(image.contentType).send(image.body);
    },
    async getProof(request: Request, response: Response) {
      const proof = await warehouseService.getProof(routeId(request), actorId(request));
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.type(proof.contentType).send(proof.body);
    },
    async reserveItem(request: Request, response: Response) {
      const input = z.object({ claimId: z.string().uuid(), recipientId: z.string().uuid() }).parse(request.body);
      response.json(await warehouseService.reserveItem(routeId(request), input.claimId, input.recipientId, actorId(request)));
    },
    async returnRecipients(request: Request, response: Response) {
      response.json(await warehouseService.returnRecipients(routeId(request), actorId(request)));
    },
    async returnClaimReviews(request: Request, response: Response) {
      response.json(await warehouseService.returnClaimReviews(routeId(request), actorId(request)));
    },
    async verifyCustodyClaim(request: Request, response: Response) {
      response.json(await warehouseService.verifyCustodyClaim(routeId(request), verifyCustodyClaimSchema.parse(request.body), actorId(request)));
    },
    async releaseReservation(request: Request, response: Response) {
      const { reason } = z.object({ reason: z.string().trim().min(3).max(1000) }).parse(request.body);
      response.json(await warehouseService.releaseReservation(routeId(request), reason, actorId(request)));
    },
    async legalHold(request: Request, response: Response) {
      const input = z.object({ held: z.boolean(), reason: z.string().trim().min(3).max(1000) }).parse(request.body);
      await warehouseService.legalHold(routeId(request), input.held, input.reason, actorId(request));
      response.sendStatus(204);
    },
    async dispositionContext(request: Request, response: Response) {
      response.set("Cache-Control", "private, no-store");
      response.json(await warehouseService.dispositionContext(routeId(request), actorId(request)));
    },
    async requestDisposition(request: Request, response: Response) {
      const input = z.object({ target: z.enum(["DISPOSED","DONATED","TRANSFERRED"]), reason: z.string().trim().min(3).max(1000) }).parse(request.body);
      response.status(201).json(await warehouseService.requestDisposition(routeId(request), input.target, input.reason, actorId(request)));
    },
    async approveDisposition(request: Request, response: Response) {
      await warehouseService.approveDisposition(routeId(request), actorId(request));
      response.sendStatus(204);
    },
    async executeDisposition(request: Request, response: Response) {
      const { proofIds } = z.object({ proofIds: z.array(z.string().uuid()).min(1).max(5) }).parse(request.body);
      await warehouseService.executeDisposition(routeId(request), actorId(request), proofIds);
      response.sendStatus(204);
    }
  };
  return warehouseController;
}
export type WarehouseController = ReturnType<typeof createWarehouseController>;
