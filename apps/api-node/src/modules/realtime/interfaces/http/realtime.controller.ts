import type { Request, Response } from "express";
import type { RealtimeUseCases } from "../../application/realtime.use-cases.js";
import { realtimeQuerySchema } from "./realtime.validator.js";

export function createRealtimeController({ realtimeService }: { realtimeService: RealtimeUseCases; }) {
  return {
    async connect(request: Request, response: Response) {
      const query = realtimeQuerySchema.parse(request.query);
      const roomIds = query.roomId ? Array.isArray(query.roomId) ? query.roomId : [query.roomId] : [];
      const authorizedRoomIds = await realtimeService.authorizeRooms(request.auth!.sub, roomIds);
      response.status(200);
      response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      response.setHeader("Cache-Control", "no-store, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.setHeader("X-Accel-Buffering", "no");
      response.flushHeaders?.();

      const connection = await realtimeService.connect({ userId: request.auth!.sub, roomIds: authorizedRoomIds, response, authorized: true });
      const heartbeat = setInterval(() => {
        if (!realtimeService.heartbeat(connection.connectionId)) clearInterval(heartbeat);
      }, 25_000);
      request.on("close", () => {
        clearInterval(heartbeat);
        connection.cleanup();
      });
    }
  };
}

export type RealtimeController = ReturnType<typeof createRealtimeController>;
