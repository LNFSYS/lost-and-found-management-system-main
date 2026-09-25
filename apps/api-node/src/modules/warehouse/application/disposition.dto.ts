import type { DispositionOrderStatus, DispositionType } from "../domain/warehouse-policy.js";

export interface ListOverdueItemsQuery {
  page: number;
  pageSize: number;
  q?: string;
  handoverPointId?: string;
  legalHoldOnly?: boolean;
}

export interface ApplyLegalHoldInput {
  warehouseItemId: string;
  reason: string;
}

export interface ReleaseLegalHoldInput {
  releaseReason: string;
}

export interface CreateDispositionOrderInput {
  dispositionType: DispositionType;
  reason: string;
  warehouseItemIds: string[];
}

export interface ListDispositionOrdersQuery {
  status?: DispositionOrderStatus | "ALL";
  dispositionType?: DispositionType | "ALL";
  page: number;
  pageSize: number;
}

export interface RejectDispositionOrderInput {
  reason: string;
}

export interface CancelDispositionOrderInput {
  reason: string;
}

export interface ExecuteDispositionInput {
  processedItemIds: string[];
  evidenceUrls: Array<{
    fileUrl: string;
    fileKind: "DOCUMENT" | "PHOTO" | "CERTIFICATE";
    description?: string | null;
    warehouseItemId?: string | null;
  }>;
  notes?: string | null;
}
