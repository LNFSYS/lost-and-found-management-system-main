import type { Request, Response } from "express";
import { HttpError } from "../../../../shared/interfaces/http/http-error.js";
import type { ClaimUseCases } from "../../application/claim.use-cases.js";
import {
  claimDecisionSchema,
  claimIdParamSchema,
  createClaimSchema,
  createMessageSchema,
  evidenceParamSchema,
  listClaimsQuerySchema,
  listMessagesQuerySchema,
  uploadEvidenceSchema
} from "./claim.validator.js";

export function createClaimController({ claimService }: {
  claimService: ClaimUseCases;
}) {
  function claimId(request: Request) {
    return claimIdParamSchema.parse(request.params).claimId;
  }
  function idempotencyKey(request: Request) {
    const value = request.header("Idempotency-Key")?.trim();
    return value || undefined;
  }
  const claimController = {
    async listClaims(request: Request, response: Response) {
      response.json(await claimService.listClaims(request.auth!.sub, listClaimsQuerySchema.parse(request.query)));
    },

    async listRooms(request: Request, response: Response) {
      response.json(await claimService.listRooms(request.auth!.sub));
    },

    async createClaim(request: Request, response: Response) {
      const input = createClaimSchema.parse({ ...request.body, requestKey: idempotencyKey(request) ?? request.body?.requestKey });
      const result = await claimService.createClaim(request.auth!.sub, input);
      response.status(result.idempotent ? 200 : 201).json(result);
    },

    async getClaim(request: Request, response: Response) {
      response.json(await claimService.getClaim(claimId(request), request.auth!.sub));
    },

    async decide(request: Request, response: Response) {
      response.json(await claimService.decide(claimId(request), request.auth!.sub, claimDecisionSchema.parse(request.body)));
    },

    async withdraw(request: Request, response: Response) {
      response.json(await claimService.withdraw(claimId(request), request.auth!.sub));
    },

    async getRoom(request: Request, response: Response) {
      response.json(await claimService.getRoom(claimId(request), request.auth!.sub));
    },

    async listMessages(request: Request, response: Response) {
      response.json(await claimService.listMessages(claimId(request), request.auth!.sub, listMessagesQuerySchema.parse(request.query)));
    },

    async sendMessage(request: Request, response: Response) {
      const message = await claimService.sendMessage(claimId(request), request.auth!.sub, createMessageSchema.parse({
        ...request.body,
        clientMessageId: request.header("Idempotency-Key")?.trim() || request.body?.clientMessageId
      }));
      response.status(201).json(message);
    },

    async listEvidence(request: Request, response: Response) {
      response.json(await claimService.listEvidence(claimId(request), request.auth!.sub));
    },

    async uploadEvidence(request: Request, response: Response) {
      if (!request.file) throw new HttpError(400, "Cần gửi ảnh evidence với field name là file");
      const result = await claimService.uploadEvidence(claimId(request), request.auth!.sub, uploadEvidenceSchema.parse(request.body), request.file);
      response.status(201).json(result);
    },

    async getEvidence(request: Request, response: Response) {
      const params = evidenceParamSchema.parse(request.params);
      const evidence = await claimService.getEvidenceFile(params.claimId, params.evidenceId, request.auth!.sub);
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.type(evidence.contentType).send(evidence.body);
    }
  };
  return claimController;
}
export type ClaimController = ReturnType<typeof createClaimController>;
