import { AppError } from "../../../shared/domain/app-error.js";
import type { ClaimRepository } from "../../claims/application/index.js";
import type { NotificationRecord } from "../../notifications/application/index.js";

export type WorkflowNotificationKind = "CLAIM" | "CHAT" | "APPOINTMENT" | "RETURN";

interface EventStreamResponse {
  destroyed: boolean;
  write(chunk: string): unknown;
  end(): unknown;
}

export interface RealtimeConnection {
  id: string;
  userId: string;
  rooms: Set<string>;
  deliveredEventIds: Set<string>;
  response: EventStreamResponse;
}

export interface WorkflowNotificationInput {
  userId: string;
  notification: NotificationRecord;
  workflow: WorkflowNotificationKind;
  roomId?: string | null;
}

export function createRealtimeUseCases({ claimRepository, id }: {
  claimRepository: Pick<ClaimRepository, "findRoomForParticipant">;
  id: () => string;
}) {
  const connections = new Map<string, RealtimeConnection>();
  const connectionsByUser = new Map<string, Set<string>>();
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
    const userConnections = connectionsByUser.get(connection.userId);
    userConnections?.delete(connectionId);
    if (userConnections?.size === 0) connectionsByUser.delete(connection.userId);
    connections.delete(connectionId);
  }

  function send(response: Pick<EventStreamResponse, "write">, event: string, data: unknown) {
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

  function safeNotification(notification: NotificationRecord) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      entityType: notification.entityType,
      entityId: notification.entityId,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt
    };
  }

  return {
    authorizeRooms,

    async connect(input: { userId: string; roomIds?: string[]; response: RealtimeConnection["response"]; authorized?: boolean; }) {
      const roomIds = [...new Set(input.roomIds ?? [])];
      const connection: RealtimeConnection = { id: id(), userId: input.userId, rooms: new Set(), deliveredEventIds: new Set(), response: input.response };
      const authorizedRoomIds = input.authorized ? roomIds : await authorizeRooms(input.userId, roomIds);
      for (const roomId of authorizedRoomIds) subscribe(connection, roomId);
      connections.set(connection.id, connection);
      const userConnections = connectionsByUser.get(input.userId) ?? new Set<string>();
      userConnections.add(connection.id);
      connectionsByUser.set(input.userId, userConnections);
      send(input.response, "realtime.connected", {
        connectionId: connection.id,
        userId: input.userId,
        rooms: [...connection.rooms],
        notifications: true,
        resync: { notifications: "/api/notifications" }
      });
      return { connectionId: connection.id, cleanup: () => cleanup(connection.id) };
    },

    publishNotification(input: WorkflowNotificationInput) {
      const connectionIds = connectionsByUser.get(input.userId) ?? new Set<string>();
      let delivered = 0;
      const eventId = input.notification.id;
      for (const connectionId of connectionIds) {
        const connection = connections.get(connectionId);
        if (!connection || connection.response.destroyed || connection.deliveredEventIds.has(eventId)) continue;
        connection.deliveredEventIds.add(eventId);
        send(connection.response, "workflow.notification", {
          eventId,
          workflow: input.workflow,
          roomId: input.roomId ?? null,
          notification: safeNotification(input.notification),
          resync: { notifications: "/api/notifications" }
        });
        delivered += 1;
      }
      return { delivered };
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
        notificationSubscriptions: [...connectionsByUser.values()].reduce((total, ids) => total + ids.size, 0),
        roomSubscriptions: [...roomsByUser.values()].reduce((total, rooms) => total + [...rooms.values()].reduce((sum, ids) => sum + ids.size, 0), 0)
      };
    }
  };
}

export type RealtimeUseCases = ReturnType<typeof createRealtimeUseCases>;
