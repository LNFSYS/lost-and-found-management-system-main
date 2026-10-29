import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { z } from "zod";
import type { AccessTokenPayload } from "../../../../shared/domain/auth.js";
import type { ChatSocketUseCases } from "../../application/chat-socket.use-cases.js";
import type { CallSocketUseCases, CallType } from "../../application/call-socket.use-cases.js";

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
  callSocketService?: CallSocketUseCases;
  isOriginAllowed(origin: string | undefined): boolean;
  verifyAccessToken(token: string): AccessTokenPayload;
  validateAccessSession(session: AccessTokenPayload): Promise<boolean>;
  authorizeRoom(userId: string, roomId: string): Promise<void>;
  validationTimeoutMs?: number;
}) {
  let stopped = false;
  const sessions = new WeakMap<Socket, AccessTokenPayload>();
  const rooms = new WeakMap<Socket, string>();
  // Track sockets by room+userId and by userId (supporting multiple tabs/devices per user)
  const socketsByRoomUser = new Map<string, Set<Socket>>();
  const socketsByUser = new Map<string, Set<Socket>>();

  function roomUserKey(roomId: string, userId: string) { return `${roomId}::${userId}`; }

  function addSocketTracker(roomId: string, userId: string, socket: Socket) {
    const rKey = roomUserKey(roomId, userId);
    let rSet = socketsByRoomUser.get(rKey);
    if (!rSet) {
      rSet = new Set();
      socketsByRoomUser.set(rKey, rSet);
    }
    rSet.add(socket);

    let uSet = socketsByUser.get(userId);
    if (!uSet) {
      uSet = new Set();
      socketsByUser.set(userId, uSet);
    }
    uSet.add(socket);
  }

  function removeSocketTracker(roomId: string, userId: string, socket: Socket) {
    const rKey = roomUserKey(roomId, userId);
    const rSet = socketsByRoomUser.get(rKey);
    if (rSet) {
      rSet.delete(socket);
      if (rSet.size === 0) socketsByRoomUser.delete(rKey);
    }

    const uSet = socketsByUser.get(userId);
    if (uSet) {
      uSet.delete(socket);
      if (uSet.size === 0) socketsByUser.delete(userId);
    }
  }

  function emitToPeer(roomId: string, targetUserId: string, event: string, data: unknown): boolean {
    let sent = false;
    const rSet = socketsByRoomUser.get(roomUserKey(roomId, targetUserId));
    if (rSet && rSet.size > 0) {
      for (const s of rSet) {
        if (s.connected) {
          s.emit(event, data);
          sent = true;
        }
      }
    }
    if (!sent) {
      const uSet = socketsByUser.get(targetUserId);
      if (uSet && uSet.size > 0) {
        for (const s of uSet) {
          if (s.connected) {
            s.emit(event, data);
            sent = true;
          }
        }
      }
    }
    return sent;
  }
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

    const userId = session.sub;
    addSocketTracker(roomId, userId, socket);

    socket.on("disconnect", () => {
      clearTimers();
      disconnectFromHub?.();
      disconnectFromHub = null;
      removeSocketTracker(roomId, userId, socket);
      // End any active call when socket disconnects
      if (input.callSocketService) {
        const activeCall = input.callSocketService.findActiveCall(roomId);
        if (activeCall && (activeCall.callerId === userId || activeCall.calleeId === userId)) {
          const ended = input.callSocketService.endCall(activeCall.callId, "DISCONNECTED");
          if (ended) {
            const peerId = activeCall.callerId === userId ? activeCall.calleeId : activeCall.callerId;
            emitToPeer(roomId, peerId, "call.ended", { callId: activeCall.callId, roomId, reason: "DISCONNECTED" });
          }
        }
      }
      session = null;
    });
    disconnectFromHub = input.chatSocketService.connect({
      userId,
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

    // ── Call signaling events ──────────────────────────────────────────
    if (input.callSocketService) {
      const callService = input.callSocketService;

      socket.on("call.initiate", (payload: unknown) => {
        if (!session || !socket.connected) return;
        if (!payload || typeof payload !== "object") return;
        const data = payload as Record<string, unknown>;
        const callType = data.callType as CallType;
        if (callType !== "VOICE" && callType !== "VIDEO") return;
        const calleeId = typeof data.calleeId === "string" ? data.calleeId : null;
        const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        if (!calleeId || calleeId === userId) {
          socket.emit("call.ended", {
            callId,
            roomId,
            reason: "ERROR",
            error: calleeId === userId
              ? "Cả hai cửa sổ đang đăng nhập cùng một tài khoản. Vui lòng mở tab Ẩn danh (Incognito) hoặc trình duyệt khác để đăng nhập tài khoản thứ 2."
              : "Không tìm thấy người nhận cuộc gọi."
          });
          return;
        }

        const result = callService.initiateCall({
          callId,
          roomId,
          callerId: userId,
          calleeId,
          callType,
          onTimeout: (timedOutCall) => {
            socket.emit("call.ended", { callId: timedOutCall.callId, roomId, reason: "MISSED" });
            emitToPeer(roomId, calleeId, "call.ended", { callId: timedOutCall.callId, roomId, reason: "MISSED" });
          }
        });

        if (result.error === "BUSY") {
          socket.emit("call.ended", { callId, roomId, reason: "BUSY" });
          return;
        }

        socket.emit("call.initiated", { callId, roomId, callType, calleeId });
        const sent = emitToPeer(roomId, calleeId, "call.incoming", { callId, roomId, callerId: userId, callType });
        if (!sent) {
          socket.emit("call.ended", {
            callId,
            roomId,
            reason: "MISSED",
            error: "Đối phương hiện chưa trực tuyến hoặc chưa mở phòng chat."
          });
          callService.endCall(callId, "MISSED");
        }
      });

      socket.on("call.accept", (payload: unknown) => {
        if (!session || !socket.connected) return;
        if (!payload || typeof payload !== "object") return;
        const data = payload as Record<string, unknown>;
        const callId = typeof data.callId === "string" ? data.callId : null;
        if (!callId) return;

        const call = callService.acceptCall(callId);
        if (!call) return;

        emitToPeer(roomId, call.callerId, "call.accepted", { callId, roomId });
        socket.emit("call.accepted", { callId, roomId });
      });

      socket.on("call.decline", (payload: unknown) => {
        if (!session || !socket.connected) return;
        if (!payload || typeof payload !== "object") return;
        const data = payload as Record<string, unknown>;
        const callId = typeof data.callId === "string" ? data.callId : null;
        if (!callId) return;

        const call = callService.endCall(callId, "DECLINED");
        if (!call) return;

        const peerId = call.callerId === userId ? call.calleeId : call.callerId;
        emitToPeer(roomId, peerId, "call.ended", { callId, roomId, reason: "DECLINED" });
        socket.emit("call.ended", { callId, roomId, reason: "DECLINED" });
      });

      socket.on("call.end", (payload: unknown) => {
        if (!session || !socket.connected) return;
        if (!payload || typeof payload !== "object") return;
        const data = payload as Record<string, unknown>;
        const callId = typeof data.callId === "string" ? data.callId : null;
        if (!callId) return;

        const call = callService.endCall(callId, "ENDED");
        if (!call) return;

        const peerId = call.callerId === userId ? call.calleeId : call.callerId;
        emitToPeer(roomId, peerId, "call.ended", { callId, roomId, reason: "ENDED" });
        socket.emit("call.ended", { callId, roomId, reason: "ENDED" });
      });

      // Relay WebRTC SDP offer
      socket.on("call.offer", (payload: unknown) => {
        if (!session || !socket.connected) return;
        if (!payload || typeof payload !== "object") return;
        const data = payload as Record<string, unknown>;
        const callId = typeof data.callId === "string" ? data.callId : null;
        if (!callId || !data.sdp) return;

        const call = callService.getCall(callId);
        if (!call || call.callerId !== userId) return;

        emitToPeer(roomId, call.calleeId, "call.offer", { callId, roomId, sdp: data.sdp });
      });

      // Relay WebRTC SDP answer
      socket.on("call.answer", (payload: unknown) => {
        if (!session || !socket.connected) return;
        if (!payload || typeof payload !== "object") return;
        const data = payload as Record<string, unknown>;
        const callId = typeof data.callId === "string" ? data.callId : null;
        if (!callId || !data.sdp) return;

        const call = callService.getCall(callId);
        if (!call || call.calleeId !== userId) return;

        emitToPeer(roomId, call.callerId, "call.answer", { callId, roomId, sdp: data.sdp });
      });

      // Relay ICE candidates
      socket.on("call.ice-candidate", (payload: unknown) => {
        if (!session || !socket.connected) return;
        if (!payload || typeof payload !== "object") return;
        const data = payload as Record<string, unknown>;
        const callId = typeof data.callId === "string" ? data.callId : null;
        if (!callId || !data.candidate) return;

        const call = callService.getCall(callId);
        if (!call) return;

        const peerId = call.callerId === userId ? call.calleeId : call.callerId;
        emitToPeer(roomId, peerId, "call.ice-candidate", { callId, roomId, candidate: data.candidate });
      });

      // Media toggle (mute/unmute mic, camera on/off)
      socket.on("call.toggle-media", (payload: unknown) => {
        if (!session || !socket.connected) return;
        if (!payload || typeof payload !== "object") return;
        const data = payload as Record<string, unknown>;
        const callId = typeof data.callId === "string" ? data.callId : null;
        if (!callId) return;
        const mediaType = data.mediaType as string;
        if (mediaType !== "audio" && mediaType !== "video") return;

        const call = callService.getCall(callId);
        if (!call || call.status !== "CONNECTED") return;

        const peerId = call.callerId === userId ? call.calleeId : call.callerId;
        emitToPeer(roomId, peerId, "call.media-toggled", { callId, roomId, userId, mediaType, enabled: Boolean(data.enabled) });
      });
    }

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
