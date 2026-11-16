import { z } from "zod";

export const radarAnalyticsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional()
});

export const radarAlertIdParamSchema = z.object({
  id: z.string().min(1, "Mã cảnh báo không được để trống")
});
