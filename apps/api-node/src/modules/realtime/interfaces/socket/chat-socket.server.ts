import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { z } from "zod";
import type { AccessTokenPayload } from "../../../../shared/domain/auth.js";
import { isOriginAllowed, parseAllowedOrigins } from "../../../../shared/infrastructure/config/cors.js";
import type { ChatSocketUseCases } from "../../application/chat-socket.use-cases.js";

const socketPath = "/api/realtime/chat-socket";
const maxTimeout = 2_147_483_647;
const sessionValidationTimeoutMs = 5_000;
const roomIdSchema = z.string().uuid();
type AuthErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_REQUEST";

function socketAuthError(code: AuthErrorCode) {
  const error = new Error(code) as Error & { data?: { code: AuthErrorCode } };
  error.data = { code };
  return error;
}

export function createChatSocketServer(input: {
  server: HttpServer;
  chatSocketService: ChatSocketUseCases;
  frontendUrl: string;
  nodeEnv: string;
  verifyAccessToken(token: string): AccessTokenPayload;
  validateAccessSession(session: AccessTokenPayload): Promise<boolean>;
  authorizeRoom(userId: string, roomId: string): Promise<void>;
}) {
  const allowedOrigins = parseAllowedOrigins(input.frontendUrl);
  const sessions = new WeakMap<Socket, AccessTokenPayload>();
  const rooms = new WeakMap<Socket, string>();
  const socketServer = new SocketIOServer(input.server, {
    path: socketPath,
    maxHttpBufferSize: 8 * 1024,
    perMessageDeflate: false,
    cors: {
      origin(origin, callback) {
        if (!isOriginAllowed(origin, allowedOrigins, input.nodeEnv)) {
          callback(new Error("Origin not allowed"));
          return;
        }
        callback(null, true);
      },
      credentials: true
    }
  });

  async function sessionIsValid(session: AccessTokenPayload) {
    if (!Number.isFinite(session.exp) || session.exp! * 1000 <= Date.now()) return false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const valid = await Promise.race([
        input.validateAccessSession(session),
        new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), sessionValidationTimeoutMs); })
      ]);
      return valid && session.exp! * 1000 > Date.now();
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  socketServer.use((socket, next) => {
    void (async () => {
      const originHeader = socket.request.headers.origin;
      const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
      if (!isOriginAllowed(origin, allowedOrigins, input.nodeEnv)) throw socketAuthError("FORBIDDEN");

      const auth = socket.handshake.auth as Record<string, unknown>;
      if (typeof auth.accessToken !== "string" || typeof auth.roomId !== "string") throw socketAuthError("INVALID_REQUEST");
      const parsedRoomId = roomIdSchema.safeParse(auth.roomId);
      if (!parsedRoomId.success) throw socketAuthError("INVALID_REQUEST");

      let session: AccessTokenPayload;
      try { session = input.verifyAccessToken(auth.accessToken); }
      catch { throw socketAuthError("UNAUTHENTICATED"); }
      if (!session?.sub || !await sessionIsValid(session)) throw socketAuthError("UNAUTHENTICATED");

      try { await input.authorizeRoom(session.sub, parsedRoomId.data); }
      catch { throw socketAuthError("FORBIDDEN"); }

      sessions.set(socket, session);
      rooms.set(socket, parsedRoomId.data);
    })().then(() => next()).catch(error => {
      next(error instanceof Error ? error : socketAuthError("UNAUTHENTICATED"));
    });
  });

  socketServer.on("connection", socket => {
    let session = sessions.get(socket) ?? null;
    const roomId = rooms.get(socket);
    if (!session || !roomId) {
      socket.disconnect(true);
      return;
    }

    let disconnectFromHub: (() => void) | null = null;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    let validationTimer: ReturnType<typeof setInterval> | null = null;
    let checkingSession = false;

    const clearTimers = () => {
      if (expiryTimer) clearTimeout(expiryTimer);
      if (validationTimer) clearInterval(validationTimer);
      expiryTimer = null;
      validationTimer = null;
    };

    const disconnectUnauthenticated = () => {
      if (!socket.connected) return;
      socket.emit("auth_error", { code: "UNAUTHENTICATED" satisfies AuthErrorCode });
      socket.disconnect(true);
    };

    const scheduleExpiry = () => {
      if (!session?.exp) return;
      const remaining = session.exp * 1000 - Date.now();
      if (remaining <= 0) { disconnectUnauthenticated(); return; }
      expiryTimer = setTimeout(scheduleExpiry, Math.min(remaining, maxTimeout));
    };

    disconnectFromHub = input.chatSocketService.connect({
      userId: session.sub,
      roomId,
      transport: {
        send: async message => {
          if (!socket.connected) throw new Error("Socket is closed");
          if (!session || !await sessionIsValid(session)) {
            disconnectUnauthenticated();
            throw new Error("Socket session is no longer valid");
          }
          if (!socket.connected) throw new Error("Socket is closed");
          socket.emit("chat.message", { roomId, message });
        },
        close: () => socket.disconnect(true)
      }
    });

    scheduleExpiry();
    validationTimer = setInterval(() => {
      if (!session || checkingSession) return;
      checkingSession = true;
      void sessionIsValid(session).then(valid => {
        if (!valid) disconnectUnauthenticated();
      }).finally(() => { checkingSession = false; });
    }, 25_000);

    socket.emit("ready", { roomId });
    socket.on("disconnect", () => {
      clearTimers();
      disconnectFromHub?.();
      disconnectFromHub = null;
      session = null;
    });
  });

  return {
    stop() {
      socketServer.disconnectSockets(true);
      socketServer.engine.close();
    }
  };
}
