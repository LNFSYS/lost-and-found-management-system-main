export type CreatePostInput = { type: "LOST" | "FOUND"; description: string; contactInfo: string; title: string; categoryId: string; lostFoundAt: Date; areaId?: string | null | undefined; buildingId?: string | null | undefined; analysisSignals?: { visualAttributes: string[]; visibleText: string[]; confidence: number; } | undefined; roomText?: string | null | undefined; customLocation?: string | null | undefined; handoverPointId?: string | null | undefined; visibilityMode?: "PUBLIC" | "PRIVATE_DETAILS" | undefined; };

export type UpdatePostInput = { status?: "OPEN" | "CLOSED" | "RESOLVED" | undefined; description?: string | undefined; areaId?: string | null | undefined; buildingId?: string | null | undefined; contactInfo?: string | undefined; title?: string | undefined; categoryId?: string | undefined; roomText?: string | null | undefined; customLocation?: string | null | undefined; lostFoundAt?: Date | undefined; handoverPointId?: string | null | undefined; visibilityMode?: "PUBLIC" | "PRIVATE_DETAILS" | undefined; };

export type ListPostsQuery = { sort: "newest" | "oldest" | "incident_newest" | "incident_oldest"; page: number; pageSize: number; type?: "LOST" | "FOUND" | undefined; status?: "OPEN" | "RESOLVED" | "MATCHED" | undefined; areaId?: string | undefined; buildingId?: string | undefined; q?: string | undefined; categoryId?: string | undefined; };

export type ListOwnPostsQuery = { sort: "newest" | "oldest" | "incident_newest" | "incident_oldest"; page: number; pageSize: number; type?: "LOST" | "FOUND" | undefined; status?: "OPEN" | "CLOSED" | "RESOLVED" | "MATCHED" | "EXPIRED" | undefined; areaId?: string | undefined; buildingId?: string | undefined; q?: string | undefined; categoryId?: string | undefined; };

export type UploadMediaInput = { mediaKind: "ITEM" | "EVIDENCE"; sortOrder?: number | undefined; };

export type AnalyzePostImageInput = { type: "LOST" | "FOUND"; };
