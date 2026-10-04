export interface IntakeEvidenceInput {
  intakeKey: string;
  intakeImageIds: string[];
  receivedQuantity: number;
  accessories: string;
  physicalReviewConfirmed: true;
}

export interface IntakeReconciliationInput {
  itemName?: string | undefined;
  description?: string | null | undefined;
  categoryId?: string | null | undefined;
  areaId?: string | null | undefined;
  buildingId?: string | null | undefined;
  roomText?: string | null | undefined;
  finderName?: string | null | undefined;
  finderContact?: string | null | undefined;
}

export type WarehouseImageProvenance = "SOURCE_POST" | "INTAKE" | "RETURN";
export interface WarehouseImageRecord {
  id: string;
  provenance: WarehouseImageProvenance;
  storageRef: string;
  format: string;
  uploaderId: string;
  uploadedAt: string;
  capturedAt: string | null;
  postId: string | null;
  intakeKey: string | null;
  returnId: string | null;
}

export interface IntakeSession {
  id: string;
  actorId: string;
  custodyRequestId: string | null;
  warehouseItemId: string | null;
  requestPayload: string | null;
  createdAt: string;
}
