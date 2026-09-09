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

function normalizeCatalogName(value: string) {
  return normalizeVietnameseText(value);
}

export interface AdminCatalogDependencies {
  adminCatalogRepository: AdminCatalogRepository;
  id: () => string;
}
export function createAdminCatalogUseCases(options: AdminCatalogDependencies) {
  const { adminCatalogRepository, id } = options;

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

    async createCategory(input: CreateCategoryInput) {
      const parentId = input.parentId ?? null;
      if (parentId) await ensureTopLevelCategory(parentId);
      const nameNormalized = normalizeCatalogName(input.name);
      if (await adminCatalogRepository.findCategoryByNormalized(nameNormalized)) throw new AppError("conflict", "Tên danh mục đã tồn tại");
      return adminCatalogRepository.createCategory({
        id: id(),
        name: input.name,
        nameNormalized,
        icon: input.icon ?? null,
        parentId,
        isActive: input.isActive,
        sortOrder: input.sortOrder
      });
    },

    async updateCategory(categoryId: string, input: UpdateCategoryInput) {
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

      return adminCatalogRepository.updateCategory(categoryId, { ...input, nameNormalized });
    },

    async deleteCategory(categoryId: string) {
      const current = await adminCatalogRepository.findCategoryById(categoryId);
      if (!current) throw new AppError("not_found", "Không tìm thấy danh mục");
      if (current.childCount > 0) throw new AppError("conflict", "Nhóm danh mục đang có danh mục con, hãy xóa hoặc chuyển các danh mục con trước");
      if (await adminCatalogRepository.countCategoryReferences(categoryId)) throw new AppError("conflict", "Danh mục đang được sử dụng trong dữ liệu hệ thống, hãy ẩn thay vì xóa");
      await adminCatalogRepository.deleteCategory(categoryId);
    },

    async createArea(input: CreateAreaInput) {
      return adminCatalogRepository.createArea({
        id: id(),
        name: input.name,
        description: input.description ?? null,
        isActive: input.isActive,
        sortOrder: input.sortOrder
      });
    },

    async updateArea(areaId: string, input: UpdateAreaInput) {
      const current = await adminCatalogRepository.findAreaById(areaId);
      if (!current) throw new AppError("not_found", "Không tìm thấy khu vực");
      return adminCatalogRepository.updateArea(areaId, input);
    },

    async deleteArea(areaId: string) {
      const current = await adminCatalogRepository.findAreaById(areaId);
      if (!current) throw new AppError("not_found", "Không tìm thấy khu vực");
      if (current.buildingCount > 0) throw new AppError("conflict", "Khu vực đang có địa điểm cụ thể, hãy xóa hoặc chuyển địa điểm trước");
      if (await adminCatalogRepository.countAreaReferences(areaId)) throw new AppError("conflict", "Khu vực đang được sử dụng trong dữ liệu hệ thống, hãy ẩn thay vì xóa");
      await adminCatalogRepository.deleteArea(areaId);
    },

    async createBuilding(input: CreateBuildingInput) {
      if (!await adminCatalogRepository.findAreaById(input.areaId)) throw new AppError("not_found", "Không tìm thấy khu vực");
      return adminCatalogRepository.createBuilding({
        id: id(),
        areaId: input.areaId,
        name: input.name,
        isActive: input.isActive,
        sortOrder: input.sortOrder
      });
    },

    async updateBuilding(buildingId: string, input: UpdateBuildingInput) {
      const current = await adminCatalogRepository.findBuildingById(buildingId);
      if (!current) throw new AppError("not_found", "Không tìm thấy địa điểm");
      if (input.areaId !== undefined && !await adminCatalogRepository.findAreaById(input.areaId)) throw new AppError("not_found", "Không tìm thấy khu vực");
      return adminCatalogRepository.updateBuilding(buildingId, input);
    },

    async deleteBuilding(buildingId: string) {
      const current = await adminCatalogRepository.findBuildingById(buildingId);
      if (!current) throw new AppError("not_found", "Không tìm thấy địa điểm");
      if (await adminCatalogRepository.countBuildingReferences(buildingId)) throw new AppError("conflict", "Địa điểm đang được sử dụng trong dữ liệu hệ thống, hãy ẩn thay vì xóa");
      await adminCatalogRepository.deleteBuilding(buildingId);
    },

    async createHandoverPoint(actorId: string, input: CreateHandoverPointInput) {
      const areaId = input.areaId ?? null;
      const buildingId = input.buildingId ?? null;
      await validateHandoverLocation(areaId, buildingId);
      return adminCatalogRepository.createHandoverPoint({
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
    },

    async updateHandoverPoint(pointId: string, input: UpdateHandoverPointInput) {
      const current = await adminCatalogRepository.findHandoverPointById(pointId);
      if (!current) throw new AppError("not_found", "Không tìm thấy điểm bàn giao");
      const areaId = input.areaId !== undefined ? input.areaId : current.areaId;
      const buildingId = input.buildingId !== undefined ? input.buildingId : current.buildingId;
      await validateHandoverLocation(areaId, buildingId);
      return adminCatalogRepository.updateHandoverPoint(pointId, input);
    },

    async updateHandoverMapImage(pointId: string, dataUrl: string) {
      if (!await adminCatalogRepository.findHandoverPointById(pointId)) throw new AppError("not_found", "Không tìm thấy điểm bàn giao");
      return adminCatalogRepository.updateHandoverPoint(pointId, { mapImageUrl: dataUrl });
    },

    async deleteHandoverPoint(pointId: string) {
      if (!await adminCatalogRepository.findHandoverPointById(pointId)) throw new AppError("not_found", "Không tìm thấy điểm bàn giao");
      if (await adminCatalogRepository.countActiveHandoverAppointments(pointId)) {
        throw new AppError("conflict", "Điểm bàn giao đang được dùng bởi lịch hẹn hoạt động; hãy tạm đóng thay vì xóa");
      }
      if (await adminCatalogRepository.countHandoverPointReferences(pointId)) {
        throw new AppError("conflict", "Điểm bàn giao đã có dữ liệu nghiệp vụ liên quan; hãy tạm đóng thay vì xóa");
      }
      await adminCatalogRepository.deleteHandoverPoint(pointId);
    }
  };
  return adminCatalogService;
}

export type AdminCatalogUseCases = ReturnType<typeof createAdminCatalogUseCases>;
