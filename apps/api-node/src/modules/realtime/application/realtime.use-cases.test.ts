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
  assert.equal(service.stats().notificationSubscriptions, 1);
  assert.match(sink.chunks.join(""), /realtime\.connected/);
  assert.match(sink.chunks.join(""), /"notifications":"\/api\/notifications"/);
  connection.cleanup();
  assert.deepEqual(service.stats(), { connections: 0, notificationSubscriptions: 0, roomSubscriptions: 0 });
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
  assert.deepEqual(service.stats(), { connections: 0, notificationSubscriptions: 0, roomSubscriptions: 0 });
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
  assert.deepEqual(service.stats(), { connections: 1, notificationSubscriptions: 1, roomSubscriptions: 1 });
  second.cleanup();
});

test("workflow notifications are scoped to the affected user and deduped per connection", async () => {
  const service = createRealtimeUseCases({
    id: (() => { let next = 0; return () => `connection-${++next}`; })(),
    claimRepository: { async findRoomForParticipant() { return { id: "claim-a" } as never; } }
  });
  const target = responseSink();
  const other = responseSink();
  await service.connect({ userId: "user-a", roomIds: ["room-a"], response: target.response });
  await service.connect({ userId: "user-b", roomIds: ["room-a"], response: other.response, authorized: true });

  const notification = {
    id: "notification-a",
    type: "CHAT_MESSAGE_RECEIVED" as const,
    title: "Ban co tin nhan moi",
    body: "Mo phong trao doi rieng de xem noi dung.",
    entityType: "CLAIM",
    entityId: "claim-a",
    isRead: false,
    readAt: null,
    createdAt: "2026-09-16T00:00:00.000Z"
  };
  assert.deepEqual(service.publishNotification({ userId: "user-a", roomId: "room-a", workflow: "CHAT", notification }), { delivered: 1 });
  assert.deepEqual(service.publishNotification({ userId: "user-a", roomId: "room-a", workflow: "CHAT", notification }), { delivered: 0 });

  const targetStream = target.chunks.join("");
  assert.match(targetStream, /event: workflow\.notification/);
  assert.match(targetStream, /"workflow":"CHAT"/);
  assert.match(targetStream, /"eventId":"notification-a"/);
  assert.doesNotMatch(targetStream, /secret|privateEvidence|contactInfo|serial/);
  assert.doesNotMatch(other.chunks.join(""), /workflow\.notification/);
});

test("workflow notification contract covers claim, appointment and return events", async () => {
  const workflows = ["CLAIM", "APPOINTMENT", "RETURN"] as const;
  const service = createRealtimeUseCases({
    id: (() => { let next = 0; return () => `connection-${++next}`; })(),
    claimRepository: { async findRoomForParticipant() { return { id: "claim-a" } as never; } }
  });
  const sink = responseSink();
  await service.connect({ userId: "user-a", response: sink.response });
  for (const workflow of workflows) {
    service.publishNotification({
      userId: "user-a",
      workflow,
      notification: {
        id: `notification-${workflow}`,
        type: workflow === "CLAIM" ? "CLAIM_ACCEPTED" : workflow === "APPOINTMENT" ? "APPOINTMENT_UPDATED" : "RETURN_UPDATED",
        title: `${workflow} updated`,
        body: "Open the app to view details.",
        entityType: workflow,
        entityId: `${workflow.toLowerCase()}-id`,
        isRead: false,
        readAt: null,
        createdAt: "2026-09-16T00:00:00.000Z"
      }
    });
  }
  const stream = sink.chunks.join("");
  for (const workflow of workflows) assert.match(stream, new RegExp(`"workflow":"${workflow}"`));
});

test("reconnect can receive the same persisted notification for resync without duplicate active delivery", async () => {
  let next = 0;
  const service = createRealtimeUseCases({
    id: () => `connection-${++next}`,
    claimRepository: { async findRoomForParticipant() { return { id: "claim-a" } as never; } }
  });
  const notification = {
    id: "notification-resync",
    type: "CLAIM_ACCEPTED" as const,
    title: "Claim updated",
    body: "Open the app to view details.",
    entityType: "CLAIM",
    entityId: "claim-a",
    isRead: false,
    readAt: null,
    createdAt: "2026-09-16T00:00:00.000Z"
  };
  assert.deepEqual(service.publishNotification({ userId: "user-a", workflow: "CLAIM", notification }), { delivered: 0 });
  const sink = responseSink();
  await service.connect({ userId: "user-a", response: sink.response });
  assert.deepEqual(service.publishNotification({ userId: "user-a", workflow: "CLAIM", notification }), { delivered: 1 });
  assert.match(sink.chunks.join(""), /"notifications":"\/api\/notifications"/);
});
