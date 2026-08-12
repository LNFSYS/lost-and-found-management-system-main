import { adminCatalogRepository } from "../repositories/admin-catalog.repository.js";
import { HttpError } from "../utils/http-error.js";
import { id } from "../utils/security.js";
import { normalizeVietnameseText } from "../utils/text.js";
import type {
  CreateAreaInput,
  CreateBuildingInput,
  CreateCategoryInput,
  UpdateAreaInput,
  UpdateBuildingInput,
  UpdateCategoryInput
} from "../validators/admin-catalog.validator.js";

function normalizeCatalogName(value: string) {
  return normalizeVietnameseText(value);
}

async function ensureTopLevelCategory(parentId: string) {
  const parent = await adminCatalogRepository.findCategoryById(parentId);
  if (!parent) throw new HttpError(404, "Không tìm thấy nhóm danh mục");
  if (parent.parentId) throw new HttpError(400, "Danh mục chỉ hỗ trợ 2 cấp");
  return parent;
}

export const adminCatalogService = {
  async getCatalog() {
    const [stats, categories, areas, buildings] = await Promise.all([
      adminCatalogRepository.getStats(),
      adminCatalogRepository.listCategories(),
      adminCatalogRepository.listAreas(),
      adminCatalogRepository.listBuildings()
    ]);
    return { stats, categories, areas, buildings };
  },

  async createCategory(input: CreateCategoryInput) {
    const parentId = input.parentId ?? null;
    if (parentId) await ensureTopLevelCategory(parentId);
    const nameNormalized = normalizeCatalogName(input.name);
    if (await adminCatalogRepository.findCategoryByNormalized(nameNormalized)) throw new HttpError(409, "Tên danh mục đã tồn tại");
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
    if (!current) throw new HttpError(404, "Không tìm thấy danh mục");

    let nameNormalized: string | undefined;
    if (input.name !== undefined) {
      nameNormalized = normalizeCatalogName(input.name);
      if (await adminCatalogRepository.findCategoryByNormalized(nameNormalized, categoryId)) throw new HttpError(409, "Tên danh mục đã tồn tại");
    }

    if (input.parentId !== undefined) {
      if (input.parentId === categoryId) throw new HttpError(400, "Danh mục không thể nằm trong chính nó");
      if (input.parentId !== null) {
        await ensureTopLevelCategory(input.parentId);
        if (current.childCount > 0) throw new HttpError(400, "Nhóm chính đang có danh mục con nên không thể chuyển vào nhóm khác");
      }
    }

    return adminCatalogRepository.updateCategory(categoryId, { ...input, nameNormalized });
  },

  async deleteCategory(categoryId: string) {
    const current = await adminCatalogRepository.findCategoryById(categoryId);
    if (!current) throw new HttpError(404, "Không tìm thấy danh mục");
    if (current.childCount > 0) throw new HttpError(409, "Nhóm danh mục đang có danh mục con, hãy xóa hoặc chuyển các danh mục con trước");
    if (await adminCatalogRepository.countCategoryReferences(categoryId)) throw new HttpError(409, "Danh mục đang được sử dụng trong dữ liệu hệ thống, hãy ẩn thay vì xóa");
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
    if (!current) throw new HttpError(404, "Không tìm thấy khu vực");
    return adminCatalogRepository.updateArea(areaId, input);
  },

  async deleteArea(areaId: string) {
    const current = await adminCatalogRepository.findAreaById(areaId);
    if (!current) throw new HttpError(404, "Không tìm thấy khu vực");
    if (current.buildingCount > 0) throw new HttpError(409, "Khu vực đang có địa điểm cụ thể, hãy xóa hoặc chuyển địa điểm trước");
    if (await adminCatalogRepository.countAreaReferences(areaId)) throw new HttpError(409, "Khu vực đang được sử dụng trong dữ liệu hệ thống, hãy ẩn thay vì xóa");
    await adminCatalogRepository.deleteArea(areaId);
  },

  async createBuilding(input: CreateBuildingInput) {
    if (!await adminCatalogRepository.findAreaById(input.areaId)) throw new HttpError(404, "Không tìm thấy khu vực");
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
    if (!current) throw new HttpError(404, "Không tìm thấy địa điểm");
    if (input.areaId !== undefined && !await adminCatalogRepository.findAreaById(input.areaId)) throw new HttpError(404, "Không tìm thấy khu vực");
    return adminCatalogRepository.updateBuilding(buildingId, input);
  },

  async deleteBuilding(buildingId: string) {
    const current = await adminCatalogRepository.findBuildingById(buildingId);
    if (!current) throw new HttpError(404, "Không tìm thấy địa điểm");
    if (await adminCatalogRepository.countBuildingReferences(buildingId)) throw new HttpError(409, "Địa điểm đang được sử dụng trong dữ liệu hệ thống, hãy ẩn thay vì xóa");
    await adminCatalogRepository.deleteBuilding(buildingId);
  }
};
