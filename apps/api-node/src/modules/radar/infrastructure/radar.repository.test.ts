import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { createRadarRepository } from "./radar.repository.js";

type MutablePool = {
  execute: (sql: string, values?: unknown[]) => Promise<[unknown, unknown]>;
};

function createMockPool() {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const pool = {
    execute: async (sql: string, values?: unknown[]) => {
      queries.push({ sql: sql.replace(/\s+/g, " ").trim(), values });
      if (sql.includes("UPDATE campus_radar_alerts")) {
        return [{ affectedRows: 1 }, []];
      }
      return [[], []];
    }
  } as unknown as Pool;

  return { pool, queries };
}

test("getTopLostCategories queries top 10 categories for LOST posts in date range", async () => {
  const { pool, queries } = createMockPool();
  const repo = createRadarRepository(pool);
  const from = new Date("2026-10-01T00:00:00Z");
  const to = new Date("2026-10-15T23:59:59Z");

  await repo.getTopLostCategories(from, to);

  assert.equal(queries.length, 1);
  const q = queries[0];
  assert.match(q.sql, /SELECT c\.id AS category_id, c\.name AS category_name, COUNT\(p\.id\) AS lost_count/);
  assert.match(q.sql, /FROM posts p INNER JOIN item_categories c ON c\.id = p\.category_id/);
  assert.match(q.sql, /p\.type = 'LOST'/);
  assert.match(q.sql, /p\.deleted_at IS NULL/);
  assert.match(q.sql, /ORDER BY lost_count DESC/);
  assert.match(q.sql, /LIMIT 10/);
  assert.deepEqual(q.values, [from, to]);
});

test("getTopHotspots queries top 10 building/area hotspots in date range", async () => {
  const { pool, queries } = createMockPool();
  const repo = createRadarRepository(pool);
  const from = new Date("2026-10-01T00:00:00Z");
  const to = new Date("2026-10-15T23:59:59Z");

  await repo.getTopHotspots(from, to);

  assert.equal(queries.length, 1);
  const q = queries[0];
  assert.match(q.sql, /SELECT b\.id AS building_id, b\.name AS building_name, a\.name AS area_name/);
  assert.match(q.sql, /COUNT\(p\.id\) AS incident_count/);
  assert.match(q.sql, /LEFT JOIN campus_buildings b/);
  assert.match(q.sql, /LEFT JOIN campus_areas a/);
  assert.match(q.sql, /GROUP BY b\.id, b\.name, a\.name/);
  assert.match(q.sql, /ORDER BY incident_count DESC/);
  assert.match(q.sql, /LIMIT 10/);
  assert.deepEqual(q.values, [from, to]);
});

test("getOpenAlerts queries campus_radar_alerts with status OPEN ordered by severity", async () => {
  const { pool, queries } = createMockPool();
  const repo = createRadarRepository(pool);
  const from = new Date("2026-10-01T00:00:00Z");
  const to = new Date("2026-10-15T23:59:59Z");

  await repo.getOpenAlerts(from, to);

  assert.equal(queries.length, 1);
  const q = queries[0];
  assert.match(q.sql, /FROM campus_radar_alerts a/);
  assert.match(q.sql, /a\.status = 'OPEN'/);
  assert.match(q.sql, /ORDER BY \(a\.severity = 'CRITICAL'\) DESC, \(a\.severity = 'WARNING'\) DESC/);
  assert.match(q.sql, /LIMIT 20/);
  assert.deepEqual(q.values, [from, to]);
});

test("findAlertById queries single alert by id", async () => {
  const { pool, queries } = createMockPool();
  const repo = createRadarRepository(pool);

  await repo.findAlertById("alert-123");

  assert.equal(queries.length, 1);
  const q = queries[0];
  assert.match(q.sql, /FROM campus_radar_alerts a/);
  assert.match(q.sql, /WHERE a\.id = \?/);
  assert.deepEqual(q.values, ["alert-123"]);
});

test("acknowledgeAlert updates alert status to ACKNOWLEDGED and writes audit log", async () => {
  const { pool, queries } = createMockPool();
  const repo = createRadarRepository(pool);

  const success = await repo.acknowledgeAlert("alert-123", "actor-456", "audit-789");

  assert.equal(success, true);
  assert.equal(queries.length, 2);

  // 1. UPDATE
  assert.match(queries[0].sql, /UPDATE campus_radar_alerts SET status = 'ACKNOWLEDGED'/);
  assert.match(queries[0].sql, /WHERE id = \? AND status = 'OPEN'/);
  assert.deepEqual(queries[0].values, ["actor-456", "alert-123"]);

  // 2. INSERT audit log
  assert.match(queries[1].sql, /INSERT INTO campus_radar_audit_logs/);
  assert.deepEqual(queries[1].values, ["audit-789", "alert-123", "actor-456"]);
});
