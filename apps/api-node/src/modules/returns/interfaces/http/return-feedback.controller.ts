import type { Request, Response } from "express";
import { z } from "zod";
import type { ReturnFeedbackUseCases } from "../../application/return-feedback.use-cases.js";
import { appointmentIdParamSchema, returnFeedbackSchema } from "./return-feedback.validator.js";

export function createReturnFeedbackController({ returnFeedbackService }: {
  returnFeedbackService: ReturnFeedbackUseCases;
}) {
  function appointmentId(request: Request) {
    return appointmentIdParamSchema.parse(request.params).appointmentId;
  }
  function idempotencyKey(request: Request) {
    const header = request.header("idempotency-key")?.trim();
    return header || undefined;
  }
  const returnFeedbackController = {
    async listCompleted(request: Request, response: Response) {
      const page = z.coerce.number().int().min(1).max(10000).default(1).parse(request.query.page);
      response.json(await returnFeedbackService.listCompleted(request.auth!, page));
    },
    async getEligibility(request: Request, response: Response) {
      response.json(await returnFeedbackService.getEligibility(appointmentId(request), request.auth!));
    },

    async submit(request: Request, response: Response) {
      const body = returnFeedbackSchema.parse({ ...request.body, idempotencyKey: request.body?.idempotencyKey ?? idempotencyKey(request) });
      response.status(201).json(await returnFeedbackService.submitFeedback(appointmentId(request), body, request.auth!));
    }
  };
  return returnFeedbackController;
}
export type ReturnFeedbackController = ReturnType<typeof createReturnFeedbackController>;
