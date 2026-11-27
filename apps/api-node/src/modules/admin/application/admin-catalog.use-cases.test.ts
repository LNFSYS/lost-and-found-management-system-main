import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { AppError } from "../../../shared/domain/app-error.js";
import { unexpectedPort } from "../../../test/unexpected-port.js";
import { createTestAdminCatalogUseCases } from "../../../test/use-case-fixtures.js";
import type { AdminCatalogRepository } from "./admin-catalog.repository.port.js";
import { type AdminHandoverPoint } from "./admin-catalog.repository.port.js";

const point: AdminHandoverPoint = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Quầy Alpha",
  address: "Sảnh Alpha",
  areaId: null,
  areaName: null,
  buildingId: null,
  buildingName: null,
  openingHours: "08:00 - 17:30",
  contactInfo: null,
  mapImageUrl: null,
  mapPositionX: 50,
  mapPositionY: 50,
  isActive: true,
  storedItems: 0,
  activeAppointments: 1,
  createdAt: "2026-08-26T00:00:00.000Z"
};

test("public handover catalog is queried in active-only mode and omits admin appointment data", async () => {
  const adminCatalogRepository = Object.assign(unexpectedPort<AdminCatalogRepository>("catalog"), { listHandoverPoints: async () => [point] });
  const adminCatalogService = createTestAdminCatalogUseCases({ adminCatalogRepository });
  const list = mock.method(adminCatalogRepository, "listHandoverPoints", async (activeOnly = false) => {
    assert.equal(activeOnly, true);
    return [point];
  });
  try {
    const result = await adminCatalogService.getPublicHandoverPoints();
    assert.equal(result.length, 1);
    assert.equal("activeAppointments" in result[0], false);
    assert.equal("createdAt" in result[0], false);
  } finally {
    list.mock.restore();
  }
});

test("hard delete is rejected while an active appointment uses the handover point", async () => {
  const adminCatalogRepository = Object.assign(unexpectedPort<AdminCatalogRepository>("catalog"), {
    findHandoverPointById: async () => point,
    countActiveHandoverAppointments: async () => 1,
    deleteHandoverPoint: async () => undefined
  });
  const adminCatalogService = createTestAdminCatalogUseCases({ adminCatalogRepository });
  const find = mock.method(adminCatalogRepository, "findHandoverPointById", async () => point);
  const active = mock.method(adminCatalogRepository, "countActiveHandoverAppointments", async () => 1);
  const remove = mock.method(adminCatalogRepository, "deleteHandoverPoint", async () => undefined);
  try {
    await assert.rejects(
      () => adminCatalogService.deleteHandoverPoint(point.id),
      (error: unknown) => error instanceof AppError && error.code === "conflict" && /lịch hẹn hoạt động/.test(error.message)
    );
    assert.equal(remove.mock.callCount(), 0);
  } finally {
    find.mock.restore();
    active.mock.restore();
    remove.mock.restore();
  }
});

test("handover point requires the selected building to belong to its area", async () => {
  const adminCatalogRepository = Object.assign(unexpectedPort<AdminCatalogRepository>("catalog"), {
    findAreaById: async () => null,
    findBuildingById: async () => null
  });
  const adminCatalogService = createTestAdminCatalogUseCases({ adminCatalogRepository });
  const area = mock.method(adminCatalogRepository, "findAreaById", async () => ({
    id: "area-a", name: "Alpha", description: null, isActive: true, sortOrder: 0, buildingCount: 1, createdAt: "2026-08-26T00:00:00.000Z"
  }));
  const building = mock.method(adminCatalogRepository, "findBuildingById", async () => ({
    id: "building-b", areaId: "area-b", areaName: "Beta", name: "Tòa Beta", isActive: true, sortOrder: 0, createdAt: "2026-08-26T00:00:00.000Z"
  }));
  try {
    await assert.rejects(
      () => adminCatalogService.createHandoverPoint("admin-id", {
        name: "Quầy Alpha",
        address: "Sảnh Alpha",
        areaId: "11111111-1111-4111-8111-111111111111",
        buildingId: "22222222-2222-4222-8222-222222222222"
      }),
      (error: unknown) => error instanceof AppError && error.code === "invalid_input"
    );
  } finally {
    area.mock.restore();
    building.mock.restore();
  }
});

test("admin catalog operations record audit logs with before/after state (BR-31)", async () => {
  const recordedAudits: any[] = [];
  const fakeAudit = {
    record: async (entry: any) => {
      recordedAudits.push(entry);
    }
  };
  const categoryRecord = {
    id: "cat-1",
    name: "Ví",
    nameNormalized: "vi",
    icon: null,
    parentId: null,
    parentName: null,
    isActive: true,
    sortOrder: 1,
    childCount: 0,
    referenceCount: 0,
    createdAt: "2026-08-26T00:00:00.000Z"
  };
  const adminCatalogRepository = Object.assign(unexpectedPort<AdminCatalogRepository>("catalog"), {
    findCategoryById: async () => categoryRecord,
    findCategoryByNormalized: async () => null,
    createCategory: async (input: any) => ({ ...categoryRecord, ...input }),
    updateCategory: async (id: string, input: any) => ({ ...categoryRecord, id, ...input }),
    countCategoryReferences: async () => 0,
    deleteCategory: async () => undefined
  });
  const adminCatalogService = createTestAdminCatalogUseCases({
    adminCatalogRepository,
    auditRepository: fakeAudit as any
  });

  const created = await adminCatalogService.createCategory({ name: "Ví", isActive: true, sortOrder: 1 }, "admin-1");
  assert.equal(recordedAudits.length, 1);
  assert.equal(recordedAudits[0].action, "ADMIN_CATEGORY_CREATED");
  assert.equal(recordedAudits[0].targetType, "CATEGORY");
  assert.equal(recordedAudits[0].actorId, "admin-1");
  assert.equal(recordedAudits[0].beforeState, null);
  assert.deepEqual(recordedAudits[0].afterState, created);
  assert.ok(created);

  const updated = await adminCatalogService.updateCategory(created.id, { name: "Bóp da" }, "admin-1");
  assert.equal(recordedAudits.length, 2);
  assert.equal(recordedAudits[1].action, "ADMIN_CATEGORY_UPDATED");
  assert.equal(recordedAudits[1].beforeState.name, "Ví");
  assert.equal(recordedAudits[1].afterState.name, "Bóp da");

  await adminCatalogService.deleteCategory(created.id, "admin-1");
  assert.equal(recordedAudits.length, 3);
  assert.equal(recordedAudits[2].action, "ADMIN_CATEGORY_DELETED");
  assert.equal(recordedAudits[2].afterState, null);
});
