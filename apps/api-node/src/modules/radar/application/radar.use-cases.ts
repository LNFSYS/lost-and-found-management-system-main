import { AppError } from "../../../shared/domain/app-error.js";
import type { RadarAnalytics, RadarRepository } from "./radar.repository.port.js";

export interface RadarDependencies {
  radarRepository: RadarRepository;
  idFactory: () => string;
}

export function createRadarUseCases({ radarRepository, idFactory }: RadarDependencies) {
  function parseDateRange(fromString?: string, toString?: string): { fromDate: Date; toDate: Date } {
    let toDate: Date;
    const cleanTo = toString?.trim();
    if (cleanTo) {
      toDate = new Date(cleanTo.includes("T") ? cleanTo : `${cleanTo}T23:59:59.999Z`);
      if (Number.isNaN(toDate.getTime())) {
        throw new AppError("bad_request", "Ngày kết thúc (to) không hợp lệ");
      }
    } else {
      toDate = new Date();
    }

    let fromDate: Date;
    const cleanFrom = fromString?.trim();
    if (cleanFrom) {
      fromDate = new Date(cleanFrom.includes("T") ? cleanFrom : `${cleanFrom}T00:00:00.000Z`);
      if (Number.isNaN(fromDate.getTime())) {
        throw new AppError("bad_request", "Ngày bắt đầu (from) không hợp lệ");
      }
    } else {
      fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    if (fromDate.getTime() > toDate.getTime()) {
      throw new AppError("bad_request", "Khoảng thời gian không hợp lệ: ngày bắt đầu phải trước ngày kết thúc");
    }

    return { fromDate, toDate };
  }

  return {
    async getAnalytics(options: { from?: string; to?: string }): Promise<RadarAnalytics> {
      const { fromDate, toDate } = parseDateRange(options.from, options.to);

      const [categories, hotspots, alerts] = await Promise.all([
        radarRepository.getTopLostCategories(fromDate, toDate),
        radarRepository.getTopHotspots(fromDate, toDate),
        radarRepository.getOpenAlerts(fromDate, toDate)
      ]);

      return {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        categories,
        hotspots,
        alerts
      };
    },

    async acknowledgeAlert(alertId: string, actorId: string) {
      if (!alertId) {
        throw new AppError("bad_request", "Mã cảnh báo không được để trống");
      }
      if (!actorId) {
        throw new AppError("unauthenticated", "Phiên làm việc không hợp lệ");
      }

      const alert = await radarRepository.findAlertById(alertId);
      if (!alert) {
        throw new AppError("not_found", "Không tìm thấy cảnh báo radar");
      }

      if (alert.status !== "OPEN") {
        return { success: true, id: alertId, status: alert.status };
      }

      const auditId = idFactory();
      const success = await radarRepository.acknowledgeAlert(alertId, actorId, auditId);
      if (!success) {
        throw new AppError("conflict", "Không thể cập nhật trạng thái cảnh báo");
      }

      return { success: true, id: alertId, status: "ACKNOWLEDGED" as const };
    }
  };
}

export type RadarUseCases = ReturnType<typeof createRadarUseCases>;
