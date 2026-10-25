export type { WarehouseStatus } from "../domain/warehouse-policy.js";
import type { IntakeEvidenceInput } from "./intake-evidence.dto.js";
import type { ImageUpload } from "../../../shared/domain/upload.js";


export type ListWarehouseItemsQuery = { overdue?: boolean; page: number; pageSize: number; status?: "EXPIRED" | "PENDING_APPROVAL" | "RECEIVED" | "STORED" | "CLAIMED" | "RETURNED" | "DISPOSED" | "DONATED" | "TRANSFERRED" | undefined; q?: string | undefined; handoverPointId?: string | undefined; };

export type CreateWarehouseItemInput = IntakeEvidenceInput & { handoverPointId: string; itemName: string; conditionNotes: string; description?: string | null | undefined; areaId?: string | null | undefined; buildingId?: string | null | undefined; categoryId?: string | null | undefined; roomText?: string | null | undefined; postId?: string | null | undefined; finderName?: string | null | undefined; finderContact?: string | null | undefined; storageCode?: string | null | undefined; receivedAt?: Date | undefined; };

export type UpdateWarehouseItemInput = { status?: "EXPIRED" | "PENDING_APPROVAL" | "RECEIVED" | "STORED" | "CLAIMED" | "RETURNED" | "DISPOSED" | "DONATED" | "TRANSFERRED" | undefined; note?: string | null | undefined; conditionNotes?: string | null | undefined; storageCode?: string | null | undefined; };

export type ReturnWarehouseItemInput = {
  claimId?: string | null;
  recipientId?: string | null;
  receiverName: string;
  receiverIdentity: string;
  receiverPhone: string;
  proofImage: string;
  note?: string | null | undefined;
};

export type WarehouseConversationMessage = { role: "user" | "assistant"; content: string };
export type WarehouseIntakeConversationAnalysis = {
  mode: "INTAKE";
  fields: {
    itemName: string | null;
    description: string | null;
    categoryName: string | null;
    areaName: string | null;
    buildingName: string | null;
    roomText: string | null;
    finderName: string | null;
    finderContact: string | null;
    conditionNotes: string | null;
    accessories: string | null;
    receivedQuantity: number | null;
  };
  accepted: boolean;
  rejectionReason: string | null;
  assistantMessage: string;
  warnings: string[];
};
export type WarehouseReturnConversationAnalysis = {
  mode: "RETURN";
  fields: {
    receiverName: string | null;
    receiverPhone: string | null;
    receiverIdentity: string | null;
    note: string | null;
  };
  claimCandidateIndex: number | null;
  accepted: boolean;
  rejectionReason: string | null;
  assistantMessage: string;
  warnings: string[];
};
export type WarehouseConversationAnalysis = WarehouseIntakeConversationAnalysis | WarehouseReturnConversationAnalysis;

export type WarehouseIntakeConversationExtraction = Omit<WarehouseIntakeConversationAnalysis["fields"], "categoryName" | "areaName" | "buildingName"> & {
  categoryId: string | null;
  areaId: string | null;
  buildingId: string | null;
};
export type WarehouseReturnConversationExtraction = WarehouseReturnConversationAnalysis["fields"] & {
  matchedClaim: { claimId: string; recipientId: string; fullName: string; verified: boolean } | null;
};
export type WarehouseConversationExtractionInput = {
  mode: "INTAKE" | "RETURN";
  intakeKind?: "WALK_IN" | "CUSTODY_REQUEST";
  messages: WarehouseConversationMessage[];
  warehouseItemId?: string;
  images?: ImageUpload[];
};
export type WarehouseConversationExtraction =
  | { mode: "INTAKE"; fields: WarehouseIntakeConversationExtraction; assistantMessage: string; warnings: string[] }
  | { mode: "RETURN"; fields: WarehouseReturnConversationExtraction; assistantMessage: string; warnings: string[] };
