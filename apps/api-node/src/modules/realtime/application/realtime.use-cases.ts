import type { Response } from "express";
import { AppError } from "../../../shared/domain/app-error.js";
import type { ClaimRepository } from "../../claims/application/claim.repository.port.js";

export interface RealtimeConnection {
  id: string;
  userId: string;
  rooms: Set<string>;
  response: Pick<Response, "write" | "end" | "destroyed">;
}

export function createRealtimeUseCases({ claimRepository, id }: {
  claimRepository: Pick<ClaimRepository, "findRoomForParticipant">;
  id: () => string;
}) {
  const connections = new Map<string, RealtimeConnection>();
  const roomsByUser = new Map<string, Map<string, Set<string>>>();

  function subscribe(connection: RealtimeConnection, roomId: string) {
    connection.rooms.add(roomId);
    const userRooms = roomsByUser.get(connection.userId) ?? new Map<string, Set<string>>();
    const roomConnections = userRooms.get(roomId) ?? new Set<string>();
    roomConnections.add(connection.id);
    userRooms.set(roomId, roomConnections);
    roomsByUser.set(connection.userId, userRooms);
  }

  function cleanup(connectionId: string) {
    const connection = connections.get(connectionId);
    if (!connection) return;
    for (const roomId of connection.rooms) {
      const userRooms = roomsByUser.get(connection.userId);
      const roomConnections = userRooms?.get(roomId);
      roomConnections?.delete(connectionId);
      if (roomConnections?.size === 0) userRooms?.delete(roomId);
      if (userRooms?.size === 0) roomsByUser.delete(connection.userId);
    }
    connections.delete(connectionId);
  }

  function send(response: Pick<Response, "write">, event: string, data: unknown) {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  async function authorizeRooms(userId: string, requestedRoomIds: string[] = []) {
    const roomIds = [...new Set(requestedRoomIds)];
    for (const roomId of roomIds) {
      const room = await claimRepository.findRoomForParticipant(roomId, userId);
      if (!room) throw new AppError("not_found", "Realtime room khong ton tai");
    }
    return roomIds;
  }

  return {
    authorizeRooms,

    async connect(input: { userId: string; roomIds?: string[]; response: RealtimeConnection["response"]; authorized?: boolean; }) {
      const roomIds = [...new Set(input.roomIds ?? [])];
      const connection: RealtimeConnection = { id: id(), userId: input.userId, rooms: new Set(), response: input.response };
      const authorizedRoomIds = input.authorized ? roomIds : await authorizeRooms(input.userId, roomIds);
      for (const roomId of authorizedRoomIds) subscribe(connection, roomId);
      connections.set(connection.id, connection);
      send(input.response, "realtime.connected", {
        connectionId: connection.id,
        userId: input.userId,
        rooms: [...connection.rooms],
        notifications: true
      });
      return { connectionId: connection.id, cleanup: () => cleanup(connection.id) };
    },

    heartbeat(connectionId: string) {
      const connection = connections.get(connectionId);
      if (!connection || connection.response.destroyed) return false;
      send(connection.response, "realtime.ping", { connectionId, at: new Date().toISOString() });
      return true;
    },

    disconnect(connectionId: string) {
      cleanup(connectionId);
    },

    stats() {
      return {
        connections: connections.size,
        roomSubscriptions: [...roomsByUser.values()].reduce((total, rooms) => total + [...rooms.values()].reduce((sum, ids) => sum + ids.size, 0), 0)
      };
    }
  };
}

export type RealtimeUseCases = ReturnType<typeof createRealtimeUseCases>;
