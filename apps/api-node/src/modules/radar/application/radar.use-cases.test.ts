import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../../shared/domain/app-error.js";
import type { RadarAlert, RadarHotspot, RadarRepository, RadarTopCategory } from "./radar.repository.port.js";
import { createRadarUseCases } from "./radar.use-cases.js";

function makeFixture(overrides: Partial<RadarRepository> = {}) {
  const categories: RadarTopCategory[] = [
    { categoryId: "cat-1", categoryName: "Ví tiền", lostCount: 15 },
    { categoryId: "cat-2", categoryName: "Thẻ sinh viên", lostCount: 12 }
  ];
  const hotspots: RadarHotspot[] = [
    { buildingId: "b-1", buildingName: "Tòa Alpha", areaName: "Sảnh A", incidentCount: 8, commonCategories: "Ví tiền, Thẻ SV" }
  ];
  const alerts: RadarAlert[] = [
    {
      id: "alert-1",
      eventId: "ev-1",
      severity: "CRITICAL",
      status: "OPEN",
      observedCount: 10,
      expectedMean: 2.5,
      zScore: 3.2,
      windowStart: "2026-10-01T00:00:00.000Z",
      windowEnd: "2026-10-01T02:00:00.000Z",
      lastDetectedAt: "2026-10-01T01:30:00.000Z",
      createdAt: "2026-10-01T01:30:00.000Z",
      sourceReference: "Thư viện",
      eventType: "ACADEMIC",
      buildingName: "Tòa Alpha",
      areaName: "Thư viện",
      categoryName: "Ví tiền"
    }
  ];

  const repository: RadarRepository = {
    getTopLostCategories: async () => categories,
    getTopHotspots: async () => hotspots,
    getOpenAlerts: async () => alerts,
    findAlertById: async (id) => alerts.find((a) => a.id === id) ?? null,
    acknowledgeAlert: async () => true,
    ...overrides
  };

  const useCases = createRadarUseCases({
    radarRepository: repository,
    idFactory: () => "audit-id-123"
  });

  return { useCases, repository, categories, hotspots, alerts };
}

test("getAnalytics returns aggregated data with valid custom date range", async () => {
  const { useCases, categories, hotspots, alerts } = makeFixture();
  const result = await useCases.getAnalytics({ from: "2026-10-01", to: "2026-10-15" });

  assert.equal(result.from, "2026-10-01T00:00:00.000Z");
  assert.equal(result.to, "2026-10-15T23:59:59.999Z");
  assert.deepEqual(result.categories, categories);
  assert.deepEqual(result.hotspots, hotspots);
  assert.deepEqual(result.alerts, alerts);
});

test("getAnalytics handles default 30-day range when dates omitted", async () => {
  const { useCases } = makeFixture();
  const result = await useCases.getAnalytics({});

  assert.ok(result.from);
  assert.ok(result.to);
  const fromMs = new Date(result.from).getTime();
  const toMs = new Date(result.to).getTime();
  assert.ok(toMs > fromMs);
  // Approximately 30 days difference
  const diffDays = Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
  assert.equal(diffDays, 30);
});

test("getAnalytics rejects invalid date format", async () => {
  const { useCases } = makeFixture();
  await assert.rejects(
    () => useCases.getAnalytics({ from: "not-a-date" }),
    (error: unknown) => error instanceof AppError && error.code === "bad_request"
  );
  await assert.rejects(
    () => useCases.getAnalytics({ to: "not-a-date" }),
    (error: unknown) => error instanceof AppError && error.code === "bad_request"
  );
});

test("getAnalytics rejects from date after to date", async () => {
  const { useCases } = makeFixture();
  await assert.rejects(
    () => useCases.getAnalytics({ from: "2026-11-20", to: "2026-11-10" }),
    (error: unknown) => error instanceof AppError && error.code === "bad_request"
  );
});

test("acknowledgeAlert successfully acknowledges an OPEN alert", async () => {
  let acknowledgedAlertId = "";
  let acknowledgedActorId = "";
  let auditIdLogged = "";

  const { useCases } = makeFixture({
    acknowledgeAlert: async (alertId, actorId, auditId) => {
      acknowledgedAlertId = alertId;
      acknowledgedActorId = actorId;
      auditIdLogged = auditId;
      return true;
    }
  });

  const result = await useCases.acknowledgeAlert("alert-1", "staff-user-1");
  assert.deepEqual(result, { success: true, id: "alert-1", status: "ACKNOWLEDGED" });
  assert.equal(acknowledgedAlertId, "alert-1");
  assert.equal(acknowledgedActorId, "staff-user-1");
  assert.equal(auditIdLogged, "audit-id-123");
});

test("acknowledgeAlert rejects empty alertId or actorId", async () => {
  const { useCases } = makeFixture();
  await assert.rejects(
    () => useCases.acknowledgeAlert("", "staff-1"),
    (error: unknown) => error instanceof AppError && error.code === "bad_request"
  );
  await assert.rejects(
    () => useCases.acknowledgeAlert("alert-1", ""),
    (error: unknown) => error instanceof AppError && error.code === "unauthenticated"
  );
});

test("acknowledgeAlert rejects nonexistent alert with not_found", async () => {
  const { useCases } = makeFixture();
  await assert.rejects(
    () => useCases.acknowledgeAlert("unknown-id", "staff-1"),
    (error: unknown) => error instanceof AppError && error.code === "not_found"
  );
});

test("acknowledgeAlert is idempotent for non-OPEN alert", async () => {
  const { useCases } = makeFixture({
    findAlertById: async () => ({
      id: "alert-ack",
      eventId: "ev-1",
      severity: "WARNING",
      status: "ACKNOWLEDGED",
      observedCount: 5,
      expectedMean: 1.0,
      zScore: 2.1,
      windowStart: "2026-10-01T00:00:00.000Z",
      windowEnd: "2026-10-01T02:00:00.000Z",
      lastDetectedAt: "2026-10-01T01:30:00.000Z",
      createdAt: "2026-10-01T01:30:00.000Z",
      sourceReference: null,
      eventType: null,
      buildingName: null,
      areaName: null,
      categoryName: null
    }),
    acknowledgeAlert: async () => {
      assert.fail("Should not call acknowledgeAlert if already ACKNOWLEDGED");
    }
  });

  const result = await useCases.acknowledgeAlert("alert-ack", "staff-1");
  assert.deepEqual(result, { success: true, id: "alert-ack", status: "ACKNOWLEDGED" });
});

test("acknowledgeAlert throws conflict if update affectedRows is 0", async () => {
  const { useCases } = makeFixture({
    acknowledgeAlert: async () => false
  });

  await assert.rejects(
    () => useCases.acknowledgeAlert("alert-1", "staff-1"),
    (error: unknown) => error instanceof AppError && error.code === "conflict"
  );
});
