import type { Request, Response } from "express";
import type { AdminReportingUseCases } from "../../application/admin-reporting.use-cases.js";
import {
  adminReportIdParamSchema,
  dashboardKpiQuerySchema,
  listModerationReportsQuerySchema,
  reviewModerationReportSchema,
  statisticsExportSchema
} from "./admin-reporting.validator.js";

export function createAdminReportingController({ adminReportingService }: {
  adminReportingService: AdminReportingUseCases;
}) {
  function routeId(request: Request) {
    return adminReportIdParamSchema.parse(request.params).id;
  }
  function actorId(request: Request) {
    return request.auth!.sub;
  }
  const adminReportingController = {
    async listReports(request: Request, response: Response) {
      response.json(await adminReportingService.listReports(listModerationReportsQuerySchema.parse(request.query)));
    },

    async reviewReport(request: Request, response: Response) {
      response.json(await adminReportingService.reviewReport(actorId(request), routeId(request), reviewModerationReportSchema.parse(request.body)));
    },

    async getDashboardKpis(request: Request, response: Response) {
      response.json(await adminReportingService.getDashboardKpis(dashboardKpiQuerySchema.parse(request.query)));
    },

    async exportStatistics(request: Request, response: Response) {
      let input;
      try {
        input = statisticsExportSchema.parse(request.body ?? {});
      } catch (error) {
        await adminReportingService.recordExportFailure(actorId(request), error, null);
        throw error;
      }
      response.json(await adminReportingService.exportStatistics(actorId(request), input));
    }
  };
  return adminReportingController;
}
export type AdminReportingController = ReturnType<typeof createAdminReportingController>;
