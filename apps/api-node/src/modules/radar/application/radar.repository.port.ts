export interface RadarTopCategory {
  categoryId: string;
  categoryName: string;
  lostCount: number;
}

export interface RadarHotspot {
  buildingId: string | null;
  buildingName: string | null;
  areaName: string | null;
  incidentCount: number;
  commonCategories: string | null;
}

export interface RadarAlert {
  id: string;
  eventId: string;
  severity: "WATCH" | "WARNING" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  observedCount: number;
  expectedMean: number;
  zScore: number;
  windowStart: string;
  windowEnd: string;
  lastDetectedAt: string;
  createdAt: string;
  sourceReference: string | null;
  eventType: string | null;
  buildingName: string | null;
  areaName: string | null;
  categoryName: string | null;
}

export interface RadarAnalytics {
  from: string;
  to: string;
  categories: RadarTopCategory[];
  hotspots: RadarHotspot[];
  alerts: RadarAlert[];
}

export interface RadarRepository {
  getTopLostCategories(fromDate: Date, toDate: Date): Promise<RadarTopCategory[]>;
  getTopHotspots(fromDate: Date, toDate: Date): Promise<RadarHotspot[]>;
  getOpenAlerts(fromDate: Date, toDate: Date): Promise<RadarAlert[]>;
  acknowledgeAlert(alertId: string, actorId: string, auditId: string): Promise<boolean>;
  findAlertById(alertId: string): Promise<RadarAlert | null>;
}
