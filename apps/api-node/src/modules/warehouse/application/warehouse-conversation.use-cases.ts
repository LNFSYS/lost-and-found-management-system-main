import { AppError } from "../../../shared/domain/app-error.js";
import type { WarehouseConversationAnalyzer } from "./warehouse-conversation-analyzer.port.js";
import type { WarehouseConversationExtractionInput } from "./warehouse.dto.js";
import type { WarehouseRepository } from "./warehouse.repository.port.js";
import { assertNoProfanity } from "./warehouse-conversation-message-guard.js";
import { validateImageUpload } from "../../../shared/domain/media.js";

export function createWarehouseConversationUseCases(options: {
  warehouseRepository: WarehouseRepository;
  analyzer: WarehouseConversationAnalyzer;
}) {
  const { warehouseRepository, analyzer } = options;

  return {
    async extract(input: WarehouseConversationExtractionInput, actorId: string) {
      if (!await warehouseRepository.isStaff(actorId)) throw new AppError("forbidden", "Chỉ Staff/Admin được thao tác kho");
      assertNoProfanity(input.messages);
      const images = input.images ?? [];
      if (images.length && (input.mode !== "INTAKE" || input.intakeKind !== "WALK_IN")) {
        throw new AppError("bad_request", "Chỉ được phân tích ảnh trong chat tiếp nhận Walk-in tại quầy.");
      }
      if (images.length > 3) throw new AppError("bad_request", "Mỗi lượt chat chỉ được đính kèm tối đa 3 ảnh.");
      for (const image of images) {
        validateImageUpload(image);
        if (image.size > 5 * 1024 * 1024) throw new AppError("payload_too_large", "Mỗi ảnh chat không được vượt quá 5 MB.");
      }
      const catalog = await warehouseRepository.getCatalog();
      let claims: Awaited<ReturnType<WarehouseRepository["listReturnClaimReviews"]>> = [];

      if (input.mode === "RETURN") {
        if (!input.warehouseItemId) throw new AppError("bad_request", "Cần chọn vật phẩm kho để trích xuất thông tin trả hàng");
        const item = await warehouseRepository.findItemById(input.warehouseItemId);
        if (!item) throw new AppError("not_found", "Không tìm thấy vật phẩm");
        claims = (await warehouseRepository.listReturnClaimReviews(item.postId, item.id))
          .filter(claim => !["REJECTED", "CANCELLED"].includes(claim.status));
      }

      const analysis = await analyzer.analyze({ mode: input.mode, intakeKind: input.intakeKind, messages: input.messages, catalog, claims, images });
      if (analysis.mode !== input.mode) throw new AppError("upstream_failure", "Trợ lý AI trả về loại dữ liệu không khớp với biểu mẫu.");
      if (!analysis.accepted) {
        throw new AppError("bad_request", analysis.rejectionReason ?? "Chỉ ghi nhận nội dung liên quan đến tiếp nhận hoặc trả vật phẩm trong kho.");
      }
      if (analysis.mode === "INTAKE") {
        const warnings = [...analysis.warnings];
        const exact = <T extends { id: string; name: string }>(name: string | null, options: T[], label: string) => {
          if (!name) return null;
          const normalized = normalizeLabel(name);
          const matches = options.filter(option => normalizeLabel(option.name) === normalized);
          if (matches.length !== 1) warnings.push(`${matches.length ? `Có nhiều ${label} trùng tên` : `Không tìm thấy ${label}`} trong danh mục kho; hãy chọn lại thủ công.`);
          return matches.length === 1 ? matches[0]!.id : null;
        };
        const categoryId = exact(analysis.fields.categoryName, catalog.categories, "danh mục");
        let areaId = exact(analysis.fields.areaName, catalog.areas, "khu vực");
        const buildingOptions = catalog.buildings.filter(value => normalizeLabel(value.name) === normalizeLabel(analysis.fields.buildingName ?? ""));
        const locationMatchedBuildings = areaId ? buildingOptions.filter(value => value.areaId === areaId) : buildingOptions;
        if (analysis.fields.buildingName && locationMatchedBuildings.length !== 1) {
          warnings.push(`${locationMatchedBuildings.length ? "Có nhiều tòa nhà trùng tên" : "Không tìm thấy tòa nhà"} trong khu vực đã chọn; hãy chọn lại thủ công.`);
        }
        const buildingId = locationMatchedBuildings.length === 1 ? locationMatchedBuildings[0]!.id : null;
        if (buildingId) {
          const building = catalog.buildings.find(value => value.id === buildingId)!;
          if (areaId && areaId !== building.areaId) warnings.push("Khu vực được chỉnh theo tòa nhà đã chọn để khớp danh mục kho.");
          areaId = building.areaId;
        }
        return {
          mode: "INTAKE" as const,
          fields: {
            itemName: analysis.fields.itemName,
            description: analysis.fields.description,
            categoryId,
            areaId,
            buildingId,
            roomText: analysis.fields.roomText,
            finderName: analysis.fields.finderName,
            finderContact: analysis.fields.finderContact,
            conditionNotes: analysis.fields.conditionNotes,
            accessories: analysis.fields.accessories,
            receivedQuantity: analysis.fields.receivedQuantity
          },
          assistantMessage: analysis.assistantMessage,
          warnings: unique(warnings)
        };
      }

      const warnings = [...analysis.warnings];
      const candidate = analysis.claimCandidateIndex === null ? null : claims[analysis.claimCandidateIndex] ?? null;
      if (analysis.claimCandidateIndex !== null && !candidate) warnings.push("Không thể liên kết gợi ý với claim hợp lệ; vui lòng chọn claim thủ công.");
      if (candidate && !candidate.verified) warnings.push("AI đã gợi ý claim chưa xác minh. Nhân viên phải đối chiếu và xác minh tại quầy trước khi trả hàng.");
      return {
        mode: "RETURN" as const,
        fields: {
          ...analysis.fields,
          matchedClaim: candidate ? { claimId: candidate.claimId, recipientId: candidate.recipientId, fullName: candidate.fullName, verified: candidate.verified } : null
        },
        assistantMessage: analysis.assistantMessage,
        warnings: unique(warnings)
      };
    }
  };
}

function normalizeLabel(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[Đđ]/g, character => character === "Đ" ? "D" : "d").trim().toLowerCase();
}

function unique(values: string[]) {
  return [...new Set(values)];
}
