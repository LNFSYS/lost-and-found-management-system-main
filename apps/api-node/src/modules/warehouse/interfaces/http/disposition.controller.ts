import type { Request, Response } from "express";
import type { DispositionUseCases } from "../../application/disposition.use-cases.js";
import {
  applyLegalHoldSchema,
  cancelDispositionOrderSchema,
  createDispositionOrderSchema,
  dispositionOrderIdParamSchema,
  executeDispositionSchema,
  legalHoldIdParamSchema,
  listDispositionOrdersQuerySchema,
  listOverdueItemsQuerySchema,
  rejectDispositionOrderSchema,
  releaseLegalHoldSchema,
  warehouseItemIdParamSchema
} from "./disposition.validator.js";

export function createDispositionController({ dispositionService }: { dispositionService: DispositionUseCases }) {
  return {
    // Overdue items & detail
    async listOverdueItems(req: Request, res: Response) {
      const query = listOverdueItemsQuerySchema.parse(req.query);
      const result = await dispositionService.listOverdueItems(query);
      res.json(result);
    },

    async getOverdueItemDetail(req: Request, res: Response) {
      const { id } = warehouseItemIdParamSchema.parse(req.params);
      const result = await dispositionService.getOverdueItemDetail(id);
      res.json(result);
    },

    async checkEligibility(req: Request, res: Response) {
      const { id } = warehouseItemIdParamSchema.parse(req.params);
      const result = await dispositionService.checkItemEligibility(id);
      res.json(result);
    },

    // Legal hold
    async applyLegalHold(req: Request, res: Response) {
      const body = applyLegalHoldSchema.parse(req.body);
      const result = await dispositionService.applyLegalHold(body, req.auth!.sub);
      res.status(201).json(result);
    },

    async releaseLegalHold(req: Request, res: Response) {
      const { holdId } = legalHoldIdParamSchema.parse(req.params);
      const body = releaseLegalHoldSchema.parse(req.body);
      const result = await dispositionService.releaseLegalHold(holdId, body, req.auth!.sub);
      res.json(result);
    },

    // Disposition orders
    async createDispositionOrder(req: Request, res: Response) {
      const body = createDispositionOrderSchema.parse(req.body);
      const result = await dispositionService.createDispositionOrder(body, req.auth!.sub);
      res.status(201).json(result);
    },

    async listDispositionOrders(req: Request, res: Response) {
      const query = listDispositionOrdersQuerySchema.parse(req.query);
      const result = await dispositionService.listDispositionOrders(query);
      res.json(result);
    },

    async getDispositionOrderDetail(req: Request, res: Response) {
      const { id } = dispositionOrderIdParamSchema.parse(req.params);
      const result = await dispositionService.getDispositionOrderDetail(id);
      res.json(result);
    },

    async approveDispositionOrder(req: Request, res: Response) {
      const { id } = dispositionOrderIdParamSchema.parse(req.params);
      const result = await dispositionService.approveDispositionOrder(id, req.auth!.sub);
      res.json(result);
    },

    async rejectDispositionOrder(req: Request, res: Response) {
      const { id } = dispositionOrderIdParamSchema.parse(req.params);
      const body = rejectDispositionOrderSchema.parse(req.body);
      const result = await dispositionService.rejectDispositionOrder(id, body, req.auth!.sub);
      res.json(result);
    },

    async cancelDispositionOrder(req: Request, res: Response) {
      const { id } = dispositionOrderIdParamSchema.parse(req.params);
      const body = cancelDispositionOrderSchema.parse(req.body);
      const result = await dispositionService.cancelDispositionOrder(id, body, req.auth!.sub);
      res.json(result);
    },

    async executeDisposition(req: Request, res: Response) {
      const { id } = dispositionOrderIdParamSchema.parse(req.params);
      const body = executeDispositionSchema.parse(req.body);
      const result = await dispositionService.executeDisposition(id, body, req.auth!.sub);
      res.json(result);
    }
  };
}

export type DispositionController = ReturnType<typeof createDispositionController>;
