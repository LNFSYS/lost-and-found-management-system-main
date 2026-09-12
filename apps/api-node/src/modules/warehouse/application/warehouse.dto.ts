export type { WarehouseStatus } from "../domain/warehouse-policy.js";


export type ListWarehouseItemsQuery = { page: number; pageSize: number; status?: "EXPIRED" | "PENDING_APPROVAL" | "RECEIVED" | "STORED" | "CLAIMED" | "RETURNED" | "DISPOSED" | "DONATED" | "TRANSFERRED" | undefined; q?: string | undefined; handoverPointId?: string | undefined; };

export type CreateWarehouseItemInput = { handoverPointId: string; itemName: string; conditionNotes: string; description?: string | null | undefined; areaId?: string | null | undefined; buildingId?: string | null | undefined; categoryId?: string | null | undefined; roomText?: string | null | undefined; postId?: string | null | undefined; finderName?: string | null | undefined; finderContact?: string | null | undefined; storageCode?: string | null | undefined; receivedAt?: Date | undefined; };

export type UpdateWarehouseItemInput = { status?: "EXPIRED" | "PENDING_APPROVAL" | "RECEIVED" | "STORED" | "CLAIMED" | "RETURNED" | "DISPOSED" | "DONATED" | "TRANSFERRED" | undefined; note?: string | null | undefined; conditionNotes?: string | null | undefined; storageCode?: string | null | undefined; };
