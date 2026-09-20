import { z } from "zod";

const idempotencyKey = z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const comment = z.string()
  .trim()
  .max(500)
  .refine((value) => !/[<>]/.test(value), "Comment khong duoc chua HTML")
  .optional()
  .nullable()
  .transform((value) => value?.replace(/\s+/g, " ").trim() || null);

export const appointmentIdParamSchema = z.object({
  appointmentId: z.string().uuid()
});

export const returnFeedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment,
  idempotencyKey: idempotencyKey.optional()
});

export type { ReturnFeedbackInput } from "../../application/return-feedback.dto.js";
