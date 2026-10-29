import { z } from "zod";

const uuid = z.string().uuid();
const postType = z.enum(["LOST", "FOUND"]);
const visibilityMode = z.enum(["PUBLIC", "PRIVATE_DETAILS"]);
const ownerStatus = z.enum(["OPEN", "MATCHED", "RESOLVED", "CLOSED", "EXPIRED"]);
const publicStatus = z.enum(["OPEN", "MATCHED", "RESOLVED"]);
const writableStatus = z.enum(["OPEN", "CLOSED", "RESOLVED"]);

function atLeastOne(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

function nullableText(max: number) {
  return z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(max).nullable().optional()
  );
}

const incidentTime = z.coerce.date().refine(
  (value) => value.getTime() <= Date.now(),
  "Thời điểm không được nằm trong tương lai"
);

const basePostFields = {
  title: z.string().trim().min(5, "Tiêu đề phải có ít nhất 5 ký tự").max(255, "Tiêu đề không được vượt quá 255 ký tự"),
  description: z.string().trim().min(10, "Mô tả phải có ít nhất 10 ký tự").max(5000, "Mô tả không được vượt quá 5.000 ký tự"),
  categoryId: uuid,
  areaId: uuid.nullable().optional(),
  buildingId: uuid.nullable().optional(),
  roomText: nullableText(100),
  customLocation: nullableText(255),
  contactInfo: z.string().trim().min(3, "Thông tin liên hệ phải có ít nhất 3 ký tự").max(255, "Thông tin liên hệ không được vượt quá 255 ký tự"),
  lostFoundAt: incidentTime,
  handoverPointId: uuid.nullable().optional(),
  visibilityMode: visibilityMode.optional()
};

function validatePostShape(value: {
  type: "LOST" | "FOUND";
  areaId?: string | null;
  buildingId?: string | null;
  customLocation?: string | null;
  handoverPointId?: string | null;
  visibilityMode?: "PUBLIC" | "PRIVATE_DETAILS";
}, context: z.RefinementCtx) {
  const hasLocation = Boolean(value.areaId || value.customLocation || value.handoverPointId);
  if (!hasLocation) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["areaId"], message: "Cần có khu vực, vị trí tùy chỉnh hoặc điểm bàn giao" });
  }
  if (value.buildingId && !value.areaId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["buildingId"], message: "Địa điểm cụ thể phải thuộc một khu vực" });
  }
  if (value.type === "LOST" && value.handoverPointId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["handoverPointId"], message: "Bài đăng báo mất không sử dụng điểm bàn giao" });
  }
  if (value.type === "LOST" && value.visibilityMode === "PRIVATE_DETAILS") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["visibilityMode"], message: "PRIVATE_DETAILS chi ap dung cho FOUND post" });
  }
  if (value.type === "FOUND" && !value.handoverPointId && !value.areaId && !value.customLocation) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["handoverPointId"], message: "Bài đăng nhặt được cần có điểm bàn giao hoặc nơi lưu giữ hợp lệ" });
  }
}

export const idParamSchema = z.object({ id: uuid });
export const mediaParamSchema = z.object({ postId: uuid, mediaId: uuid });
export const matchParamSchema = z.object({ id: uuid, matchId: uuid });
export const listMatchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});
const correlationKey = z.string().trim().min(8).max(128);
export const matchFeedbackSchema = z.object({
  value: z.enum(["USEFUL", "IRRELEVANT", "INCORRECT"]),
  note: z.string().trim().max(500).nullable().optional(),
  correlationKey
});
export const dismissMatchSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
  correlationKey
});

export const createPostSchema = z.object({
  type: postType,
  illustrationId: uuid.optional(),
  illustrationDraftId: uuid.optional(),
  ...basePostFields,
  analysisSignals: z.object({
    visualAttributes: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
    visibleText: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
    confidence: z.coerce.number().min(0).max(1)
  }).optional()
}).superRefine((value, context) => {
  validatePostShape(value, context);
  if ((value.illustrationId || value.illustrationDraftId) && value.type !== "LOST") context.addIssue({ code: z.ZodIssueCode.custom, path: ["illustrationId"], message: "Ảnh minh họa AI chỉ dành cho bài LOST." });
});

export const illustrationSchema = z.object({
  type: z.literal("LOST"),
  title: z.string().trim().min(5).max(255),
  description: z.string().trim().min(20).max(2000),
  categoryId: uuid,
  requestId: uuid
}).strict();

export const updatePostSchema = z.object({
  title: basePostFields.title.optional(),
  description: basePostFields.description.optional(),
  categoryId: uuid.optional(),
  areaId: uuid.nullable().optional(),
  buildingId: uuid.nullable().optional(),
  roomText: nullableText(100),
  customLocation: nullableText(255),
  contactInfo: basePostFields.contactInfo.optional(),
  lostFoundAt: incidentTime.optional(),
  handoverPointId: uuid.nullable().optional(),
  visibilityMode: visibilityMode.optional(),
  status: writableStatus.optional()
}).refine(atLeastOne, "Cần ít nhất một trường để cập nhật");

export const listPostsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: postType.optional(),
  status: publicStatus.optional(),
  categoryId: uuid.optional(),
  areaId: uuid.optional(),
  buildingId: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(["newest", "oldest", "incident_newest", "incident_oldest"]).default("newest")
});

export const listOwnPostsQuerySchema = listPostsQuerySchema.extend({
  status: ownerStatus.optional()
});

export const uploadMediaSchema = z.object({
  mediaKind: z.enum(["ITEM", "EVIDENCE"]).default("ITEM"),
  sortOrder: z.coerce.number().int().min(0).max(999).optional()
});

export const analyzePostImageSchema = z.object({
  type: postType
});

export type { AnalyzePostImageInput, CreatePostInput, ListOwnPostsQuery, ListPostsQuery, UpdatePostInput, UploadMediaInput } from "../../application/post.dto.js";
