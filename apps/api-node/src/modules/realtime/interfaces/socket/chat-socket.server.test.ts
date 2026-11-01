import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { type TestContext } from "node:test";
import { io, type Socket } from "socket.io-client";
import { createChatSocketUseCases, type ChatMessageRecord } from "../../application/chat-socket.use-cases.js";
import { createChatSocketServer } from "./chat-socket.server.js";

const roomId = "11111111-1111-4111-8111-111111111111";
const otherRoomId = "33333333-3333-4333-8333-333333333333";
const userId = "22222222-2222-4222-8222-222222222222";
type Dependencies = Parameters<typeof createChatSocketServer>[0];
function event<T>(client: Socket, name: string): Promise<T> {
  return new Promise(resolve => client.once(name, resolve));
}

async function startSocket(t: TestContext, options: Partial<Pick<Dependencies, "verifyAccessToken" | "validateAccessSession" | "authorizeRoom" | "validationTimeoutMs">> = {}) {
  const server = createServer();
  const hub = createChatSocketUseCases();
  const origins: Array<string | undefined> = [];
  const adapter = createChatSocketServer({
    server, chatSocketService: hub,
    isOriginAllowed(origin) { origins.push(origin); return origin === "https://app.example.invalid"; },
    verifyAccessToken: () => ({ sub: userId, email: "user@example.invalid", roles: ["USER"], sessionVersion: 1, exp: Math.floor(Date.now() / 1000) + 60 }),
    validateAccessSession: async () => true,
    authorizeRoom: async (user, room) => { assert.equal(user, userId); assert.ok([roomId, otherRoomId].includes(room)); },
    validationTimeoutMs: 100,
    ...options
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
    hub, origins, stop: adapter.stop, server,
    connect(options: { origin?: string | null; room?: string; auth?: object; transport?: "websocket" | "polling" } = {}) {
      const origin = options.origin === undefined ? "https://app.example.invalid" : options.origin;
      const client = io(`http://127.0.0.1:${address.port}`, {
        path: "/api/realtime/chat-socket", transports: [options.transport ?? "websocket"],
        auth: options.auth ?? { accessToken: "synthetic-access-token", roomId: options.room ?? roomId },
        ...(origin ? { extraHeaders: { Origin: origin } } : {}),
        autoConnect: false, reconnection: false, forceNew: true, timeout: 2000
      });
      t.after(() => client.disconnect());
      return client;
    }
  };
}

const message: ChatMessageRecord = {
  id: "message-a", roomId, sender: { id: userId, fullName: "Test user" }, clientMessageId: "request-a",
  content: "Synthetic chat message", messageType: "TEXT", isRead: false, readAt: null, createdAt: "2026-10-20T00:00:00.000Z"
};

for (const transport of ["polling", "websocket"] as const) {
  test(`Socket.IO authenticates and scopes text/image messages over ${transport}`, { timeout: 10000 }, async t => {
    const fixture = await startSocket(t);
    const client = fixture.connect({ transport });
    const other = fixture.connect({ transport, room: otherRoomId });
    const ready = event(client, "ready");
    const otherReady = event(other, "ready");
    client.connect(); other.connect();
    assert.deepEqual(await ready, { roomId });
    await otherReady;
    const otherMessages: unknown[] = [];
    other.on("chat.message", value => otherMessages.push(value));
    for (const item of [message, { ...message, id: "image-message", messageType: "IMAGE" as const, mediaUrl: "/api/claims/synthetic/evidence/image-a" }]) {
      const received = event(client, "chat.message");
      assert.deepEqual(await fixture.hub.publishMessage({ roomId, message: item }), { delivered: 1 });
      assert.deepEqual(await received, { roomId, message: item });
    }
    assert.deepEqual(otherMessages, []);
    assert.ok(fixture.origins.every(origin => origin === "https://app.example.invalid"));
  });

  test(`Socket.IO enforces the injected Origin policy over ${transport}`, { timeout: 10000 }, async t => {
    const fixture = await startSocket(t);
    for (const origin of ["https://untrusted.example.invalid", null]) {
      const client = fixture.connect({ origin, transport });
      const failure = event(client, "connect_error");
      client.connect();
      await failure;
      assert.equal(client.connected, false);
      client.disconnect();
    }
    assert.deepEqual(fixture.hub.stats(), { connections: 0, rooms: 0 });
  });
}

for (const [auth, code] of [
  [{}, "INVALID_REQUEST"],
  [{ accessToken: "synthetic-access-token", roomId: "invalid-room" }, "INVALID_REQUEST"]
] as const) {
  test(`Socket.IO rejects invalid handshake auth: ${JSON.stringify(Object.keys(auth))}`, { timeout: 5000 }, async t => {
    const fixture = await startSocket(t);
    const client = fixture.connect({ auth });
    const failure = event<Error & { data: { code: string } }>(client, "connect_error");
    client.connect();
    assert.equal((await failure).data.code, code);
    assert.deepEqual(fixture.hub.stats(), { connections: 0, rooms: 0 });
  });
}

test("Socket.IO rejects a revoked session and times out an unavailable validator", { timeout: 5000 }, async t => {
  for (const validateAccessSession of [async () => false, () => new Promise<boolean>(() => {})]) {
    const fixture = await startSocket(t, { validateAccessSession, validationTimeoutMs: 30 });
    const client = fixture.connect();
    const failure = event<Error & { data: { code: string } }>(client, "connect_error");
    client.connect();
    assert.equal((await failure).data.code, "UNAUTHENTICATED");
    assert.deepEqual(fixture.hub.stats(), { connections: 0, rooms: 0 });
  }
});

test("Socket.IO fails closed on a forbidden or unavailable room authorization", { timeout: 5000 }, async t => {
  for (const authorizeRoom of [async () => { throw new Error("Denied"); }, () => new Promise<void>(() => {})]) {
    const fixture = await startSocket(t, { authorizeRoom, validationTimeoutMs: 30 });
    const client = fixture.connect();
    const failure = event<Error & { data: { code: string } }>(client, "connect_error");
    client.connect();
    assert.equal((await failure).data.code, "FORBIDDEN");
    assert.deepEqual(fixture.hub.stats(), { connections: 0, rooms: 0 });
  }
});

test("Socket.IO disconnects an idle authenticated client when its JWT expires", { timeout: 5000 }, async t => {
  const fixture = await startSocket(t, {
    verifyAccessToken: () => ({ sub: userId, email: "user@example.invalid", roles: ["USER"], sessionVersion: 1, exp: Date.now() / 1000 + 1 })
  });
  const client = fixture.connect();
  const ready = event(client, "ready");
  const failure = event(client, "auth_error");
  const disconnected = event(client, "disconnect");
  client.connect();
  await ready;
  assert.deepEqual(await failure, { code: "UNAUTHENTICATED" });
  await disconnected;
  assert.equal(client.connected, false);
  assert.deepEqual(fixture.hub.stats(), { connections: 0, rooms: 0 });
});

for (const revoke of ["SESSION", "ROOM"] as const) {
  test(`Socket.IO rechecks ${revoke} before delivering private content`, { timeout: 5000 }, async t => {
    let allowed = true;
    const fixture = await startSocket(t, {
      validateAccessSession: async () => revoke !== "SESSION" || allowed,
      authorizeRoom: async () => { if (revoke === "ROOM" && !allowed) throw new Error("Denied"); }
    });
    const client = fixture.connect();
    const ready = event(client, "ready");
    client.connect(); await ready;
    const received: unknown[] = [];
    client.on("chat.message", value => received.push(value));
    allowed = false;
    const failure = event(client, "auth_error");
    assert.deepEqual(await fixture.hub.publishMessage({ roomId, message }), { delivered: 0 });
    assert.deepEqual(await failure, { code: revoke === "SESSION" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    assert.deepEqual(received, []);
    assert.deepEqual(fixture.hub.stats(), { connections: 0, rooms: 0 });
  });
}

test("Socket.IO shutdown rejects pending authentication and leaves HTTP shutdown to main", { timeout: 5000 }, async t => {
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const pending = new Promise<void>(resolve => { release = resolve; });
  const fixture = await startSocket(t, { authorizeRoom: async () => { enter(); await pending; } });
  const client = fixture.connect();
  client.connect(); await entered;
  fixture.stop(); fixture.stop(); release();
  assert.equal(fixture.server.listening, true);
  assert.deepEqual(fixture.hub.stats(), { connections: 0, rooms: 0 });
});
