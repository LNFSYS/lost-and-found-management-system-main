import { AppError } from "../../../shared/domain/app-error.js";
import type { PostRecord, PostStatus } from "./post.js";

export const postTransitions: Record<PostStatus, readonly PostStatus[]> = {
  OPEN: ["OPEN", "CLOSED", "RESOLVED"],
  MATCHED: ["MATCHED", "CLOSED", "RESOLVED"],
  RESOLVED: ["RESOLVED"],
  CLOSED: ["CLOSED"],
  EXPIRED: ["EXPIRED"],
  HIDDEN: ["HIDDEN"]
};

export function assertPostUpdateAllowed(current: Pick<PostRecord, "status">, input: Partial<Record<"status" | "title" | "description" | "categoryId" | "areaId" | "buildingId" | "roomText" | "customLocation" | "contactInfo" | "lostFoundAt" | "handoverPointId" | "visibilityMode", unknown>> & { status?: PostStatus; }) {
  const contentFields = ["title", "description", "categoryId", "areaId", "buildingId", "roomText", "customLocation", "contactInfo", "lostFoundAt", "handoverPointId", "visibilityMode"] as const;
  const changesContent = contentFields.some((field) => input[field] !== undefined);
  const nextStatus = input.status ?? current.status;
  if (changesContent && ["RESOLVED", "CLOSED", "EXPIRED", "HIDDEN"].includes(current.status)) {
    throw new AppError("conflict", "Bài đăng đã kết thúc, không thể cập nhật nội dung");
  }
  if (!postTransitions[current.status].includes(nextStatus)) {
    throw new AppError("conflict", "Chuyển trạng thái bài đăng không hợp lệ");
  }
}

export function ensureWritableStatus(post: Pick<PostRecord, "status">) {
  if (post.status === "RESOLVED" || post.status === "CLOSED" || post.status === "EXPIRED") {
    throw new AppError("conflict", "Bài đăng đã kết thúc, không thể cập nhật nội dung");
  }
}
