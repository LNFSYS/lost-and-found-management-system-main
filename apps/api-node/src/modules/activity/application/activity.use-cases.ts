import { AppError } from "../../../shared/domain/app-error.js";
import type { TransactionRunner } from "../../../shared/application/transaction.js";
import type { AccessTokenPayload } from "../../../shared/domain/auth.js";
import type { AdminAuditRepository } from "../../admin/application/index.js";
import type { ActivityRepository, AuditFilter } from "./activity.repository.port.js";
import type { JourneyImageKind } from "./activity.repository.port.js";
import type { PrivateMediaStorage } from "../../../shared/application/media-storage.port.js";

export function createActivityUseCases(options: { repository: ActivityRepository; audit: AdminAuditRepository; transaction:TransactionRunner; id: () => string; now?: () => Date;
  media: { post: Pick<PrivateMediaStorage,"resolve">; claim: Pick<PrivateMediaStorage,"resolve">; warehouse: Pick<PrivateMediaStorage,"resolve"> } }) {
  const clock = options.now ?? (() => new Date());
  function validateSnapshot(asOf: string) {
    if (!Number.isFinite(new Date(asOf).getTime()) || new Date(asOf).getTime() > clock().getTime()+1000) throw new AppError("invalid_input", "Mốc hành trình không hợp lệ");
  }
  function admin(viewer: AccessTokenPayload) { if (!viewer.roles.includes("ADMIN")) throw new AppError("forbidden", "Chỉ Admin được xem/xuất nhật ký hệ thống"); }
  return {
    async audit(viewer: AccessTokenPayload, filter: AuditFilter) { admin(viewer); return options.repository.audit(filter,30); },
    async exportAudit(viewer: AccessTokenPayload, filter: AuditFilter, format: "csv" | "json") {
      admin(viewer);
      return options.transaction(async tx=>{
      const data = await options.repository.audit({ ...filter,page:1 },5001,tx);
      if (data.total > 5000 || data.results.length > 5000) throw new AppError("invalid_input", "Tối đa 5.000 sự kiện mỗi lần xuất. Hãy thu hẹp bộ lọc thời gian");
      const fields = ["id","source","action","targetType","targetId","actorId","createdAt","fromStatus","toStatus"] as const;
      function cell(value: string | null) { let v = value ?? ""; if (/^[\s]*[=+@-]/.test(v) || /^[\t\r\n]/.test(v)) v = `'${v}`; return `"${v.replaceAll('"','""')}"`; }
      const content = format === "json" ? JSON.stringify({ exportedAt:clock().toISOString(),count:data.total,events:data.results },null,2)
        : "\uFEFF" + [fields.join(","),...data.results.map(row => fields.map(f => cell(row[f])).join(","))].join("\r\n");
      await options.audit.record({ id:options.id(),actorId:viewer.sub,action:"EXPORT_ACTIVITY",targetType:"AUDIT",targetId:null,
        beforeState:null,afterState:{ count:data.total,format },reason:"Export filtered audit/moderation metadata" },tx);
      return content;
      });
    },
    async journey(viewer: AccessTokenPayload, postId: string, page=1, asOf=clock().toISOString()) {
      validateSnapshot(asOf);
      const data = await options.repository.journey(postId,viewer.sub,page,asOf);
      if (!data) throw new AppError("not_found", "Không tìm thấy vật phẩm của bạn hoặc bạn không có quyền xem hành trình");
      return { ...data,asOf,page,hasMore:page*50<data.total };
    },
    async journeyImage(viewer: AccessTokenPayload, postId: string, kind: JourneyImageKind, imageId: string, asOf=clock().toISOString()) {
      validateSnapshot(asOf);
      const image = await options.repository.journeyImage(postId,viewer.sub,kind,imageId,asOf);
      if (!image) throw new AppError("not_found", "Không tìm thấy ảnh hành trình hoặc bạn không có quyền xem");
      const storage = kind === "POST" ? options.media.post : kind === "CLAIM" ? options.media.claim : options.media.warehouse;
      const resolved = await storage.resolve(image.storageRef,image.format);
      if (!/^image\/(jpeg|png|webp)$/.test(resolved.contentType)) throw new AppError("not_found", "Ảnh hành trình không hợp lệ");
      return resolved;
    }
  };
}
