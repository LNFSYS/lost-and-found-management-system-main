import type { DamageAnalysisResult, DamageInspectionStatus } from "../domain/damage-inspection.types.js";

export interface DamageInspectionServicePort {
  initModel(): Promise<boolean>;
  analyze(imageBuffer: Buffer): Promise<DamageAnalysisResult>;
  getStatus(): Promise<DamageInspectionStatus>;
}
