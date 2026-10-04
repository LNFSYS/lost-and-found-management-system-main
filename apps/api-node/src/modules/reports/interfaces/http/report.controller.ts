import type { Request, Response } from "express";
import type { ReportUseCases } from "../../application/report.use-cases.js";
import { listMyReportsSchema, reportIdParamSchema, submitReportSchema } from "./report.validator.js";

export function createReportController({ reportService }: { reportService: ReportUseCases }) {
  const userId = (request: Request) => request.auth!.sub;
  return {
    async submit(request: Request, response: Response) {
      response.status(201).json(await reportService.submit(userId(request), submitReportSchema.parse(request.body)));
    },
    async listMine(request: Request, response: Response) {
      response.json(await reportService.listMine(userId(request), listMyReportsSchema.parse(request.query)));
    },
    async getMine(request: Request, response: Response) {
      response.json(await reportService.getMine(userId(request), reportIdParamSchema.parse(request.params).id));
    },
    async withdraw(request: Request, response: Response) {
      response.json(await reportService.withdraw(userId(request), reportIdParamSchema.parse(request.params).id));
    }
  };
}
export type ReportController = ReturnType<typeof createReportController>;
