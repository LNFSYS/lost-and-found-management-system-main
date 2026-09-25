import type { Request, Response } from "express";
import type { CustodyUseCases } from "../../application/custody-request.use-cases.js";
import {
  acceptCustodyRequestSchema,
  cancelCustodyRequestSchema,
  confirmStaffIntakeSchema,
  createCustodyRequestSchema,
  custodyRequestIdParamSchema,
  listCustodyRequestsQuerySchema,
  postIdParamSchema,
  rejectCustodyRequestSchema
} from "./custody.validator.js";

export function createCustodyController({ custodyService }: { custodyService: CustodyUseCases }) {
  return {
    async createCustodyRequest(req: Request, res: Response) {
      const body = createCustodyRequestSchema.parse(req.body);
      const idempotencyKey = (req.headers["idempotency-key"] as string) || null;
      const result = await custodyService.createCustodyRequest(
        { ...body, idempotencyKey },
        req.auth!.sub
      );
      res.status(201).json(result);
    },

    async listMyCustodyRequests(req: Request, res: Response) {
      const query = listCustodyRequestsQuerySchema.parse(req.query);
      const result = await custodyService.listCustodyRequests({
        ...query,
        finderId: req.auth!.sub
      });
      res.json(result);
    },

    async listStaffCustodyRequests(req: Request, res: Response) {
      const query = listCustodyRequestsQuerySchema.parse(req.query);
      const result = await custodyService.listCustodyRequests(query);
      res.json(result);
    },

    async getCustodyRequestDetail(req: Request, res: Response) {
      const { id } = custodyRequestIdParamSchema.parse(req.params);
      const isStaffOrAdmin = req.auth!.roles.includes("STAFF") || req.auth!.roles.includes("ADMIN");
      const result = await custodyService.getCustodyRequestDetail(id, req.auth!.sub, isStaffOrAdmin);
      res.json(result);
    },

    async acceptCustodyRequest(req: Request, res: Response) {
      const { id } = custodyRequestIdParamSchema.parse(req.params);
      const body = acceptCustodyRequestSchema.parse(req.body);
      const result = await custodyService.acceptCustodyRequest(id, body, req.auth!.sub);
      res.json(result);
    },

    async rejectCustodyRequest(req: Request, res: Response) {
      const { id } = custodyRequestIdParamSchema.parse(req.params);
      const body = rejectCustodyRequestSchema.parse(req.body);
      const result = await custodyService.rejectCustodyRequest(id, body, req.auth!.sub);
      res.json(result);
    },

    async cancelCustodyRequest(req: Request, res: Response) {
      const { id } = custodyRequestIdParamSchema.parse(req.params);
      const body = cancelCustodyRequestSchema.parse(req.body);
      const isStaffOrAdmin = req.auth!.roles.includes("STAFF") || req.auth!.roles.includes("ADMIN");
      const result = await custodyService.cancelCustodyRequest(id, body, req.auth!.sub, isStaffOrAdmin);
      res.json(result);
    },

    async confirmStaffIntake(req: Request, res: Response) {
      const { id } = custodyRequestIdParamSchema.parse(req.params);
      const body = confirmStaffIntakeSchema.parse(req.body);
      const idempotencyKey = (req.headers["idempotency-key"] as string) || null;
      const result = await custodyService.confirmStaffIntake(
        id,
        { ...body, idempotencyKey },
        req.auth!.sub
      );
      res.status(201).json(result);
    }
  };
}

export type CustodyController = ReturnType<typeof createCustodyController>;
