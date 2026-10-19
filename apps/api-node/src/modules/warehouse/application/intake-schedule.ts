import type { SystemConfigRepository } from "../../system-config/application/index.js";
import { parseCustodyIntakeSchedule } from "../domain/intake-schedule.js";

export async function loadCustodyIntakeSchedule(repository?: Pick<SystemConfigRepository, "findByKey">) {
  const config = await repository?.findByKey("custody.intake.schedule");
  return parseCustodyIntakeSchedule(config?.configValue);
}
