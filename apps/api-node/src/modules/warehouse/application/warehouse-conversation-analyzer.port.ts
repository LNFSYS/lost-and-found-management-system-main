import type { WarehouseCatalog, WarehouseClaimReview } from "./warehouse.repository.port.js";
import type { WarehouseConversationAnalysis, WarehouseConversationMessage } from "./warehouse.dto.js";
import type { ImageUpload } from "../../../shared/domain/upload.js";

export interface WarehouseConversationAnalyzer {
  readonly model: string;
  analyze(input: {
    mode: "INTAKE" | "RETURN";
    intakeKind?: "WALK_IN" | "CUSTODY_REQUEST";
    messages: WarehouseConversationMessage[];
    catalog: WarehouseCatalog;
    claims: WarehouseClaimReview[];
    images?: ImageUpload[];
  }): Promise<WarehouseConversationAnalysis>;
}
