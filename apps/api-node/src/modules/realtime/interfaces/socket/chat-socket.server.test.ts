import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test, { type TestContext } from "node:test";
import { WebSocket } from "ws";
import { createChatSocketUseCases, type ChatMessageRecord } from "../../application/chat-socket.use-cases.js";
import { createChatSocketServer } from "./chat-socket.server.js";

const roomId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

async function startSocket(t: TestContext, options: {
  originAllowed?: (origin: string | undefined) => boolean;
  sessionValid?: boolean;
} = {}) {
  const server = createServer();
  const hub = createChatSocketUseCases();
  const origins: Array<string | undefined> = [];
  const adapter = createChatSocketServer({
    server, chatSocketService: hub,
    isOriginAllowed(origin) {
      origins.push(origin);
      return options.originAllowed?.(origin) ?? origin === "https://app.example.invalid";
    },
    verifyAccessToken: () => ({ sub: userId, email: "user@example.invalid", roles: ["USER"], sessionVersion: 1, exp: Math.floor(Date.now() / 1000) + 60 }),
    validateAccessSession: async () => options.sessionValid ?? true,
    authorizeRoom: async (user, room) => { assert.equal(user, userId); assert.equal(room, roomId); }
  });
  t.after(async () => {
    adapter.stop();
    hub.stop();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    hub, origins,
    connect(origin?: string) {
      const client = new WebSocket(`ws://127.0.0.1:${address.port}/api/realtime/chat-socket`, origin ? { origin } : {});
      client.on("error", () => { /* Rejected upgrades are asserted through their response or close event. */ });
      t.after(() => { if (client.readyState !== WebSocket.CLOSED) client.terminate(); });
      return client;
    }
  };
}

test("WebSocket uses the injected Origin policy and still delivers authorized chat messages", { timeout: 5000 }, async t => {
  const fixture = await startSocket(t);
  const client = fixture.connect("https://app.example.invalid");
  await once(client, "open");
  const ready = once(client, "message");
  client.send(JSON.stringify({ type: "authenticate", roomId, accessToken: "synthetic-access-token" }));
  assert.deepEqual(JSON.parse((await ready)[0].toString()), { type: "ready", roomId });
  const message: ChatMessageRecord = {
    id: "message-a", roomId, sender: { id: userId, fullName: "Test user" }, clientMessageId: "request-a",
    content: "Synthetic chat message", messageType: "TEXT", isRead: false, readAt: null, createdAt: "2026-10-20T00:00:00.000Z"
  };
  const received = once(client, "message");
  assert.deepEqual(await fixture.hub.publishMessage({ roomId, message }), { delivered: 1 });
  assert.deepEqual(JSON.parse((await received)[0].toString()), { type: "chat.message", roomId, message });
  assert.deepEqual(fixture.origins, ["https://app.example.invalid"]);
});

test("WebSocket denies disallowed and missing Origins before registration", { timeout: 5000 }, async t => {
  const fixture = await startSocket(t);
  for (const origin of ["https://untrusted.example.invalid", undefined]) {
    const client = fixture.connect(origin);
    const [, response] = await once(client, "unexpected-response");
    assert.equal(response.statusCode, 403);
    response.resume();
    client.terminate();
  }
  assert.deepEqual(fixture.origins, ["https://untrusted.example.invalid", undefined]);
  assert.deepEqual(fixture.hub.stats(), { connections: 0, rooms: 0 });
});

test("WebSocket still fails closed when session validation rejects an allowed Origin", { timeout: 5000 }, async t => {
  const fixture = await startSocket(t, { sessionValid: false });
  const client = fixture.connect("https://app.example.invalid");
  await once(client, "open");
  const failure = once(client, "message");
  const closed = once(client, "close");
  client.send(JSON.stringify({ type: "authenticate", roomId, accessToken: "synthetic-access-token" }));
  assert.deepEqual(JSON.parse((await failure)[0].toString()), { type: "auth_error", code: "UNAUTHENTICATED" });
  assert.equal((await closed)[0], 4401);
  assert.deepEqual(fixture.hub.stats(), { connections: 0, rooms: 0 });
});
