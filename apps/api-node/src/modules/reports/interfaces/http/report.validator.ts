import { z } from "zod";

const uuid = z.string().uuid();
const safeText = (max: number) => z.string().trim().max(max).refine((value) => !/[<>]/.test(value), "Không chấp nhận nội dung HTML");
export const reportIdParamSchema = z.object({ id: uuid });
export const submitReportSchema = z.object({
  targetType: z.enum(["POST", "CLAIM", "MESSAGE", "HANDOVER"]),
  targetId: uuid,
  reason: safeText(120).pipe(z.string().min(3)),
  details: safeText(1000).optional(),
  idempotencyKey: z.string().trim().min(8).max(128)
}).strict();
export const listMyReportsSchema = z.object({
  status: z.enum(["PENDING", "REVIEWED", "DISMISSED", "WITHDRAWN"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});
