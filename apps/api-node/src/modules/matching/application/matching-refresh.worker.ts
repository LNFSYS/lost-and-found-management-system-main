import type { MatchingUseCases } from "./matching.use-cases.js";

export function createMatchingRefreshWorker(
  service: Pick<MatchingUseCases, "runPeriodicRefresh">,
  config: { intervalHours: number; batchSize: number; staleMinutes: number }
) {
  let running: ReturnType<MatchingUseCases["runPeriodicRefresh"]> | null = null;
  let stopped = false;

  return {
    async runOnce() {
      if (running || stopped) return null;
      running = service.runPeriodicRefresh(config);
      try {
        return await running;
      } finally {
        running = null;
      }
    },
    async stop() {
      stopped = true;
      await running?.catch(() => undefined);
    }
  };
}
