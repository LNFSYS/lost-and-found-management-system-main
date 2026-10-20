import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { z } from "zod";
import type { AccessTokenPayload } from "../../../../shared/domain/auth.js";
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
  isOriginAllowed(origin: string | undefined): boolean;
  verifyAccessToken(token: string): AccessTokenPayload;
  validateAccessSession(session: AccessTokenPayload): Promise<boolean>;
  authorizeRoom(userId: string, roomId: string): Promise<void>;
  validationTimeoutMs?: number;
}) {
  let stopped = false;
  const sessions = new WeakMap<Socket, AccessTokenPayload>();
  const rooms = new WeakMap<Socket, string>();
  const socketServer = new SocketIOServer(input.server, {
    path: socketPath,
    maxHttpBufferSize: 8 * 1024,
    perMessageDeflate: false,
    allowRequest(request, callback) {
      callback(null, !stopped && input.isOriginAllowed(request.headers.origin));
    },
    cors: {
      origin(origin, callback) {
        if (!input.isOriginAllowed(origin)) {
          callback(new Error("Origin not allowed"));
          return;
        }
        callback(null, true);
      },
      credentials: true
    }
  });

  async function bounded<T>(work: () => Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Validation timed out")), input.validationTimeoutMs ?? sessionValidationTimeoutMs);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function authorize(session: AccessTokenPayload, roomId: string) {
    if (!Number.isFinite(session.exp) || session.exp! * 1000 <= Date.now()) throw socketAuthError("UNAUTHENTICATED");
    let valid: boolean;
    try { valid = await bounded(() => input.validateAccessSession(session)); }
    catch { throw socketAuthError("UNAUTHENTICATED"); }
    if (!valid) throw socketAuthError("UNAUTHENTICATED");
    try { await bounded(() => input.authorizeRoom(session.sub, roomId)); }
    catch { throw socketAuthError("FORBIDDEN"); }
    if (session.exp! * 1000 <= Date.now()) throw socketAuthError("UNAUTHENTICATED");
  }

  socketServer.use((socket, next) => {
    void (async () => {
      const originHeader = socket.request.headers.origin;
      const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
      if (!input.isOriginAllowed(origin)) throw socketAuthError("FORBIDDEN");

      const auth: unknown = socket.handshake.auth;
      if (!auth || typeof auth !== "object" || Array.isArray(auth)) throw socketAuthError("INVALID_REQUEST");
      const credentials = auth as Record<string, unknown>;
      if (typeof credentials.accessToken !== "string" || typeof credentials.roomId !== "string") throw socketAuthError("INVALID_REQUEST");
      const parsedRoomId = roomIdSchema.safeParse(credentials.roomId);
      if (!parsedRoomId.success) throw socketAuthError("INVALID_REQUEST");

      let session: AccessTokenPayload;
      try { session = input.verifyAccessToken(credentials.accessToken); }
      catch { throw socketAuthError("UNAUTHENTICATED"); }
      if (!session?.sub) throw socketAuthError("UNAUTHENTICATED");
      await authorize(session, parsedRoomId.data);
      if (stopped || socket.conn.readyState !== "open") throw socketAuthError("UNAUTHENTICATED");

      sessions.set(socket, session);
      rooms.set(socket, parsedRoomId.data);
    })().then(() => next()).catch(error => {
      next(error instanceof Error && ["UNAUTHENTICATED", "FORBIDDEN", "INVALID_REQUEST"].includes(error.message)
        ? error : socketAuthError("UNAUTHENTICATED"));
    });
  });

  socketServer.on("connection", socket => {
    let session = sessions.get(socket) ?? null;
    const roomId = rooms.get(socket);
    if (stopped || !session || !roomId) {
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

    const disconnectWithError = (code: AuthErrorCode) => {
      if (!socket.connected) return;
      socket.emit("auth_error", { code });
      socket.disconnect(true);
    };

    const scheduleExpiry = () => {
      if (!session?.exp) return;
      const remaining = session.exp * 1000 - Date.now();
      if (remaining <= 0) { disconnectWithError("UNAUTHENTICATED"); return; }
      expiryTimer = setTimeout(scheduleExpiry, Math.min(remaining, maxTimeout));
    };

    socket.on("disconnect", () => {
      clearTimers();
      disconnectFromHub?.();
      disconnectFromHub = null;
      session = null;
    });
    disconnectFromHub = input.chatSocketService.connect({
      userId: session.sub,
      roomId,
      transport: {
        send: async message => {
          if (!socket.connected) throw new Error("Socket is closed");
          try {
            if (!session) throw socketAuthError("UNAUTHENTICATED");
            await authorize(session, roomId);
          } catch (error) {
            disconnectWithError(error instanceof Error && error.message === "FORBIDDEN" ? "FORBIDDEN" : "UNAUTHENTICATED");
            throw error;
          }
          if (!socket.connected) throw new Error("Socket is closed");
          socket.emit("chat.message", { roomId, message });
        },
        close: () => socket.disconnect(true)
      }
    });

    scheduleExpiry();
    if (!socket.connected) return;
    validationTimer = setInterval(() => {
      if (!session || checkingSession) return;
      checkingSession = true;
      void authorize(session, roomId).catch(error => {
        disconnectWithError(error instanceof Error && error.message === "FORBIDDEN" ? "FORBIDDEN" : "UNAUTHENTICATED");
      }).finally(() => { checkingSession = false; });
    }, 25_000);

    socket.emit("ready", { roomId });
  });

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      socketServer.disconnectSockets(true);
      socketServer.engine.close();
    }
  };
}
