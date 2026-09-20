export interface AdminCategory {
  id: string;
  name: string;
  icon: string | null;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
  sortOrder: number;
  childCount: number;
  createdAt: string;
}

export interface AdminArea {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  buildingCount: number;
  createdAt: string;
}

export interface AdminBuilding {
  id: string;
  areaId: string;
  areaName: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface AdminHandoverPoint {
  id: string;
  name: string;
  address: string;
  areaId: string | null;
  areaName: string | null;
  buildingId: string | null;
  buildingName: string | null;
  openingHours: string | null;
  contactInfo: string | null;
  mapImageUrl: string | null;
  mapPositionX: number | null;
  mapPositionY: number | null;
  isActive: boolean;
  storedItems: number;
  activeAppointments: number;
  createdAt: string;
}

export interface AdminCatalogStats {
  totalPosts: number;
  processingPosts: number;
  totalUsers: number;
  returnedPosts: number;
}

export interface AdminCatalogRepository {
  getStats(): Promise<AdminCatalogStats>;
  listCategories(): Promise<AdminCategory[]>;
  findCategoryById(id: string): Promise<AdminCategory | null>;
  findCategoryByNormalized(nameNormalized: string, exceptId?: string): Promise<string>;
  createCategory(input: {
    id: string;
    name: string;
    nameNormalized: string;
    icon?: string | null;
    parentId?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<AdminCategory | null>;
  updateCategory(id: string, input: {
    name?: string;
    nameNormalized?: string;
    icon?: string | null;
    parentId?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<AdminCategory | null>;
  deleteCategory(id: string): Promise<void>;
  countCategoryReferences(id: string): Promise<number>;
  listAreas(): Promise<AdminArea[]>;
  findAreaById(id: string): Promise<AdminArea | null>;
  createArea(input: {
    id: string;
    name: string;
    description?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<AdminArea | null>;
  updateArea(id: string, input: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<AdminArea | null>;
  deleteArea(id: string): Promise<void>;
  countAreaReferences(id: string): Promise<number>;
  listBuildings(): Promise<AdminBuilding[]>;
  findBuildingById(id: string): Promise<AdminBuilding | null>;
  createBuilding(input: {
    id: string;
    areaId: string;
    name: string;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<AdminBuilding | null>;
  updateBuilding(id: string, input: {
    areaId?: string;
    name?: string;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<AdminBuilding | null>;
  deleteBuilding(id: string): Promise<void>;
  countBuildingReferences(id: string): Promise<number>;
  listHandoverPoints(activeOnly?: boolean): Promise<AdminHandoverPoint[]>;
  findHandoverPointById(id: string): Promise<AdminHandoverPoint | null>;
  createHandoverPoint(input: {
    id: string;
    name: string;
    address: string;
    areaId?: string | null;
    buildingId?: string | null;
    openingHours?: string | null;
    contactInfo?: string | null;
    mapImageUrl?: string | null;
    mapPositionX?: number | null;
    mapPositionY?: number | null;
    isActive?: boolean;
    createdBy: string;
  }): Promise<AdminHandoverPoint | null>;
  updateHandoverPoint(id: string, input: {
    name?: string;
    address?: string;
    areaId?: string | null;
    buildingId?: string | null;
    openingHours?: string | null;
    contactInfo?: string | null;
    mapImageUrl?: string | null;
    mapPositionX?: number | null;
    mapPositionY?: number | null;
    isActive?: boolean;
  }): Promise<AdminHandoverPoint | null>;
  countActiveHandoverAppointments(id: string): Promise<number>;
  countHandoverPointReferences(id: string): Promise<number>;
  deleteHandoverPoint(id: string): Promise<void>;
}
