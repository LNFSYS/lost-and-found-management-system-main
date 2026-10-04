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
  retentionDeadline: Date | null;
  legalHold: boolean;
  reservedClaimId: string | null;
}

export interface WarehouseClaimReview {
  claimId: string;
  recipientId: string;
  fullName: string;
  description: string | null;
  status: string;
  verified: boolean;
}

export interface WarehouseRepository {
  isStaff(actorId: string, db?: TransactionContext): Promise<boolean>;
  isAdmin(actorId: string, db?: TransactionContext): Promise<boolean>;
  lockPhysicalPost(postId: string, db: TransactionContext): Promise<void>;
  findCompletedReturn(itemId: string, db: TransactionContext): Promise<{
    claimId: string | null;
    recipientId: string | null;
    receiverName: string | null;
    receiverIdentity: string | null;
    receiverPhone: string | null;
    actorId: string;
    proofIds: string[];
  } | null>;
  listExpiredProofs(db: TransactionContext): Promise<Array<{ id: string; storageRef: string; }>>;
  deleteUnusedProof(id: string, db: TransactionContext): Promise<void>;
  listOverdueRequests(db: TransactionContext): Promise<Array<{ id: string; postId: string | null; claimId: string | null; requesterId: string; }>>;
  lockFoundPost(postId: string, db: TransactionContext): Promise<boolean>;
  hasItemForPost(postId: string, db: TransactionContext): Promise<boolean>;
  hasBlockingCases(postId: string | null, db: TransactionContext, completingClaimId?: string): Promise<boolean>;
  verifiedRecipient(claimId: string, postId: string | null, recipientId: string, db: TransactionContext): Promise<boolean>;
  listVerifiedRecipients(postId: string | null): Promise<Array<{ claimId: string; recipientId: string; fullName: string; }>>;
  listReturnClaimReviews(postId: string | null): Promise<WarehouseClaimReview[]>;
  lockReturnClaim(claimId: string, postId: string, db: TransactionContext): Promise<WarehouseClaimReview | null>;
  recordStaffVerification(input: { id: string; itemId: string; claimId: string; recipientId: string; actorId: string; fromStatus: string; reason: string; }, db: TransactionContext): Promise<void>;
  reserve(itemId: string, claimId: string | null, db: TransactionContext): Promise<void>;
  completeReturn(input: {
    id: string;
    itemId: string;
    claimId: string | null;
    recipientId: string | null;
    receiverName: string;
    receiverIdentity: string;
    receiverPhone: string;
    actorId: string;
    proofIds: string[];
    completedAt: Date;
  }, db: TransactionContext): Promise<string | null>;
  createProof(input: { id: string; itemId: string; actorId: string; storageRef: string; format: string; bytes: number; }): Promise<void>;
  findProof(id: string, db?: TransactionContext): Promise<{ id: string; itemId: string; actorId: string; storageRef: string; format: string; attached: boolean; } | null>;
  attachProof(id: string, db: TransactionContext): Promise<void>;
  createApproval(input: { id: string; itemId: string; actorId: string; target: "DISPOSED" | "DONATED" | "TRANSFERRED"; reason: string; }, db: TransactionContext): Promise<void>;
  lockApproval(id: string, db: TransactionContext): Promise<{ id: string; itemId: string; requesterId: string; target: "DISPOSED" | "DONATED" | "TRANSFERRED"; status: string; } | null>;
  approveAction(id: string, actorId: string, db: TransactionContext): Promise<void>;
  executeAction(id: string, db: TransactionContext): Promise<void>;
  setLegalHold(itemId: string, held: boolean, db: TransactionContext): Promise<void>;
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
  findItemByPostId(postId: string): Promise<{ id: string; status: WarehouseStatus; } | null>;
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
    finderUserId?: string | null;
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
  generateNextStorageCode(db?: TransactionContext): Promise<string>;
  findHandoverPointById(id: string): Promise<string | null>;
  findAreaById(id: string): Promise<string | null>;
  findBuildingById(id: string): Promise<{
    id: string;
    areaId: string;
  } | null>;
  findPostById(id: string): Promise<string | null>;
  updatePostStatus(id: string, status: string, db?: TransactionContext): Promise<void>;
  getPostInfoForIntake(postId: string, db?: TransactionContext): Promise<{
    title: string;
    description: string | null;
    categoryId: string | null;
    areaId: string | null;
    buildingId: string | null;
    roomText: string | null;
    finderUserId: string;
    finderName: string | null;
    finderContact: string | null;
  } | null>;
  findCategoryNames(id: string): Promise<{
    id: string;
    name: string;
    parentName: string | null;
  } | null>;
  getConfigInt(key: string, fallback: number): Promise<number>;
  listLogs(itemId: string): Promise<WarehouseStorageLog[]>;
}
