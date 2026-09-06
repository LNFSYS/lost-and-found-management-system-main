import type { Request, Response } from "express";
import { adminReportingService } from "../services/admin-reporting.service.js";
import {
  adminReportIdParamSchema,
  dashboardKpiQuerySchema,
  listModerationReportsQuerySchema,
  reviewModerationReportSchema
} from "../validators/admin-reporting.validator.js";

function routeId(request: Request) {
  return adminReportIdParamSchema.parse(request.params).id;
}

function actorId(request: Request) {
  return request.auth!.sub;
}

export const adminReportingController = {
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
    response.json(await adminReportingService.exportStatistics(actorId(request), request.body ?? {}));
  }
};
