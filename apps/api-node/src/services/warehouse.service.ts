import { withTransaction } from "../config/db.js";
import { warehouseRepository, type StorageLogAction } from "../repositories/warehouse.repository.js";
import { HttpError } from "../utils/http-error.js";
import { id } from "../utils/security.js";
import { normalizeVietnameseText } from "../utils/text.js";
import type {
  CreateWarehouseItemInput,
  ListWarehouseItemsQuery,
  UpdateWarehouseItemInput,
  WarehouseStatus
} from "../validators/warehouse.validator.js";

const retentionFallbacks = {
  "warehouse.retention_days_default": 60,
  "warehouse.retention_days_document": 120,
  "warehouse.retention_days_electronic": 90,
  "warehouse.retention_days_perishable": 3
} as const;

const transitionMap: Record<WarehouseStatus, WarehouseStatus[]> = {
  PENDING_APPROVAL: ["RECEIVED", "DISPOSED"],
  RECEIVED: ["STORED", "CLAIMED", "RETURNED", "EXPIRED", "DISPOSED"],
  STORED: ["CLAIMED", "RETURNED", "EXPIRED"],
  CLAIMED: ["STORED", "RETURNED"],
  RETURNED: [],
  EXPIRED: ["RETURNED", "DISPOSED", "DONATED", "TRANSFERRED"],
  DISPOSED: [],
  DONATED: [],
  TRANSFERRED: []
};

function clean(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function ensureNotFuture(value: Date) {
  if (value.getTime() > Date.now() + 60_000) throw new HttpError(400, "Thoi gian tiep nhan khong duoc o tuong lai");
}

function includesKeyword(text: string, keywords: string[]) {
  const compact = text.replace(/\s+/g, "");
  return keywords.some((keyword) => text.includes(keyword) || compact.includes(keyword.replace(/\s+/g, "")));
}

export function retentionConfigKeyForCategory(category: { name: string; parentName?: string | null } | null): keyof typeof retentionFallbacks {
  if (!category) return "warehouse.retention_days_default";
  const text = normalizeVietnameseText(`${category.parentName ?? ""} ${category.name}`);
  if (includesKeyword(text, ["giay to", "the", "card", "document", "student id", "cccd", "cmnd", "passport", "bang lai"])) {
    return "warehouse.retention_days_document";
  }
  if (includesKeyword(text, ["dien tu", "dien thoai", "phone", "laptop", "tablet", "may tinh", "computer", "tai nghe", "headphone", "sac", "charger"])) {
    return "warehouse.retention_days_electronic";
  }
  if (includesKeyword(text, ["do an", "thuc pham", "food", "drink", "nuoc", "my pham", "ve sinh", "hygiene"])) {
    return "warehouse.retention_days_perishable";
  }
  return "warehouse.retention_days_default";
}

export function calculateRetentionDeadline(receivedAt: Date, retentionDays: number) {
  const deadline = new Date(receivedAt);
  deadline.setUTCDate(deadline.getUTCDate() + retentionDays);
  return deadline;
}

export function canTransitionWarehouseStatus(from: WarehouseStatus, to: WarehouseStatus) {
  return transitionMap[from].includes(to);
}

async function retentionDaysForCategory(categoryId: string | null | undefined) {
  if (!categoryId) {
    return warehouseRepository.getConfigInt("warehouse.retention_days_default", retentionFallbacks["warehouse.retention_days_default"]);
  }
  const category = await warehouseRepository.findCategoryNames(categoryId);
  if (!category) throw new HttpError(404, "Khong tim thay danh muc vat pham");
  const key = retentionConfigKeyForCategory(category);
  return warehouseRepository.getConfigInt(key, retentionFallbacks[key]);
}

async function resolveLocation(input: Pick<CreateWarehouseItemInput, "areaId" | "buildingId">) {
  let areaId = input.areaId ?? null;
  const buildingId = input.buildingId ?? null;
  if (buildingId) {
    const building = await warehouseRepository.findBuildingById(buildingId);
    if (!building) throw new HttpError(404, "Khong tim thay dia diem");
    if (areaId && areaId !== building.areaId) throw new HttpError(400, "Dia diem khong thuoc khu vuc da chon");
    areaId = building.areaId;
  }
  if (areaId && !await warehouseRepository.findAreaById(areaId)) throw new HttpError(404, "Khong tim thay khu vuc");
  return { areaId, buildingId };
}

export const warehouseService = {
  async getCatalog() {
    return warehouseRepository.getCatalog();
  },

  async listItems(query: ListWarehouseItemsQuery) {
    const [stats, handoverCounts, list] = await Promise.all([
      warehouseRepository.getStats(),
      warehouseRepository.listHandoverCounts(),
      warehouseRepository.listItems(query)
    ]);
    return {
      stats,
      handoverCounts,
      total: list.total,
      page: query.page,
      pageSize: query.pageSize,
      items: list.items
    };
  },

  async createItem(input: CreateWarehouseItemInput, actorId: string) {
    if (!await warehouseRepository.findHandoverPointById(input.handoverPointId)) throw new HttpError(404, "Khong tim thay diem ban giao");
    if (input.postId && !await warehouseRepository.findPostById(input.postId)) throw new HttpError(404, "Khong tim thay bai dang lien quan");
    if (input.categoryId && !await warehouseRepository.findCategoryNames(input.categoryId)) throw new HttpError(404, "Khong tim thay danh muc vat pham");

    const receivedAt = input.receivedAt ?? new Date();
    ensureNotFuture(receivedAt);
    const location = await resolveLocation(input);
    const retentionDays = await retentionDaysForCategory(input.categoryId);
    const retentionDeadline = calculateRetentionDeadline(receivedAt, retentionDays);
    const warehouseItemId = id();
    const conditionNotes = input.conditionNotes.trim();
    const storageCode = clean(input.storageCode);

    await withTransaction(async (connection) => {
      await warehouseRepository.createItem({
        id: warehouseItemId,
        postId: input.postId ?? null,
        handoverPointId: input.handoverPointId,
        itemName: input.itemName.trim(),
        description: clean(input.description),
        categoryId: input.categoryId ?? null,
        areaId: location.areaId,
        buildingId: location.buildingId,
        roomText: clean(input.roomText),
        finderName: clean(input.finderName),
        finderContact: clean(input.finderContact),
        conditionNotes,
        storageCode,
        receivedAt,
        retentionDeadline,
        createdBy: actorId
      }, connection);
      await warehouseRepository.createStorageLog({
        id: id(),
        warehouseItemId,
        postId: input.postId ?? null,
        handoverPointId: input.handoverPointId,
        actorId,
        action: "RECEIVED",
        fromStatus: null,
        toStatus: "RECEIVED",
        conditionNotes,
        storageCode,
        note: "Item received"
      }, connection);
    });

    const item = await warehouseRepository.findItemById(warehouseItemId);
    if (!item) throw new HttpError(500, "Khong the doc lai vat pham vua tao");
    return item;
  },

  async updateItem(itemId: string, input: UpdateWarehouseItemInput, actorId: string) {
    let action: StorageLogAction = "CONDITION_UPDATED";
    await withTransaction(async (connection) => {
      const current = await warehouseRepository.lockItemForUpdate(itemId, connection);
      if (!current) throw new HttpError(404, "Khong tim thay vat pham trong kho");

      const nextStatus = input.status ?? current.status;
      const statusChanged = input.status !== undefined && input.status !== current.status;
      if (statusChanged && !canTransitionWarehouseStatus(current.status, nextStatus)) {
        throw new HttpError(400, `Khong the chuyen trang thai tu ${current.status} sang ${nextStatus}`);
      }

      const conditionNotes = input.conditionNotes !== undefined ? clean(input.conditionNotes) : undefined;
      const storageCode = input.storageCode !== undefined ? clean(input.storageCode) : undefined;
      const nextStorageCode = storageCode !== undefined ? storageCode : current.storageCode;
      if (nextStatus === "STORED" && !nextStorageCode) throw new HttpError(400, "Can ma vi tri luu kho khi chuyen sang STORED");

      action = statusChanged ? nextStatus : "CONDITION_UPDATED";
      const returnedAt = statusChanged && nextStatus === "RETURNED" ? new Date() : undefined;
      await warehouseRepository.updateItemState(current.id, {
        status: statusChanged ? nextStatus : undefined,
        conditionNotes,
        storageCode,
        returnedAt
      }, connection);
      await warehouseRepository.createStorageLog({
        id: id(),
        warehouseItemId: current.id,
        postId: current.postId,
        handoverPointId: current.handoverPointId,
        actorId,
        action,
        fromStatus: statusChanged ? current.status : current.status,
        toStatus: nextStatus,
        conditionNotes: conditionNotes ?? current.conditionNotes,
        storageCode: nextStorageCode,
        note: clean(input.note)
      }, connection);
    });

    const item = await warehouseRepository.findItemById(itemId);
    if (!item) throw new HttpError(404, "Khong tim thay vat pham trong kho");
    return item;
  },

  async listLogs(itemId: string) {
    if (!await warehouseRepository.findItemById(itemId)) throw new HttpError(404, "Khong tim thay vat pham trong kho");
    return warehouseRepository.listLogs(itemId);
  }
};
