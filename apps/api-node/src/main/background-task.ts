export function createBackgroundTask(run: () => Promise<unknown>, onError: (error: unknown) => void) {
  let pending: Promise<void> | null = null;
  let stopped = false;
  return {
    tick() {
      if (stopped) return Promise.resolve();
      if (!pending) pending = Promise.resolve().then(async () => {
        if (!stopped) await run();
      }).catch(onError).finally(() => { pending = null; });
      return pending;
    },
    async stop() {
      stopped = true;
      await pending;
    }
  };
}

export function createShutdownHandler(stop: () => Promise<void>) {
  let pending: Promise<void> | null = null;
  return () => {
    if (!pending) pending = Promise.resolve().then(stop).catch(() => {
      console.error("shutdown_failed", { errorCode: "SHUTDOWN_FAILED" });
      process.exitCode = 1;
    });
    return pending;
  };
}
