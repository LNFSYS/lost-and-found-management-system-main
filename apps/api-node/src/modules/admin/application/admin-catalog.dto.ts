export type CreateCategoryInput = { name: string; icon?: string | null | undefined; parentId?: string | null | undefined; isActive?: boolean | undefined; sortOrder?: number | undefined; };

export type UpdateCategoryInput = { name?: string | undefined; icon?: string | null | undefined; parentId?: string | null | undefined; isActive?: boolean | undefined; sortOrder?: number | undefined; };

export type CreateAreaInput = { name: string; isActive?: boolean | undefined; sortOrder?: number | undefined; description?: string | null | undefined; };

export type UpdateAreaInput = { name?: string | undefined; isActive?: boolean | undefined; sortOrder?: number | undefined; description?: string | null | undefined; };

export type CreateBuildingInput = { name: string; areaId: string; isActive?: boolean | undefined; sortOrder?: number | undefined; };

export type UpdateBuildingInput = { name?: string | undefined; isActive?: boolean | undefined; sortOrder?: number | undefined; areaId?: string | undefined; };

export type CreateHandoverPointInput = { name: string; address: string; isActive?: boolean | undefined; areaId?: string | null | undefined; buildingId?: string | null | undefined; openingHours?: string | null | undefined; contactInfo?: string | null | undefined; mapImageUrl?: string | null | undefined; mapPositionX?: number | null | undefined; mapPositionY?: number | null | undefined; };

export type UpdateHandoverPointInput = { name?: string | undefined; isActive?: boolean | undefined; areaId?: string | null | undefined; address?: string | undefined; buildingId?: string | null | undefined; openingHours?: string | null | undefined; contactInfo?: string | null | undefined; mapImageUrl?: string | null | undefined; mapPositionX?: number | null | undefined; mapPositionY?: number | null | undefined; };
