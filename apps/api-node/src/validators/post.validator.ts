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
  "Thoi diem khong duoc nam trong tuong lai"
);

const basePostFields = {
  title: z.string().trim().min(5, "Tieu de toi thieu 5 ky tu").max(255, "Tieu de toi da 255 ky tu"),
  description: z.string().trim().min(10, "Mo ta toi thieu 10 ky tu").max(5000, "Mo ta toi da 5000 ky tu"),
  categoryId: uuid,
  areaId: uuid.nullable().optional(),
  buildingId: uuid.nullable().optional(),
  roomText: nullableText(100),
  customLocation: nullableText(255),
  contactInfo: z.string().trim().min(3, "Thong tin lien he toi thieu 3 ky tu").max(255, "Thong tin lien he toi da 255 ky tu"),
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
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["areaId"], message: "Can co khu vuc, vi tri tuy chinh hoac diem ban giao" });
  }
  if (value.buildingId && !value.areaId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["buildingId"], message: "Dia diem cu the phai thuoc mot khu vuc" });
  }
  if (value.type === "LOST" && value.handoverPointId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["handoverPointId"], message: "LOST post khong dung diem ban giao" });
  }
  if (value.type === "LOST" && value.visibilityMode === "PRIVATE_DETAILS") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["visibilityMode"], message: "PRIVATE_DETAILS chi ap dung cho FOUND post" });
  }
  if (value.type === "FOUND" && !value.handoverPointId && !value.areaId && !value.customLocation) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["handoverPointId"], message: "FOUND can diem ban giao hoac noi luu giu hop le" });
  }
}

export const idParamSchema = z.object({ id: uuid });
export const mediaParamSchema = z.object({ postId: uuid, mediaId: uuid });

export const createPostSchema = z.object({
  type: postType,
  ...basePostFields
}).superRefine(validatePostShape);

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
}).refine(atLeastOne, "Can it nhat mot truong de cap nhat");

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

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
export type ListOwnPostsQuery = z.infer<typeof listOwnPostsQuerySchema>;
export type UploadMediaInput = z.infer<typeof uploadMediaSchema>;
