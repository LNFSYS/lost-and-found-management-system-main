import { AppError } from "../../../shared/domain/app-error.js";
import { normalizeVietnameseText } from "../../../shared/domain/text.js";
import type {
  CreateAreaInput,
  CreateBuildingInput,
  CreateCategoryInput,
  CreateHandoverPointInput,
  UpdateAreaInput,
  UpdateBuildingInput,
  UpdateCategoryInput,
  UpdateHandoverPointInput
} from "./admin-catalog.dto.js";
import type { AdminCatalogRepository } from "./admin-catalog.repository.port.js";
import type { AdminAuditRepository } from "./admin-audit.repository.port.js";

function normalizeCatalogName(value: string) {
  return normalizeVietnameseText(value);
}

export interface AdminCatalogDependencies {
  adminCatalogRepository: AdminCatalogRepository;
  auditRepository?: AdminAuditRepository;
  id: () => string;
}
export function createAdminCatalogUseCases(options: AdminCatalogDependencies) {
  const { adminCatalogRepository, id } = options;

  async function recordAudit(
    actorId: string | undefined,
    action: string,
    targetType: string,
    targetId: string | null,
    beforeState: Record<string, unknown> | null,
    afterState: Record<string, unknown> | null
  ) {
    if (!options.auditRepository) return;
    try {
      await options.auditRepository.record({
        id: id(),
        actorId: actorId || "system",
        action,
        targetType,
        targetId,
        beforeState,
        afterState,
        reason: null
      });
    } catch {
      // Non-blocking audit failure
    }
  }

  async function ensureTopLevelCategory(parentId: string) {
    const parent = await adminCatalogRepository.findCategoryById(parentId);
    if (!parent) throw new AppError("not_found", "Không tìm thấy nhóm danh mục");
    if (parent.parentId) throw new AppError("bad_request", "Danh mục chỉ hỗ trợ 2 cấp");
    return parent;
  }

  async function validateHandoverLocation(areaId: string | null, buildingId: string | null) {
    if (areaId && !await adminCatalogRepository.findAreaById(areaId)) throw new AppError("not_found", "Không tìm thấy khu vực");
    if (!buildingId) return;
    if (!areaId) throw new AppError("invalid_input", "Cần chọn khu vực trước khi chọn địa điểm cụ thể");
    const building = await adminCatalogRepository.findBuildingById(buildingId);
    if (!building) throw new AppError("not_found", "Không tìm thấy địa điểm cụ thể");
    if (building.areaId !== areaId) throw new AppError("invalid_input", "Địa điểm cụ thể không thuộc khu vực đã chọn");
  }

  const adminCatalogService = {
    async getCatalog() {
      const [stats, categories, areas, buildings, handoverPoints] = await Promise.all([
        adminCatalogRepository.getStats(),
        adminCatalogRepository.listCategories(),
        adminCatalogRepository.listAreas(),
        adminCatalogRepository.listBuildings(),
        adminCatalogRepository.listHandoverPoints()
      ]);
      return { stats, categories, areas, buildings, handoverPoints };
    },

    async getPublicHandoverPoints() {
      const points = await adminCatalogRepository.listHandoverPoints(true);
      return points.map(({ activeAppointments: _activeAppointments, createdAt: _createdAt, ...point }) => point);
    },

    async createCategory(input: CreateCategoryInput, actorId?: string) {
      const parentId = input.parentId ?? null;
      if (parentId) await ensureTopLevelCategory(parentId);
      const nameNormalized = normalizeCatalogName(input.name);
      if (await adminCatalogRepository.findCategoryByNormalized(nameNormalized)) throw new AppError("conflict", "Tên danh mục đã tồn tại");
      const created = await adminCatalogRepository.createCategory({
        id: id(),
        name: input.name,
        nameNormalized,
        icon: input.icon ?? null,
        parentId,
        isActive: input.isActive,
        sortOrder: input.sortOrder
      });
      if (created) {
        await recordAudit(actorId, "ADMIN_CATEGORY_CREATED", "CATEGORY", created.id, null, created as unknown as Record<string, unknown>);
      }
      return created;
    },

    async updateCategory(categoryId: string, input: UpdateCategoryInput, actorId?: string) {
      const current = await adminCatalogRepository.findCategoryById(categoryId);
      if (!current) throw new AppError("not_found", "Không tìm thấy danh mục");

      let nameNormalized: string | undefined;
      if (input.name !== undefined) {
        nameNormalized = normalizeCatalogName(input.name);
        if (await adminCatalogRepository.findCategoryByNormalized(nameNormalized, categoryId)) throw new AppError("conflict", "Tên danh mục đã tồn tại");
      }

      if (input.parentId !== undefined) {
        if (input.parentId === categoryId) throw new AppError("bad_request", "Danh mục không thể nằm trong chính nó");
        if (input.parentId !== null) {
          await ensureTopLevelCategory(input.parentId);
          if (current.childCount > 0) throw new AppError("bad_request", "Nhóm chính đang có danh mục con nên không thể chuyển vào nhóm khác");
        }
      }

      const updated = await adminCatalogRepository.updateCategory(categoryId, { ...input, nameNormalized });
      await recordAudit(actorId, "ADMIN_CATEGORY_UPDATED", "CATEGORY", categoryId, current as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
      return updated;
    },

    async deleteCategory(categoryId: string, actorId?: string) {
      const current = await adminCatalogRepository.findCategoryById(categoryId);
      if (!current) throw new AppError("not_found", "Không tìm thấy danh mục");
      if (current.childCount > 0) throw new AppError("conflict", "Nhóm danh mục đang có danh mục con, hãy xóa hoặc chuyển các danh mục con trước");
      if (await adminCatalogRepository.countCategoryReferences(categoryId)) throw new AppError("conflict", "Danh mục đang được sử dụng trong dữ liệu hệ thống, hãy ẩn thay vì xóa");
      await adminCatalogRepository.deleteCategory(categoryId);
      await recordAudit(actorId, "ADMIN_CATEGORY_DELETED", "CATEGORY", categoryId, current as unknown as Record<string, unknown>, null);
    },

    async createArea(input: CreateAreaInput, actorId?: string) {
      const created = await adminCatalogRepository.createArea({
        id: id(),
        name: input.name,
        description: input.description ?? null,
        isActive: input.isActive,
        sortOrder: input.sortOrder
      });
      if (created) {
        await recordAudit(actorId, "ADMIN_AREA_CREATED", "AREA", created.id, null, created as unknown as Record<string, unknown>);
      }
      return created;
    },

    async updateArea(areaId: string, input: UpdateAreaInput, actorId?: string) {
      const current = await adminCatalogRepository.findAreaById(areaId);
      if (!current) throw new AppError("not_found", "Không tìm thấy khu vực");
      const updated = await adminCatalogRepository.updateArea(areaId, input);
      await recordAudit(actorId, "ADMIN_AREA_UPDATED", "AREA", areaId, current as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
      return updated;
    },

    async deleteArea(areaId: string, actorId?: string) {
      const current = await adminCatalogRepository.findAreaById(areaId);
      if (!current) throw new AppError("not_found", "Không tìm thấy khu vực");
      if (current.buildingCount > 0) throw new AppError("conflict", "Khu vực đang có địa điểm cụ thể, hãy xóa hoặc chuyển địa điểm trước");
      if (await adminCatalogRepository.countAreaReferences(areaId)) throw new AppError("conflict", "Khu vực đang được sử dụng trong dữ liệu hệ thống, hãy ẩn thay vì xóa");
      await adminCatalogRepository.deleteArea(areaId);
      await recordAudit(actorId, "ADMIN_AREA_DELETED", "AREA", areaId, current as unknown as Record<string, unknown>, null);
    },

    async createBuilding(input: CreateBuildingInput, actorId?: string) {
      if (!await adminCatalogRepository.findAreaById(input.areaId)) throw new AppError("not_found", "Không tìm thấy khu vực");
      const created = await adminCatalogRepository.createBuilding({
        id: id(),
        areaId: input.areaId,
        name: input.name,
        isActive: input.isActive,
        sortOrder: input.sortOrder
      });
      if (created) {
        await recordAudit(actorId, "ADMIN_BUILDING_CREATED", "BUILDING", created.id, null, created as unknown as Record<string, unknown>);
      }
      return created;
    },

    async updateBuilding(buildingId: string, input: UpdateBuildingInput, actorId?: string) {
      const current = await adminCatalogRepository.findBuildingById(buildingId);
      if (!current) throw new AppError("not_found", "Không tìm thấy địa điểm");
      if (input.areaId !== undefined && !await adminCatalogRepository.findAreaById(input.areaId)) throw new AppError("not_found", "Không tìm thấy khu vực");
      const updated = await adminCatalogRepository.updateBuilding(buildingId, input);
      await recordAudit(actorId, "ADMIN_BUILDING_UPDATED", "BUILDING", buildingId, current as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
      return updated;
    },

    async deleteBuilding(buildingId: string, actorId?: string) {
      const current = await adminCatalogRepository.findBuildingById(buildingId);
      if (!current) throw new AppError("not_found", "Không tìm thấy địa điểm");
      if (await adminCatalogRepository.countBuildingReferences(buildingId)) throw new AppError("conflict", "Địa điểm đang được sử dụng trong dữ liệu hệ thống, hãy ẩn thay vì xóa");
      await adminCatalogRepository.deleteBuilding(buildingId);
      await recordAudit(actorId, "ADMIN_BUILDING_DELETED", "BUILDING", buildingId, current as unknown as Record<string, unknown>, null);
    },

    async createHandoverPoint(actorId: string, input: CreateHandoverPointInput) {
      const areaId = input.areaId ?? null;
      const buildingId = input.buildingId ?? null;
      await validateHandoverLocation(areaId, buildingId);
      const created = await adminCatalogRepository.createHandoverPoint({
        id: id(),
        name: input.name,
        address: input.address,
        areaId,
        buildingId,
        openingHours: input.openingHours ?? null,
        contactInfo: input.contactInfo ?? null,
        mapImageUrl: input.mapImageUrl ?? null,
        mapPositionX: input.mapPositionX ?? null,
        mapPositionY: input.mapPositionY ?? null,
        isActive: input.isActive,
        createdBy: actorId
      });
      if (created) {
        await recordAudit(actorId, "ADMIN_HANDOVER_POINT_CREATED", "HANDOVER_POINT", created.id, null, created as unknown as Record<string, unknown>);
      }
      return created;
    },

    async updateHandoverPoint(pointId: string, input: UpdateHandoverPointInput, actorId?: string) {
      const current = await adminCatalogRepository.findHandoverPointById(pointId);
      if (!current) throw new AppError("not_found", "Không tìm thấy điểm bàn giao");
      const areaId = input.areaId !== undefined ? input.areaId : current.areaId;
      const buildingId = input.buildingId !== undefined ? input.buildingId : current.buildingId;
      await validateHandoverLocation(areaId, buildingId);
      const updated = await adminCatalogRepository.updateHandoverPoint(pointId, input);
      await recordAudit(actorId, "ADMIN_HANDOVER_POINT_UPDATED", "HANDOVER_POINT", pointId, current as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
      return updated;
    },

    async updateHandoverMapImage(pointId: string, dataUrl: string, actorId?: string) {
      const current = await adminCatalogRepository.findHandoverPointById(pointId);
      if (!current) throw new AppError("not_found", "Không tìm thấy điểm bàn giao");
      const updated = await adminCatalogRepository.updateHandoverPoint(pointId, { mapImageUrl: dataUrl });
      await recordAudit(actorId, "ADMIN_HANDOVER_POINT_MAP_UPDATED", "HANDOVER_POINT", pointId, { mapImageUrl: current.mapImageUrl }, { mapImageUrl: dataUrl });
      return updated;
    },

    async deleteHandoverPoint(pointId: string, actorId?: string) {
      const current = await adminCatalogRepository.findHandoverPointById(pointId);
      if (!current) throw new AppError("not_found", "Không tìm thấy điểm bàn giao");
      if (await adminCatalogRepository.countActiveHandoverAppointments(pointId)) {
        throw new AppError("conflict", "Điểm bàn giao đang được dùng bởi lịch hẹn hoạt động; hãy tạm đóng thay vì xóa");
      }
      if (await adminCatalogRepository.countHandoverPointReferences(pointId)) {
        throw new AppError("conflict", "Điểm bàn giao đã có dữ liệu nghiệp vụ liên quan; hãy tạm đóng thay vì xóa");
      }
      await adminCatalogRepository.deleteHandoverPoint(pointId);
      await recordAudit(actorId, "ADMIN_HANDOVER_POINT_DELETED", "HANDOVER_POINT", pointId, current as unknown as Record<string, unknown>, null);
    }
  };
  return adminCatalogService;
}

export type AdminCatalogUseCases = ReturnType<typeof createAdminCatalogUseCases>;
