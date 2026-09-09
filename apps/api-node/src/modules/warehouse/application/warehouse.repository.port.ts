import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { WarehouseStatus } from "./warehouse.dto.js";

export type StorageLogAction = WarehouseStatus | "OVERDUE_MARKED" | "CONDITION_UPDATED";

export interface WarehouseItem {
  id: string;
  postId: string | null;
  handoverPoint: {
    id: string;
    name: string | null;
    address: string | null;
  } | null;
  itemName: string;
  description: string | null;
  category: {
    id: string;
    name: string | null;
  } | null;
  location: {
    area: {
      id: string;
      name: string | null;
    } | null;
    building: {
      id: string;
      name: string | null;
    } | null;
    roomText: string | null;
  };
  finder: {
    userId: string | null;
    userName: string | null;
    name: string | null;
    contact: string | null;
  };
  status: WarehouseStatus;
  conditionNotes: string | null;
  storageCode: string | null;
  receivedAt: string;
  returnedAt: string | null;
  retentionDeadline: string | null;
  createdBy: {
    id: string;
    fullName: string | null;
  };
  createdAt: string;
  updatedAt: string;
  logCount: number;
}

export interface WarehouseStorageLog {
  id: string;
  warehouseItemId: string | null;
  postId: string | null;
  handoverPoint: {
    id: string;
    name: string | null;
  } | null;
  actor: {
    id: string;
    fullName: string | null;
  };
  action: StorageLogAction;
  fromStatus: string | null;
  toStatus: string | null;
  conditionNotes: string | null;
  storageCode: string | null;
  note: string | null;
  createdAt: string;
}

export interface WarehouseDashboardStats {
  totalItems: number;
  activeItems: number;
  receivedItems: number;
  storedItems: number;
  returnedItems: number;
  overdueItems: number;
}

export interface HandoverItemCount {
  handoverPointId: string;
  name: string;
  address: string;
  itemCount: number;
  storedCount: number;
  overdueCount: number;
}

export interface WarehouseCatalog {
  categories: Array<{
    id: string;
    name: string;
    parentId: string | null;
  }>;
  areas: Array<{
    id: string;
    name: string;
  }>;
  buildings: Array<{
    id: string;
    areaId: string;
    name: string;
  }>;
  handoverPoints: Array<{
    id: string;
    name: string;
    address: string;
    openingHours: string | null;
  }>;
}

export interface WarehouseItemLock {
  id: string;
  postId: string | null;
  handoverPointId: string;
  status: WarehouseStatus;
  conditionNotes: string | null;
  storageCode: string | null;
}

export interface WarehouseRepository {
  getCatalog(): Promise<WarehouseCatalog>;
  getStats(): Promise<WarehouseDashboardStats>;
  listHandoverCounts(): Promise<HandoverItemCount[]>;
  listItems(input: {
    q?: string;
    status?: WarehouseStatus;
    handoverPointId?: string;
    page: number;
    pageSize: number;
  }): Promise<{
    total: number;
    items: WarehouseItem[];
  }>;
  findItemById(itemId: string, db?: TransactionContext): Promise<WarehouseItem | null>;
  lockItemForUpdate(itemId: string, connection: TransactionContext): Promise<WarehouseItemLock | null>;
  createItem(input: {
    id: string;
    postId?: string | null;
    handoverPointId: string;
    itemName: string;
    description?: string | null;
    categoryId?: string | null;
    areaId?: string | null;
    buildingId?: string | null;
    roomText?: string | null;
    finderName?: string | null;
    finderContact?: string | null;
    conditionNotes: string;
    storageCode?: string | null;
    receivedAt: Date;
    retentionDeadline: Date;
    createdBy: string;
  }, db?: TransactionContext): Promise<void>;
  updateItemState(itemId: string, input: {
    status?: WarehouseStatus;
    conditionNotes?: string | null;
    storageCode?: string | null;
    returnedAt?: Date | null;
  }, db?: TransactionContext): Promise<void>;
  createStorageLog(input: {
    id: string;
    warehouseItemId: string;
    postId?: string | null;
    handoverPointId: string;
    actorId: string;
    action: StorageLogAction;
    fromStatus?: string | null;
    toStatus?: string | null;
    conditionNotes?: string | null;
    storageCode?: string | null;
    note?: string | null;
  }, db?: TransactionContext): Promise<void>;
  listLogs(itemId: string): Promise<WarehouseStorageLog[]>;
  findHandoverPointById(id: string): Promise<string>;
  findAreaById(id: string): Promise<string>;
  findBuildingById(id: string): Promise<{
    id: string;
    areaId: string;
  } | null>;
  findPostById(id: string): Promise<string>;
  findCategoryNames(id: string): Promise<{
    id: string;
    name: string;
    parentName: string | null;
  } | null>;
  getConfigInt(key: string, fallback: number): Promise<number>;
}
