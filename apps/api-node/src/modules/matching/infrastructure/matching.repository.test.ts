import assert from "node:assert/strict";
import test from "node:test";
import { matchingRepository, pool } from "../../../test/persistence-fixtures.js";

type MutablePool = {
  execute: (sql: string, values?: unknown[]) => Promise<[unknown, unknown]>;
};

async function captureQuery(run: () => Promise<unknown>) {
  const mutablePool = pool as unknown as MutablePool;
  const originalExecute = mutablePool.execute;
  let query = "";
  let values: unknown[] | undefined;
  mutablePool.execute = async (sql, parameters) => {
    query = sql.replace(/\s+/g, " ").trim();
    values = parameters;
    return [[], []];
  };
  try {
    await run();
    return { query, values };
  } finally {
    mutablePool.execute = originalExecute;
  }
}

test("saved matching history includes inactive posts but excludes deleted posts on both sides", async () => {
  const captured = await captureQuery(() => matchingRepository.listForPost("post-id", 0.45));

  assert.match(captured.query, /INNER JOIN posts lost_post/);
  assert.match(captured.query, /INNER JOIN posts found_post/);
  assert.match(captured.query, /lost_post\.deleted_at IS NULL/);
  assert.match(captured.query, /found_post\.deleted_at IS NULL/);
  assert.doesNotMatch(captured.query, /status IN/);
  assert.deepEqual(captured.values, ["", "post-id", "post-id", "post-id", 0.45, "", "post-id"]);
});

test("my-post matching summaries count only active LOST and FOUND pairs", async () => {
  const captured = await captureQuery(() => matchingRepository.listSummaries(["post-a", "post-b"], 0.45));

  assert.equal((captured.query.match(/INNER JOIN posts lost_post/g) ?? []).length, 2);
  assert.equal((captured.query.match(/INNER JOIN posts found_post/g) ?? []).length, 2);
  assert.equal((captured.query.match(/lost_post\.status IN \('OPEN', 'MATCHED'\)/g) ?? []).length, 2);
  assert.equal((captured.query.match(/found_post\.status IN \('OPEN', 'MATCHED'\)/g) ?? []).length, 2);
  assert.deepEqual(captured.values, [0.45, "post-a", "post-b", 0.45, "post-a", "post-b", 0.45]);
});

test("feedback and dismissal reject correlation key collisions with a controlled conflict", async () => {
  const common = { id: "record", matchId: "match", userId: "user", sourcePostId: "post", correlationKey: "reused-key" };
  for (const write of [
    () => matchingRepository.saveFeedback({ ...common, value: "USEFUL", note: null }),
    () => matchingRepository.saveDismissal({ ...common, reason: null })
  ]) {
    await assert.rejects(captureQuery(write), (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "conflict");
  }
});

test("dismissed matches stay excluded and equal scores have a stable tie breaker", async () => {
  const { query, values } = await captureQuery(() => matchingRepository.listForPost("post", 0.45, "owner"));
  assert.match(query, /NOT EXISTS \(SELECT 1 FROM match_suggestion_dismissals/);
  assert.match(query, /ORDER BY mr.total_score DESC, mr.updated_at DESC, mr.id ASC/);
  assert.deepEqual(values, ["owner", "post", "post", "post", 0.45, "owner", "post"]);
});

test("worker completion, failure and heartbeat require the unexpired current lease", async () => {
  const job = { postId: "post", requestedVersion: 1, correlationKey: "request", leaseToken: "worker-token" };
  for (const run of [() => matchingRepository.completeRefreshJob(job), () => matchingRepository.failRefreshJob(job, "FAIL"), () => matchingRepository.renewRefreshJob(job, 15)]) {
    const { query, values } = await captureQuery(run);
    assert.match(query, /lease_token = \? AND lease_expires_at > UTC_TIMESTAMP\(6\)/);
    assert.deepEqual(values?.slice(-2), [job.postId, job.leaseToken]);
  }
});
