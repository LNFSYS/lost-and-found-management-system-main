import type { TransactionContext } from "../../../shared/application/transaction.js";
import type {
  DispositionOrderStatus,
  DispositionType,
  WarehouseStatus
} from "../domain/warehouse-policy.js";
import type { WarehouseItem } from "./warehouse.repository.port.js";

export interface LegalHoldRecord {
  id: string;
  warehouseItemId: string;
  itemName?: string;
  isActive: boolean;
  reason: string;
  appliedBy: {
    id: string;
    fullName: string | null;
  };
  appliedAt: string;
  releasedBy?: {
    id: string;
    fullName: string | null;
  } | null;
  releasedAt?: string | null;
  releaseReason?: string | null;
}

export interface DispositionOrderRecord {
  id: string;
  orderNumber: string;
  dispositionType: DispositionType;
  status: DispositionOrderStatus;
  reason: string;
  createdBy: {
    id: string;
    fullName: string | null;
  };
  approvedBy?: {
    id: string;
    fullName: string | null;
  } | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  cancelledBy?: {
    id: string;
    fullName: string | null;
  } | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  completedBy?: {
    id: string;
    fullName: string | null;
  } | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: Array<{
    id: string;
    warehouseItemId: string;
    itemName: string;
    storageCode: string | null;
    status: "PENDING" | "PROCESSED" | "REMOVED";
    processedAt: string | null;
    notes: string | null;
  }>;
  evidence?: Array<{
    id: string;
    fileUrl: string;
    fileKind: "DOCUMENT" | "PHOTO" | "CERTIFICATE";
    uploadedBy: {
      id: string;
      fullName: string | null;
    };
    description: string | null;
    createdAt: string;
  }>;
}

export interface OverdueWarehouseItemRecord extends WarehouseItem {
  daysOverdue: number;
  legalHoldCount: number;
  dispositionOrderId: string | null;
  isEligibleForDisposition: boolean;
  blockers: string[];
}

export interface DispositionRepository {
  // Legal Hold
  createLegalHold(
    data: {
      id: string;
      warehouseItemId: string;
      reason: string;
      appliedBy: string;
    },
    db?: TransactionContext
  ): Promise<void>;

  findLegalHoldById(id: string, db?: TransactionContext): Promise<LegalHoldRecord | null>;

  listActiveLegalHolds(warehouseItemId: string, db?: TransactionContext): Promise<LegalHoldRecord[]>;

  releaseLegalHold(
    id: string,
    data: {
      releasedBy: string;
      releaseReason: string;
      releasedAt: Date;
    },
    db?: TransactionContext
  ): Promise<void>;

  incrementLegalHoldCount(warehouseItemId: string, amount: number, db?: TransactionContext): Promise<void>;

  // Overdue monitoring
  listOverdueItems(query: {
    page: number;
    pageSize: number;
    q?: string;
    handoverPointId?: string;
    legalHoldOnly?: boolean;
  }): Promise<{ total: number; items: OverdueWarehouseItemRecord[] }>;

  countActiveClaimsForPost(postId: string, db?: TransactionContext): Promise<number>;

  lockDispositionOrder(orderId: string, db: TransactionContext): Promise<void>;
  lockWarehouseItem(itemId: string, db: TransactionContext): Promise<void>;

  // Disposition Orders
  generateOrderNumber(type: DispositionType): Promise<string>;

  createDispositionOrder(
    order: {
      id: string;
      orderNumber: string;
      dispositionType: DispositionType;
      status: DispositionOrderStatus;
      reason: string;
      createdBy: string;
    },
    itemIds: string[],
    db?: TransactionContext
  ): Promise<void>;

  findDispositionOrderById(id: string, db?: TransactionContext): Promise<DispositionOrderRecord | null>;

  listDispositionOrders(query: {
    status?: DispositionOrderStatus | "ALL";
    dispositionType?: DispositionType | "ALL";
    page: number;
    pageSize: number;
  }): Promise<{ total: number; items: DispositionOrderRecord[] }>;

  updateDispositionOrderStatus(
    orderId: string,
    data: {
      status: DispositionOrderStatus;
      approvedBy?: string | null;
      approvedAt?: Date | null;
      rejectionReason?: string | null;
      cancelledBy?: string | null;
      cancelledAt?: Date | null;
      cancellationReason?: string | null;
      completedBy?: string | null;
      completedAt?: Date | null;
    },
    db?: TransactionContext
  ): Promise<void>;

  attachOrderToWarehouseItems(itemIds: string[], orderId: string | null, db?: TransactionContext, expectedOrderId?: string): Promise<number>;

  addDispositionEvidence(
    evidence: Array<{
      id: string;
      dispositionOrderId: string;
      warehouseItemId?: string | null;
      fileUrl: string;
      fileKind: "DOCUMENT" | "PHOTO" | "CERTIFICATE";
      uploadedBy: string;
      description?: string | null;
    }>,
    db?: TransactionContext
  ): Promise<void>;

  markOrderItemsProcessed(
    orderId: string,
    processedItemIds: string[],
    notes?: string | null,
    db?: TransactionContext
  ): Promise<void>;

  updateWarehouseItemsStatus(
    orderId: string,
    itemIds: string[],
    status: WarehouseStatus,
    db?: TransactionContext
  ): Promise<number>;
}
