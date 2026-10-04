import assert from "node:assert/strict";
import test from "node:test";
import { createBackgroundTask, createShutdownHandler } from "./background-task.js";

test("background task coalesces ticks and stops before or during in-flight work", async () => {
  let release!: () => void;
  let calls = 0;
  const task = createBackgroundTask(async () => {
    calls++;
    await new Promise<void>(resolve => { release = resolve; });
  }, () => assert.fail("Unexpected task failure"));
  const first = task.tick();
  assert.equal(task.tick(), first);
  await Promise.resolve();
  let stopped = false;
  const stop = task.stop().then(() => { stopped = true; });
  await task.tick();
  assert.equal(stopped, false);
  release();
  await stop;
  assert.equal(calls, 1);
  await task.tick();
  assert.equal(calls, 1);
  const notStarted = createBackgroundTask(async () => { calls++; }, () => {});
  const tick = notStarted.tick();
  await notStarted.stop();
  await tick;
  assert.equal(calls, 1);
});

test("failed task settles its drain and repeated shutdown signals share one promise", async () => {
  let failures = 0, shutdowns = 0;
  const task = createBackgroundTask(async () => { throw new Error("Failure"); }, () => { failures++; });
  await task.tick();
  const shutdown = createShutdownHandler(async () => { shutdowns++; await task.stop(); });
  const first = shutdown();
  assert.equal(shutdown(), first);
  await first;
  assert.equal(failures, 1);
  assert.equal(shutdowns, 1);
});
