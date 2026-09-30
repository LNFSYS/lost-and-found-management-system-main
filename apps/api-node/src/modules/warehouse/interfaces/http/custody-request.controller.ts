import type { Request, Response } from "express";
import type { CustodyRequestUseCases } from "../../application/custody-request.use-cases.js";
import {
  acceptCustodyRequestSchema,
  cancelCustodyRequestSchema,
  createCustodyRequestSchema,
  custodyRequestIdParamSchema,
  intakeCustodyRequestSchema,
  listCustodyRequestsQuerySchema,
  rejectCustodyRequestSchema
} from "./custody-request.validator.js";

export function createCustodyRequestController({ custodyRequestService }: {
  custodyRequestService: CustodyRequestUseCases;
}) {
  function routeId(request: Request) {
    return custodyRequestIdParamSchema.parse(request.params).id;
  }
  function actorId(request: Request) {
    return request.auth?.sub ?? "";
  }

  const custodyRequestController = {
    async listRequests(request: Request, response: Response) {
      response.json(await custodyRequestService.listRequests(listCustodyRequestsQuerySchema.parse(request.query)));
    },

    async getRequest(request: Request, response: Response) {
      response.json(await custodyRequestService.getRequest(routeId(request)));
    },

    async getMyRequestByPost(request: Request, response: Response) {
      const postId = request.params.postId;
      if (!postId) throw new Error("Missing postId");
      response.json(await custodyRequestService.getMyRequestByPost(String(postId), actorId(request)));
    },

    async createRequest(request: Request, response: Response) {
      const result = await custodyRequestService.createRequest(
        createCustodyRequestSchema.parse(request.body),
        actorId(request)
      );
      response.status(result.idempotent ? 200 : 201).json(result);
    },

    async acceptRequest(request: Request, response: Response) {
      response.json(await custodyRequestService.acceptRequest(
        routeId(request),
        acceptCustodyRequestSchema.parse(request.body),
        actorId(request)
      ));
    },

    async rejectRequest(request: Request, response: Response) {
      response.json(await custodyRequestService.rejectRequest(
        routeId(request),
        rejectCustodyRequestSchema.parse(request.body),
        actorId(request)
      ));
    },

    async cancelRequest(request: Request, response: Response) {
      response.json(await custodyRequestService.cancelRequest(
        routeId(request),
        cancelCustodyRequestSchema.parse(request.body),
        actorId(request)
      ));
    },

    async confirmIntake(request: Request, response: Response) {
      response.json(await custodyRequestService.confirmIntake(
        routeId(request),
        intakeCustodyRequestSchema.parse(request.body),
        actorId(request)
      ));
    }
  };

  return custodyRequestController;
}

export type CustodyRequestController = ReturnType<typeof createCustodyRequestController>;
