import assert from "node:assert/strict";
import test from "node:test";
import { createMatchingRefreshWorker } from "./matching-refresh.worker.js";

test("matching refresh worker skips overlapping ticks and runs again after completion", async () => {
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const service = {
    async runPeriodicRefresh() {
      calls += 1;
      await pending;
      return { enqueued: 1, claimed: 1, completed: 1, failed: 0 };
    }
  };
  const worker = createMatchingRefreshWorker(service as never, { intervalHours: 6, batchSize: 20, staleMinutes: 15 });

  const first = worker.runOnce();
  assert.equal(await worker.runOnce(), null);
  assert.equal(calls, 1);
  release();
  await first;
  await worker.runOnce();
  assert.equal(calls, 2);
});
