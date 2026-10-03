import type { MatchingUseCases } from "./matching.use-cases.js";

export function createMatchingRefreshWorker(
  service: Pick<MatchingUseCases, "runPeriodicRefresh">,
  config: { intervalHours: number; batchSize: number; staleMinutes: number }
) {
  let running = false;

  return {
    async runOnce() {
      if (running) return null;
      running = true;
      try {
        return await service.runPeriodicRefresh(config);
      } finally {
        running = false;
      }
    }
  };
}
