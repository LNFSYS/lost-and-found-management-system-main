import type { WarehouseMaintenanceSchema } from "./warehouse-maintenance-schema.js";

interface MaintenanceLogger {
  info(event: string, metadata: Record<string, unknown>): void;
  warn(event: string, metadata: Record<string, unknown>): void;
}

function safeFailure(error: unknown) {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return {
    errorCode: "WAREHOUSE_MAINTENANCE_FAILED",
    dbCode: typeof value.code === "string" && /^[A-Z0-9_]{1,64}$/.test(value.code) ? value.code : undefined,
    errno: typeof value.errno === "number" && Number.isInteger(value.errno) ? value.errno : undefined,
    sqlState: typeof value.sqlState === "string" && /^[A-Z0-9]{5}$/.test(value.sqlState) ? value.sqlState : undefined
  };
}

export function createWarehouseMaintenanceTask(options: {
  checkSchema: () => Promise<WarehouseMaintenanceSchema>;
  runOnce: () => Promise<void>;
  logger: MaintenanceLogger;
}) {
  let pending: Promise<void> | null = null;
  let stopped = false;
  let schemaReady = false;
  let lastFailure = "";

  async function performTick() {
    let phase = "SCHEMA_CHECK";
    try {
      const schema = await options.checkSchema();
      if (!schema.ready) {
        schemaReady = false;
        const signature = JSON.stringify(schema.missing);
        if (signature !== lastFailure) options.logger.warn("warehouse_maintenance_paused", {
          errorCode: "WAREHOUSE_SCHEMA_NOT_READY", missing: schema.missing,
          action: "Run migration preflight and resolve ledger blockers before applying custody migrations"
        });
        lastFailure = signature;
        return;
      }
      if (stopped) return;
      if (!schemaReady) options.logger.info("warehouse_maintenance_ready", { schemaChecked: true });
      schemaReady = true;
      phase = "MAINTENANCE";
      await options.runOnce();
      lastFailure = "";
    } catch (error) {
      if (phase === "SCHEMA_CHECK") schemaReady = false;
      const metadata = { ...safeFailure(error), phase };
      const signature = JSON.stringify(metadata);
      if (signature !== lastFailure) options.logger.warn("warehouse_maintenance_failed", metadata);
      lastFailure = signature;
    }
  }

  return {
    tick() {
      if (stopped) return Promise.resolve();
      if (!pending) pending = performTick().finally(() => { pending = null; });
      return pending;
    },
    async stop() {
      stopped = true;
      await pending;
    }
  };
}
