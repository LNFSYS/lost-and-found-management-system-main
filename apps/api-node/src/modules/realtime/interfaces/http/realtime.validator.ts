import { z } from "zod";

const uuid = z.string().uuid();

export const realtimeQuerySchema = z.object({
  roomId: z.union([uuid, z.array(uuid)]).optional()
});
