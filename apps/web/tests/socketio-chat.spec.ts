import { expect, test, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { Server, type Socket } from "socket.io";
import { build } from "vite";

const roomA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const roomB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const socketPath = "/api/realtime/chat-socket";
const modulePath = "/socketio-client-module.js";
let browserModule: string;
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    logLevel: "error",
    build: {
      write: false,
      lib: { entry: fileURLToPath(new URL("../src/services/api.ts", import.meta.url)), formats: ["es"] }
    }
  });
  const bundle = Array.isArray(result) && result.length === 1 ? result[0] : result;
  if (!("output" in bundle)) throw new Error("Expected one browser bundle");
  const chunks = bundle.output.filter(item => item.type === "chunk");
  if (chunks.length !== 1) throw new Error("Expected a self-contained browser module");
  browserModule = chunks[0].code;
});
type BrowserState = {
  events: Array<{ kind: string; roomId: string; content?: string }>;
  stop: (() => void) | null;
};

async function fixture(page: Page, options: { autoReady?: boolean; reject?: string; holdAuth?: boolean } = {}) {
  const http = createServer();
  const server = new Server(http, {
    path: socketPath,
    transports: ["polling"],
    cors: { origin: true, credentials: true }
  });
  const attempts: Socket[] = [];
  const connected: Socket[] = [];
  const pending: Array<() => void> = [];
  let refreshes = 0;
  server.use((socket, next) => {
    attempts.push(socket);
    const complete = () => {
      if (!options.reject) return next();
      const error = new Error(options.reject) as Error & { data: { code: string } };
      error.data = { code: options.reject };
      next(error);
    };
    if (options.holdAuth) pending.push(complete);
    else complete();
  });
  server.on("connection", socket => {
    connected.push(socket);
    if (options.autoReady !== false) socket.emit("ready", { roomId: socket.handshake.auth.roomId });
  });
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  const address = http.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture address");
  const session = (token: string) => ({
    accessToken: token, accessTokenExpiresIn: "15m",
    user: { id: "socket-test-user", fullName: "Socket test", email: "socket@example.invalid", roles: ["USER"], status: "ACTIVE" }
  });
  try {
    // Exercise the real production-bundled client without unrelated application subscriptions.
    await page.route("**/socketio-client-harness", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Socket.IO client test</title>" }));
    await page.route(`**${modulePath}`, route => route.fulfill({ contentType: "text/javascript", body: browserModule }));
    await page.route("**/api/**", route => route.fulfill({ status: 404, json: { message: "Not in fixture" } }));
    await page.route("**/api/auth/login", route => route.fulfill({ json: session("initial-test-token") }));
    await page.route("**/api/auth/refresh", route => route.fulfill({ json: session(`refreshed-test-token-${++refreshes}`) }));
    await page.route(`**${socketPath}/**`, async route => {
      const target = new URL(route.request().url());
      target.hostname = "127.0.0.1";
      target.port = String(address.port);
      target.protocol = "http:";
      try {
        const response = await route.fetch({ url: target.toString(), timeout: 15_000 });
        await route.fulfill({ response });
      } catch {
        await route.abort().catch(() => undefined);
      }
    });
    await page.goto("/socketio-client-harness");
    await page.evaluate(async modulePath => {
      const { api } = await import(modulePath);
      await api.login("socket@example.invalid", "synthetic-test-password");
      (window as Window & { socketTest?: BrowserState }).socketTest = { events: [], stop: null };
    }, modulePath);
    return {
      attempts, connected, pending,
      refreshes: () => refreshes,
      close: () => new Promise<void>(resolve => server.close(() => resolve()))
    };
  } catch (error) {
    await new Promise<void>(resolve => server.close(() => resolve()));
    throw error;
  }
}

async function subscribe(page: Page, roomId: string) {
  await page.evaluate(async ({ modulePath, roomId }) => {
    const { api } = await import(modulePath);
    const state = (window as Window & { socketTest: BrowserState }).socketTest;
    state.stop?.();
    state.stop = api.subscribeClaimChatSocket({
      roomId,
      onConnected: () => state.events.push({ kind: "connected", roomId }),
      onReconnected: () => state.events.push({ kind: "reconnected", roomId }),
      onMessage: (message: { content: string }) => state.events.push({ kind: "message", roomId, content: message.content })
    });
  }, { modulePath, roomId });
}

async function events(page: Page) {
  return page.evaluate(() => (window as Window & { socketTest: BrowserState }).socketTest.events);
}

async function stop(page: Page) {
  await page.evaluate(() => (window as Window & { socketTest?: BrowserState }).socketTest?.stop?.());
}

test("Socket.IO browser client gates delivery on ready and ignores other rooms and duplicate ready", async ({ page }) => {
  const server = await fixture(page, { autoReady: false });
  try {
    await subscribe(page, roomA);
    await expect.poll(() => server.connected.length).toBe(1);
    const socket = server.connected[0];
    socket.emit("chat.message", { roomId: roomA, message: { content: "before-ready" } });
    socket.emit("ready", { roomId: roomB });
    socket.emit("ready", { roomId: roomA });
    socket.emit("ready", { roomId: roomA });
    socket.emit("chat.message", { roomId: roomB, message: { content: "wrong-room" } });
    socket.emit("chat.message", { roomId: roomA, message: { content: "private-message" } });
    await expect.poll(() => events(page)).toEqual([
      { kind: "connected", roomId: roomA },
      { kind: "message", roomId: roomA, content: "private-message" }
    ]);
    expect(socket.handshake.auth).toMatchObject({ accessToken: "initial-test-token", roomId: roomA });
  } finally { await stop(page); await server.close(); }
});

test("Socket.IO browser reconnect refreshes an expired session and notifies resynchronization once", async ({ page }) => {
  const server = await fixture(page);
  try {
    await subscribe(page, roomA);
    await expect.poll(() => events(page)).toEqual([{ kind: "connected", roomId: roomA }]);
    server.connected[0].emit("auth_error", { code: "UNAUTHENTICATED" });
    await expect.poll(() => server.connected.length).toBe(2);
    await expect.poll(() => events(page)).toEqual([
      { kind: "connected", roomId: roomA }, { kind: "reconnected", roomId: roomA }
    ]);
    expect(server.connected[1].handshake.auth.accessToken).toBe("refreshed-test-token-1");
    expect(server.refreshes()).toBe(1);
    await expect.poll(() => server.connected[0].connected).toBe(false);
    server.connected[1].emit("chat.message", { roomId: roomA, message: { content: "after-reconnect" } });
    await expect.poll(async () => (await events(page)).at(-1)?.content).toBe("after-reconnect");
  } finally { await stop(page); await server.close(); }
});

test("Socket.IO browser cancels pending room authentication without reviving the old room", async ({ page }) => {
  const server = await fixture(page, { holdAuth: true, reject: "UNAUTHENTICATED" });
  try {
    await subscribe(page, roomA);
    await expect.poll(() => server.pending.length).toBe(1);
    await subscribe(page, roomB);
    await expect.poll(() => server.pending.length).toBe(2);
    await stop(page);
    for (const complete of server.pending) complete();
    // This window spans both the first 500ms reconnect delay and one subsequent retry.
    await page.waitForTimeout(1_600);
    expect(server.refreshes()).toBe(0);
    expect(server.attempts).toHaveLength(2);
    expect(await events(page)).toEqual([]);
  } finally { await stop(page); await server.close(); }
});

test("Socket.IO browser stops retrying a forbidden room without refreshing the session", async ({ page }) => {
  const server = await fixture(page, { reject: "FORBIDDEN" });
  try {
    await subscribe(page, roomA);
    await expect.poll(() => server.attempts.length).toBe(1);
    await page.waitForTimeout(1_600);
    expect(server.attempts).toHaveLength(1);
    expect(server.refreshes()).toBe(0);
    expect(await events(page)).toEqual([]);
  } finally { await stop(page); await server.close(); }
});
