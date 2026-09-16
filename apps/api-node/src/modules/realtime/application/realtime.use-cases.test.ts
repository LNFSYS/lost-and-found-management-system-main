import assert from "node:assert/strict";
import test from "node:test";
import { createRealtimeUseCases, type RealtimeConnection } from "./realtime.use-cases.js";

function responseSink() {
  const chunks: string[] = [];
  const response = {
      destroyed: false,
      write(chunk: string) { chunks.push(chunk); return true; },
      end() { this.destroyed = true; return this; }
    } as RealtimeConnection["response"];
  return {
    response,
    chunks
  };
}

test("realtime connection deduplicates room subscriptions and cleans up on disconnect", async () => {
  const service = createRealtimeUseCases({
    id: () => "connection-a",
    claimRepository: {
      async findRoomForParticipant(roomId, userId) {
        return userId === "user-a" && roomId === "room-a" ? { id: "claim-a", roomId: "room-a" } as never : null;
      }
    }
  });
  const sink = responseSink();
  const connection = await service.connect({ userId: "user-a", roomIds: ["room-a", "room-a"], response: sink.response });
  assert.equal(service.stats().connections, 1);
  assert.equal(service.stats().roomSubscriptions, 1);
  assert.match(sink.chunks.join(""), /realtime\.connected/);
  connection.cleanup();
  assert.deepEqual(service.stats(), { connections: 0, roomSubscriptions: 0 });
});

test("realtime connection rejects unauthorized rooms without retaining state", async () => {
  const service = createRealtimeUseCases({
    id: () => "connection-b",
    claimRepository: { async findRoomForParticipant() { return null; } }
  });
  await assert.rejects(
    () => service.connect({ userId: "user-a", roomIds: ["room-private"], response: responseSink().response }),
    (error: unknown) => (error as { code?: string }).code === "not_found"
  );
  assert.deepEqual(service.stats(), { connections: 0, roomSubscriptions: 0 });
});

test("realtime reconnect creates an independent connection after cleanup", async () => {
  let next = 0;
  const service = createRealtimeUseCases({
    id: () => `connection-${++next}`,
    claimRepository: {
      async findRoomForParticipant() {
        return { id: "claim-a", roomId: "room-a" } as never;
      }
    }
  });
  const first = await service.connect({ userId: "user-a", roomIds: ["room-a"], response: responseSink().response });
  first.cleanup();
  const second = await service.connect({ userId: "user-a", roomIds: ["room-a"], response: responseSink().response });
  assert.equal(second.connectionId, "connection-2");
  assert.deepEqual(service.stats(), { connections: 1, roomSubscriptions: 1 });
  second.cleanup();
});
