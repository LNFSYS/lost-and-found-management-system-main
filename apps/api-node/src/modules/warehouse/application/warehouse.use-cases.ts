import type { TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import { calculateRetentionDeadline, canTransitionWarehouseStatus, retentionConfigKeyForCategory, retentionFallbacks, warehouseStatusLabels } from "../domain/warehouse-policy.js";
import type {
  CreateWarehouseItemInput,
  ListWarehouseItemsQuery,
  UpdateWarehouseItemInput
} from "./warehouse.dto.js";
import type { StorageLogAction, WarehouseRepository } from "./warehouse.repository.port.js";

function clean(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function ensureNotFuture(value: Date) {
  if (value.getTime() > Date.now() + 60_000) throw new AppError("bad_request", "Thời gian tiếp nhận không được ở tương lai");
}

export interface WarehouseDependencies {
  warehouseRepository: WarehouseRepository;
  withTransaction: TransactionRunner;
  id: () => string;
}
export function createWarehouseUseCases(options: WarehouseDependencies) {
  const { warehouseRepository, withTransaction, id } = options;

  async function retentionDaysForCategory(categoryId: string | null | undefined) {
    if (!categoryId) {
      return warehouseRepository.getConfigInt("warehouse.retention_days_default", retentionFallbacks["warehouse.retention_days_default"]);
    }
    const category = await warehouseRepository.findCategoryNames(categoryId);
    if (!category) throw new AppError("not_found", "Không tìm thấy danh mục vật phẩm");
    const key = retentionConfigKeyForCategory(category);
    return warehouseRepository.getConfigInt(key, retentionFallbacks[key]);
  }

  async function resolveLocation(input: Pick<CreateWarehouseItemInput, "areaId" | "buildingId">) {
    let areaId = input.areaId ?? null;
    const buildingId = input.buildingId ?? null;
    if (buildingId) {
      const building = await warehouseRepository.findBuildingById(buildingId);
      if (!building) throw new AppError("not_found", "Không tìm thấy địa điểm");
      if (areaId && areaId !== building.areaId) throw new AppError("bad_request", "Địa điểm không thuộc khu vực đã chọn");
      areaId = building.areaId;
    }
    if (areaId && !await warehouseRepository.findAreaById(areaId)) throw new AppError("not_found", "Không tìm thấy khu vực");
    return { areaId, buildingId };
  }

  const warehouseService = {
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
      if (!await warehouseRepository.findHandoverPointById(input.handoverPointId)) throw new AppError("not_found", "Không tìm thấy điểm bàn giao");
      if (input.postId && !await warehouseRepository.findPostById(input.postId)) throw new AppError("not_found", "Không tìm thấy bài đăng liên quan");
      if (input.categoryId && !await warehouseRepository.findCategoryNames(input.categoryId)) throw new AppError("not_found", "Không tìm thấy danh mục vật phẩm");

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
          note: "Đã tiếp nhận vật phẩm"
        }, connection);
      });

      const item = await warehouseRepository.findItemById(warehouseItemId);
      if (!item) throw new AppError("internal", "Không thể đọc lại vật phẩm vừa tạo");
      return item;
    },

    async updateItem(itemId: string, input: UpdateWarehouseItemInput, actorId: string) {
      let action: StorageLogAction = "CONDITION_UPDATED";
      await withTransaction(async (connection) => {
        const current = await warehouseRepository.lockItemForUpdate(itemId, connection);
        if (!current) throw new AppError("not_found", "Không tìm thấy vật phẩm trong kho");

        const nextStatus = input.status ?? current.status;
        const statusChanged = input.status !== undefined && input.status !== current.status;
        if (statusChanged && !canTransitionWarehouseStatus(current.status, nextStatus)) {
          throw new AppError("bad_request", `Không thể chuyển trạng thái từ ${warehouseStatusLabels[current.status]} sang ${warehouseStatusLabels[nextStatus]}`);
        }

        const conditionNotes = input.conditionNotes !== undefined ? clean(input.conditionNotes) : undefined;
        const storageCode = input.storageCode !== undefined ? clean(input.storageCode) : undefined;
        const nextStorageCode = storageCode !== undefined ? storageCode : current.storageCode;
        if (nextStatus === "STORED" && !nextStorageCode) throw new AppError("bad_request", "Cần mã vị trí lưu kho khi chuyển sang Đang lưu kho");

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
      if (!item) throw new AppError("not_found", "Không tìm thấy vật phẩm trong kho");
      return item;
    },

    async listLogs(itemId: string) {
      if (!await warehouseRepository.findItemById(itemId)) throw new AppError("not_found", "Không tìm thấy vật phẩm trong kho");
      return warehouseRepository.listLogs(itemId);
    }
  };
  return warehouseService;
}

export type WarehouseUseCases = ReturnType<typeof createWarehouseUseCases>;
