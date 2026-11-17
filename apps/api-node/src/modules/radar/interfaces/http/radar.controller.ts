import type { Request, Response } from "express";
import { AppError } from "../../../../shared/domain/app-error.js";
import type { RadarUseCases } from "../../application/radar.use-cases.js";
import { radarAlertIdParamSchema, radarAnalyticsQuerySchema } from "./radar.validator.js";

export function createRadarController({ radarService }: { radarService: RadarUseCases }) {
  function actorId(request: Request) {
    const sub = request.auth?.sub;
    if (!sub) {
      throw new AppError("unauthenticated", "Phiên làm việc không hợp lệ");
    }
    return sub;
  }

  function routeId(request: Request) {
    return radarAlertIdParamSchema.parse(request.params).id;
  }

  return {
    async getAnalytics(request: Request, response: Response) {
      const query = radarAnalyticsQuerySchema.parse(request.query);
      const data = await radarService.getAnalytics(query);
      response.json(data);
    },

    async acknowledgeAlert(request: Request, response: Response) {
      const alertId = routeId(request);
      const result = await radarService.acknowledgeAlert(alertId, actorId(request));
      response.json(result);
    }
  };
}

export type RadarController = ReturnType<typeof createRadarController>;
