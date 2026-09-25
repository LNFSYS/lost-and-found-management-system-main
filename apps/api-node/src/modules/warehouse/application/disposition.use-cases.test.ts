import assert from "node:assert/strict";
import test from "node:test";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { NotificationRepository } from "../../notifications/application/index.js";
import { createDispositionUseCases } from "./disposition.use-cases.js";
import type { DispositionOrderRecord, DispositionRepository } from "./disposition.repository.port.js";
import type { WarehouseRepository } from "./warehouse.repository.port.js";

const order = {
  id: "order-1", orderNumber: "DISP-1", dispositionType: "DISPOSAL", status: "APPROVED",
  reason: "Expired", createdBy: { id: "admin-1", fullName: null },
  approvedBy: { id: "admin-1", fullName: null },
  createdAt: "2026-09-20T00:00:00.000Z", updatedAt: "2026-09-20T00:00:00.000Z",
  items: [{ id: "order-item-1", warehouseItemId: "item-1", itemName: "Bag", storageCode: "A1", status: "PENDING", processedAt: null, notes: null }]
} satisfies DispositionOrderRecord;

function service(disposition: Partial<DispositionRepository>, warehouse: Partial<WarehouseRepository> = {}) {
  return createDispositionUseCases({
    dispositionRepository: disposition as DispositionRepository,
    warehouseRepository: warehouse as WarehouseRepository,
    notificationRepository: {} as NotificationRepository,
    withTransaction: async (work) => work({} as TransactionContext),
    id: () => "new-id"
  });
}

test("disposition rejects an item outside its approved order", async () => {
  let updated = false;
  const useCases = service({
    findDispositionOrderById: async () => order,
    lockDispositionOrder: async () => undefined,
    updateWarehouseItemsStatus: async () => { updated = true; return 1; }
  });
  await assert.rejects(useCases.executeDisposition(order.id, { processedItemIds: ["item-2"], evidenceUrls: [] }, "staff-1"), { code: "bad_request" });
  assert.equal(updated, false);
});

test("disposition rechecks legal hold before execution", async () => {
  let updated = false;
  const useCases = service({
    findDispositionOrderById: async () => order,
    lockDispositionOrder: async () => undefined,
    lockWarehouseItem: async () => undefined,
    listActiveLegalHolds: async () => [{ id: "hold-1" } as never],
    updateWarehouseItemsStatus: async () => { updated = true; return 1; }
  }, {
    findItemById: async () => ({ id: "item-1", status: "STORED", retentionDeadline: "2026-01-01T00:00:00.000Z", postId: null } as never)
  });
  await assert.rejects(useCases.executeDisposition(order.id, { processedItemIds: ["item-1"], evidenceUrls: [] }, "staff-1"), { code: "conflict" });
  assert.equal(updated, false);
});

test("disposition rejects a guarded update that did not affect every item", async () => {
  let processed = false;
  const useCases = service({
    findDispositionOrderById: async () => order,
    lockDispositionOrder: async () => undefined,
    lockWarehouseItem: async () => undefined,
    listActiveLegalHolds: async () => [],
    updateWarehouseItemsStatus: async () => 0,
    markOrderItemsProcessed: async () => { processed = true; }
  }, {
    findItemById: async () => ({ id: "item-1", status: "STORED", retentionDeadline: "2026-01-01T00:00:00.000Z", postId: null } as never)
  });
  await assert.rejects(useCases.executeDisposition(order.id, { processedItemIds: ["item-1"], evidenceUrls: [] }, "staff-1"), { code: "conflict" });
  assert.equal(processed, false);
});
