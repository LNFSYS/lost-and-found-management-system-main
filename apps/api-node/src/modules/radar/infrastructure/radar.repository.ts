import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  RadarAlert,
  RadarHotspot,
  RadarRepository,
  RadarTopCategory
} from "../application/radar.repository.port.js";

interface CategoryRow extends RowDataPacket {
  category_id: string;
  category_name: string;
  lost_count: number;
}

interface HotspotRow extends RowDataPacket {
  building_id: string | null;
  building_name: string | null;
  area_name: string | null;
  incident_count: number;
  common_categories: string | null;
}

interface AlertRow extends RowDataPacket {
  id: string;
  event_id: string;
  severity: "WATCH" | "WARNING" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  observed_count: number;
  expected_mean: string | number;
  z_score: string | number;
  window_start: Date | string;
  window_end: Date | string;
  last_detected_at: Date | string;
  created_at: Date | string;
  source_reference: string | null;
  event_type: string | null;
  building_name: string | null;
  area_name: string | null;
  category_name: string | null;
}

function toIsoString(date: Date | string | null): string {
  if (!date) return "";
  if (date instanceof Date) return date.toISOString();
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? String(date) : parsed.toISOString();
}

function mapAlert(row: AlertRow): RadarAlert {
  return {
    id: row.id,
    eventId: row.event_id,
    severity: row.severity,
    status: row.status,
    observedCount: Number(row.observed_count),
    expectedMean: Number(row.expected_mean),
    zScore: Number(row.z_score),
    windowStart: toIsoString(row.window_start),
    windowEnd: toIsoString(row.window_end),
    lastDetectedAt: toIsoString(row.last_detected_at),
    createdAt: toIsoString(row.created_at),
    sourceReference: row.source_reference,
    eventType: row.event_type,
    buildingName: row.building_name,
    areaName: row.area_name,
    categoryName: row.category_name
  };
}

export function createRadarRepository(database: Pool): RadarRepository {
  return {
    async getTopLostCategories(fromDate: Date, toDate: Date): Promise<RadarTopCategory[]> {
      const [rows] = await database.execute<CategoryRow[]>(
        `SELECT c.id AS category_id, c.name AS category_name, COUNT(p.id) AS lost_count
         FROM posts p
         INNER JOIN item_categories c ON c.id = p.category_id
         WHERE p.type = 'LOST' AND p.deleted_at IS NULL
           AND p.created_at >= ? AND p.created_at <= ?
         GROUP BY c.id, c.name
         ORDER BY lost_count DESC
         LIMIT 10`,
        [fromDate, toDate]
      );

      return rows.map((row) => ({
        categoryId: row.category_id,
        categoryName: row.category_name,
        lostCount: Number(row.lost_count)
      }));
    },

    async getTopHotspots(fromDate: Date, toDate: Date): Promise<RadarHotspot[]> {
      const [rows] = await database.execute<HotspotRow[]>(
        `SELECT b.id AS building_id, b.name AS building_name, a.name AS area_name,
                COUNT(p.id) AS incident_count,
                GROUP_CONCAT(DISTINCT c.name SEPARATOR ', ') AS common_categories
         FROM posts p
         LEFT JOIN campus_buildings b ON b.id = p.building_id
         LEFT JOIN campus_areas a ON a.id = p.area_id
         LEFT JOIN item_categories c ON c.id = p.category_id
         WHERE p.deleted_at IS NULL
           AND (p.building_id IS NOT NULL OR p.area_id IS NOT NULL)
           AND p.created_at >= ? AND p.created_at <= ?
         GROUP BY b.id, b.name, a.name
         ORDER BY incident_count DESC
         LIMIT 10`,
        [fromDate, toDate]
      );

      return rows.map((row) => ({
        buildingId: row.building_id,
        buildingName: row.building_name,
        areaName: row.area_name,
        incidentCount: Number(row.incident_count),
        commonCategories: row.common_categories
      }));
    },

    async getOpenAlerts(fromDate: Date, toDate: Date): Promise<RadarAlert[]> {
      const [rows] = await database.execute<AlertRow[]>(
        `SELECT a.id, a.event_id, a.severity, a.status, a.observed_count, a.expected_mean, a.z_score,
                a.window_start, a.window_end, a.last_detected_at, a.created_at,
                e.source_reference, e.event_type,
                b.name AS building_name, ar.name AS area_name,
                c.name AS category_name
         FROM campus_radar_alerts a
         LEFT JOIN campus_radar_events e ON e.id = a.event_id
         LEFT JOIN campus_buildings b ON b.id = e.building_id
         LEFT JOIN campus_areas ar ON ar.id = e.area_id
         LEFT JOIN item_categories c ON c.id = a.category_id
         WHERE a.status = 'OPEN'
           AND a.created_at >= ? AND a.created_at <= ?
         ORDER BY (a.severity = 'CRITICAL') DESC, (a.severity = 'WARNING') DESC, a.created_at DESC
         LIMIT 20`,
        [fromDate, toDate]
      );

      return rows.map(mapAlert);
    },

    async findAlertById(alertId: string): Promise<RadarAlert | null> {
      const [rows] = await database.execute<AlertRow[]>(
        `SELECT a.id, a.event_id, a.severity, a.status, a.observed_count, a.expected_mean, a.z_score,
                a.window_start, a.window_end, a.last_detected_at, a.created_at,
                e.source_reference, e.event_type,
                b.name AS building_name, ar.name AS area_name,
                c.name AS category_name
         FROM campus_radar_alerts a
         LEFT JOIN campus_radar_events e ON e.id = a.event_id
         LEFT JOIN campus_buildings b ON b.id = e.building_id
         LEFT JOIN campus_areas ar ON ar.id = e.area_id
         LEFT JOIN item_categories c ON c.id = a.category_id
         WHERE a.id = ?
         LIMIT 1`,
        [alertId]
      );

      return rows[0] ? mapAlert(rows[0]) : null;
    },

    async acknowledgeAlert(alertId: string, actorId: string, auditId: string): Promise<boolean> {
      const [result] = await database.execute<ResultSetHeader>(
        `UPDATE campus_radar_alerts
         SET status = 'ACKNOWLEDGED',
             disposition_by = ?,
             disposition_at = NOW(),
             disposition_reason = 'OPERATIONAL_FOLLOW_UP'
         WHERE id = ? AND status = 'OPEN'`,
        [actorId, alertId]
      );

      if (result.affectedRows > 0) {
        await database.execute(
          `INSERT INTO campus_radar_audit_logs (id, alert_id, actor_id, action, metadata, created_at)
           VALUES (?, ?, ?, 'ALERT_STATUS_CHANGED', JSON_OBJECT('new_status', 'ACKNOWLEDGED'), NOW())`,
          [auditId, alertId, actorId]
        );
        return true;
      }

      return false;
    }
  };
}
