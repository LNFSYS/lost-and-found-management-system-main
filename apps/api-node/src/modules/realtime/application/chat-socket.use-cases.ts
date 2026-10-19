import type { ClaimRepository } from "../../claims/application/claim.repository.port.js";

export type ChatMessageRecord = NonNullable<Awaited<ReturnType<ClaimRepository["createMessage"]>>>;

export interface ChatSocketTransport {
  send(message: ChatMessageRecord): void | Promise<void>;
  close(): void;
}

interface ChatSocketConnection {
  userId: string;
  roomId: string;
  transport: ChatSocketTransport;
}

export function createChatSocketUseCases() {
  const rooms = new Map<string, Set<ChatSocketConnection>>();

  function disconnect(connection: ChatSocketConnection) {
    const connections = rooms.get(connection.roomId);
    connections?.delete(connection);
    if (connections?.size === 0) rooms.delete(connection.roomId);
  }

  return {
    connect(input: { userId: string; roomId: string; transport: ChatSocketTransport }) {
      const connection = { ...input };
      const connections = rooms.get(input.roomId) ?? new Set<ChatSocketConnection>();
      connections.add(connection);
      rooms.set(input.roomId, connections);
      return () => disconnect(connection);
    },

    async publishMessage(input: { roomId: string; message: ChatMessageRecord }) {
      const connections = [...(rooms.get(input.roomId) ?? [])];
      const outcomes = await Promise.all(connections.map(async connection => {
        try {
          await connection.transport.send(input.message);
          return true;
        } catch {
          try { connection.transport.close(); } catch { /* Disconnected sockets need no follow-up. */ }
          disconnect(connection);
          return false;
        }
      }));
      return { delivered: outcomes.filter(Boolean).length };
    },

    stop() {
      for (const connections of rooms.values()) {
        for (const connection of connections) {
          try { connection.transport.close(); } catch { /* Shutdown continues for remaining sockets. */ }
        }
      }
      rooms.clear();
    },

    stats() {
      return {
        connections: [...rooms.values()].reduce((total, connections) => total + connections.size, 0),
        rooms: rooms.size
      };
    }
  };
}

export type ChatSocketUseCases = ReturnType<typeof createChatSocketUseCases>;
