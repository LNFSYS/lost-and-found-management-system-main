import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import type { AccessTokenPayload } from "../../../../shared/domain/auth.js";
import type { ChatSocketUseCases } from "../../application/chat-socket.use-cases.js";

const socketPath = "/api/realtime/chat-socket";
const maxTimeout = 2_147_483_647;
const sessionValidationTimeoutMs = 5_000;
const roomIdSchema = z.string().uuid();

export function createChatSocketServer(input: {
  server: HttpServer;
  chatSocketService: ChatSocketUseCases;
  isOriginAllowed(origin: string | undefined): boolean;
  verifyAccessToken(token: string): AccessTokenPayload;
  validateAccessSession(session: AccessTokenPayload): Promise<boolean>;
  authorizeRoom(userId: string, roomId: string): Promise<void>;
}) {
  const webSockets = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024, perMessageDeflate: false });
  const upgradeHandler = (request: IncomingMessage, socket: import("node:net").Socket, head: Buffer) => {
    let requestPath: string;
    try { requestPath = new URL(request.url ?? "/", "http://localhost").pathname; }
    catch { socket.destroy(); return; }
    if (requestPath !== socketPath) { socket.destroy(); return; }

    const originHeader = request.headers.origin;
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    if (!input.isOriginAllowed(origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    try {
      webSockets.handleUpgrade(request, socket, head, client => {
        webSockets.emit("connection", client, request);
      });
    } catch {
      socket.destroy();
    }
  };

  input.server.on("upgrade", upgradeHandler);

  webSockets.on("connection", client => {
    let authenticated = false;
    let authenticating = false;
    let session: AccessTokenPayload | null = null;
    let disconnectFromHub: (() => void) | null = null;
    let authenticationTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => client.close(4401, "Authentication required"), 10_000);
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    let validationTimer: ReturnType<typeof setInterval> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let checkingSession = false;

    const clearTimers = () => {
      if (authenticationTimer) clearTimeout(authenticationTimer);
      if (expiryTimer) clearTimeout(expiryTimer);
      if (validationTimer) clearInterval(validationTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      authenticationTimer = null;
      expiryTimer = null;
      validationTimer = null;
      heartbeatTimer = null;
    };

    const send = (value: unknown) => {
      if (client.readyState !== WebSocket.OPEN) return;
      client.send(JSON.stringify(value));
    };

    const closeWithError = (code: "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_REQUEST") => {
      try { send({ type: "auth_error", code }); } catch { /* The peer may have disconnected. */ }
      if (client.readyState === WebSocket.OPEN) {
        const closeCode = code === "FORBIDDEN" ? 4403 : code === "INVALID_REQUEST" ? 4400 : 4401;
        client.close(closeCode, code);
      }
    };

    const sessionIsValid = async (current: AccessTokenPayload) => {
      if (!Number.isFinite(current.exp) || current.exp! * 1000 <= Date.now()) return false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const valid = await Promise.race([
          input.validateAccessSession(current),
          new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), sessionValidationTimeoutMs); })
        ]);
        return valid && current.exp! * 1000 > Date.now();
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    };

    const scheduleExpiry = () => {
      if (!session?.exp) return;
      const remaining = session.exp * 1000 - Date.now();
      if (remaining <= 0) { client.close(4401, "Session expired"); return; }
      expiryTimer = setTimeout(scheduleExpiry, Math.min(remaining, maxTimeout));
    };

    client.on("message", (data, isBinary) => {
      if (authenticated || authenticating || isBinary) { closeWithError("INVALID_REQUEST"); return; }
      authenticating = true;
      void (async () => {
        let message: unknown;
        try { message = JSON.parse(data.toString()); }
        catch { closeWithError("INVALID_REQUEST"); return; }
        if (!message || typeof message !== "object") { closeWithError("INVALID_REQUEST"); return; }
        const request = message as Record<string, unknown>;
        if (request.type !== "authenticate" || typeof request.accessToken !== "string" || typeof request.roomId !== "string") {
          closeWithError("INVALID_REQUEST");
          return;
        }
        const parsedRoomId = roomIdSchema.safeParse(request.roomId);
        if (!parsedRoomId.success) { closeWithError("INVALID_REQUEST"); return; }

        let payload: AccessTokenPayload;
        try { payload = input.verifyAccessToken(request.accessToken); }
        catch { closeWithError("UNAUTHENTICATED"); return; }
        if (!payload?.sub || !await sessionIsValid(payload)) { closeWithError("UNAUTHENTICATED"); return; }

        try { await input.authorizeRoom(payload.sub, parsedRoomId.data); }
        catch { closeWithError("FORBIDDEN"); return; }
        if (client.readyState !== WebSocket.OPEN) return;

        session = payload;
        authenticated = true;
        if (authenticationTimer) clearTimeout(authenticationTimer);
        authenticationTimer = null;
        disconnectFromHub = input.chatSocketService.connect({
          userId: payload.sub,
          roomId: parsedRoomId.data,
          transport: {
            send: async chatMessage => {
              if (client.readyState !== WebSocket.OPEN) throw new Error("Socket is closed");
              if (!session || !await sessionIsValid(session)) {
                client.close(4401, "Session expired");
                throw new Error("Socket session is no longer valid");
              }
              if (client.readyState !== WebSocket.OPEN) throw new Error("Socket is closed");
              await new Promise<void>((resolve, reject) => {
                client.send(JSON.stringify({ type: "chat.message", roomId: parsedRoomId.data, message: chatMessage }), error => {
                  if (error) reject(error);
                  else resolve();
                });
              });
            },
            close: () => client.close(1001, "Realtime service stopping")
          }
        });
        scheduleExpiry();
        validationTimer = setInterval(() => {
          if (!session || checkingSession) return;
          checkingSession = true;
          void sessionIsValid(session).then(valid => {
            if (!valid) client.close(4401, "Session expired");
          }).finally(() => { checkingSession = false; });
        }, 25_000);
        heartbeatTimer = setInterval(() => {
          if (client.readyState !== WebSocket.OPEN) return;
          try { client.ping(); } catch { client.terminate(); }
        }, 25_000);
        send({ type: "ready", roomId: parsedRoomId.data });
      })().finally(() => { authenticating = false; });
    });

    const cleanup = () => {
      clearTimers();
      disconnectFromHub?.();
      disconnectFromHub = null;
    };
    client.on("close", cleanup);
    client.on("error", cleanup);
  });

  return {
    stop() {
      input.server.off("upgrade", upgradeHandler);
      for (const client of webSockets.clients) client.terminate();
      webSockets.close();
    }
  };
}
