import { AppError } from "../../../shared/domain/app-error.js";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { IntakeEvidenceInput } from "./intake-evidence.dto.js";
import type { WarehouseRepository } from "./warehouse.repository.port.js";

export function validateIntakeEvidence(input: IntakeEvidenceInput) {
  if (input.physicalReviewConfirmed !== true) throw new AppError("invalid_input", "Cần xác nhận đã đối chiếu vật phẩm thực tế tại quầy");
  if (!input.intakeKey || !Array.isArray(input.intakeImageIds) || input.intakeImageIds.length < 1 || input.intakeImageIds.length > 5
    || new Set(input.intakeImageIds).size !== input.intakeImageIds.length) throw new AppError("invalid_input", "Cần từ 1 đến 5 ảnh tình trạng do Staff tải lên");
  if (!Number.isInteger(input.receivedQuantity) || input.receivedQuantity < 1 || input.receivedQuantity > 999) throw new AppError("invalid_input", "Số lượng thực nhận phải từ 1 đến 999");
  if (!input.accessories?.trim() || input.accessories.trim().length > 2000) throw new AppError("invalid_input", "Cần mô tả phụ kiện thực nhận; ghi Không có nếu không có phụ kiện");
}

// Sorting object keys makes MySQL's JSON normalization irrelevant to exact replay.
export function intakeFingerprint(value: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b))));
}

export async function prepareIntakeEvidence(repository: WarehouseRepository, input: IntakeEvidenceInput, actorId: string,
  custodyRequestId: string | null, payload: string, db: TransactionContext) {
  validateIntakeEvidence(input);
  const session = await repository.lockIntakeSession(input.intakeKey, db);
  if (!session || session.actorId !== actorId || session.custodyRequestId !== custodyRequestId) throw new AppError("conflict", "Ảnh tiếp nhận không thuộc phiên đối chiếu của Staff này");
  if (session.warehouseItemId) {
    const saved = session.requestPayload ? intakeFingerprint(JSON.parse(session.requestPayload)) : null;
    if (saved !== payload) throw new AppError("conflict", "Phiên tiếp nhận đã xác nhận với nội dung khác");
    return session.warehouseItemId;
  }
  if (Date.parse(session.createdAt) < Date.now() - 72 * 3600000) throw new AppError("conflict", "Phiên tiếp nhận đã hết hạn");
  const images = await repository.listIntakeImages(input.intakeKey, db);
  if (images.length !== input.intakeImageIds.length || images.some(image => !input.intakeImageIds.includes(image.id) || image.uploaderId !== actorId
    || Date.parse(image.uploadedAt) < Date.now() - 72 * 3600000)) throw new AppError("conflict", "Ảnh tiếp nhận không hợp lệ, đã hết hạn hoặc thiếu ảnh trong phiên");
  return null;
}

export function serializeWarehouseImage({ storageRef: _private, format: _format, ...image }: import("./intake-evidence.dto.js").WarehouseImageRecord) {
  return { ...image, url: `/staff/warehouse-images/${image.id}?provenance=${image.provenance}` };
}
