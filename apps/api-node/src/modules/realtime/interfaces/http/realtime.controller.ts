import type { Request, Response } from "express";
import type { RealtimeUseCases } from "../../application/realtime.use-cases.js";
import { realtimeQuerySchema } from "./realtime.validator.js";
import { HttpError } from "../../../../shared/interfaces/http/http-error.js";

export function createRealtimeController({ realtimeService }: { realtimeService: RealtimeUseCases; }) {
  return {
    async connect(request: Request, response: Response) {
      const query = realtimeQuerySchema.parse(request.query);
      const session = request.auth!;
      if (!Number.isFinite(session.exp) || session.exp! * 1000 <= Date.now()) {
        throw new HttpError(401, "Realtime session has expired");
      }
      const roomIds = query.roomId ? Array.isArray(query.roomId) ? query.roomId : [query.roomId] : [];
      const authorizedRoomIds = await realtimeService.authorizeRooms(request.auth!.sub, roomIds);
      const stream = {
        get destroyed() { return response.destroyed; },
        write(chunk: string) {
          // Registration can fail asynchronously; keep error responses as JSON.
          if (!response.headersSent) {
            response.status(200);
            response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
            response.setHeader("Cache-Control", "no-store, no-transform");
            response.setHeader("Connection", "keep-alive");
            response.setHeader("X-Accel-Buffering", "no");
          }
          return response.write(chunk);
        },
        end() { return response.end(); }
      };
      const connection = await realtimeService.connect({ userId: session.sub, roomIds: authorizedRoomIds, response: stream, authorized: true, session });
      if (response.destroyed) { connection.cleanup(); return; }
      let checking = false;
      const heartbeat = setInterval(() => {
        if (checking) return;
        checking = true;
        void realtimeService.heartbeat(connection.connectionId).then(active => {
          if (!active) clearInterval(heartbeat);
        }).catch(() => realtimeService.disconnect(connection.connectionId)).finally(() => { checking = false; });
      }, 25_000);
      const expiry = setTimeout(() => realtimeService.disconnect(connection.connectionId), Math.min(session.exp! * 1000 - Date.now(), 2_147_483_647));
      response.on("close", () => {
        clearInterval(heartbeat);
        clearTimeout(expiry);
        connection.cleanup();
      });
    }
  };
}

export type RealtimeController = ReturnType<typeof createRealtimeController>;
