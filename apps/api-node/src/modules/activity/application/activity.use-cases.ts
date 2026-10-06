import { AppError } from "../../../shared/domain/app-error.js";
import type { TransactionRunner } from "../../../shared/application/transaction.js";
import type { AccessTokenPayload } from "../../../shared/domain/auth.js";
import type { AdminAuditRepository } from "../../admin/application/index.js";
import type { ActivityRepository, AuditFilter } from "./activity.repository.port.js";

export function createActivityUseCases(options: { repository: ActivityRepository; audit: AdminAuditRepository; transaction:TransactionRunner; id: () => string; now?: () => Date }) {
  const clock = options.now ?? (() => new Date());
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
      if (new Date(asOf).getTime() > clock().getTime()+1000) throw new AppError("invalid_input", "Mốc hành trình không hợp lệ");
      const data = await options.repository.journey(postId,viewer.sub,page,asOf);
      if (!data) throw new AppError("not_found", "Không tìm thấy vật phẩm của bạn hoặc bạn không có quyền xem hành trình");
      return { ...data,asOf,page,hasMore:page*50<data.total };
    }
  };
}
