import { AppError } from "../../../shared/domain/app-error.js";
import type { TransactionRunner, TransactionContext } from "../../../shared/application/transaction.js";
import type { NotificationRepository, NotificationEmailQueue } from "../../notifications/application/index.js";
import type { Appointment, AppointmentRepository } from "./appointment.repository.port.js";

export type AppointmentAction = "ACCEPT" | "REJECT" | "CANCEL" | "CONFIRM" | "DISPUTE" | "NO_SHOW";
export function createAppointmentUseCases(options: {
  repository: AppointmentRepository; transaction: TransactionRunner; id: () => string;
  hash: (value: string) => string; notifications: NotificationRepository; emails: NotificationEmailQueue;
  now?: () => Date; reminderLeadMinutes?: number;
}) {
  const { repository: repo } = options;
  const now = options.now ?? (() => new Date());
  async function ready() {
    if (!await repo.schemaReady()) throw new AppError("unavailable", "Lịch hẹn cần migration 063_appointment_workflow.sql. Vui lòng liên hệ quản trị.");
  }
  function participant(a: { finderId: string; ownerId: string }, userId: string) {
    if (userId !== a.finderId && userId !== a.ownerId) throw new AppError("forbidden", "Bạn không tham gia lịch hẹn này");
  }
  async function notify(a: Appointment, action: string, tx: TransactionContext, reminder = false) {
    for (const userId of new Set([a.finderId, a.ownerId])) {
      const notification = await options.notifications.create({ userId, type: a.status === "COMPLETED" ? "RETURN_UPDATED" : "APPOINTMENT_UPDATED",
        title: reminder ? "Sắp đến lịch hẹn trả đồ" : "Lịch hẹn trả đồ đã cập nhật", body: "Mở lịch hẹn để kiểm tra thông tin và trạng thái.",
        entityType: reminder ? "APPOINTMENT_REMINDER" : "APPOINTMENT", entityId: a.id,
        dedupeKey: `appointment:${a.id}:${a.version}:${action}:${userId}` }, tx);
      if (notification) await options.emails.enqueue({ notification, recipientUserId: userId, eventType: "APPOINTMENT" }, tx);
    }
  }
  async function replay(userId: string, key: string, hash: string, tx: TransactionContext) {
    const previous = await repo.replay(userId, key, tx);
    if (!previous) return null;
    if (previous.hash !== hash) throw new AppError("conflict", "Mã thao tác đã được dùng cho nội dung khác");
    const a = await repo.find(previous.appointmentId, tx);
    if (!a) throw new AppError("conflict", "Không tìm thấy kết quả thao tác trước");
    participant(a, userId);
    return a;
  }
  return {
    async list(userId: string, page = 1, claimId?: string) { await ready(); return repo.list(userId, page, claimId); },
    async get(userId: string, id: string) {
      await ready(); const a = await repo.find(id);
      if (!a) throw new AppError("not_found", "Không tìm thấy lịch hẹn");
      participant(a, userId); return a;
    },
    async create(userId: string, input: { claimId: string; proposedAt: string; handoverPointId: string; requestKey: string }) {
      await ready();
      const date = new Date(input.proposedAt);
      const hash = options.hash(JSON.stringify(["CREATE", input.claimId, input.proposedAt, input.handoverPointId]));
      return options.transaction(async tx => {
        const context = await repo.context(input.claimId, tx);
        if (!context) throw new AppError("not_found", "Không tìm thấy cuộc trao đổi");
        participant(context, userId);
        const previous = await replay(userId, input.requestKey, hash, tx); if (previous) return previous;
        if (!context.eligible || !await repo.assertSafe(context, tx)) throw new AppError("conflict", "Chưa đủ điều kiện đặt lịch hoặc vật phẩm đang do kho/tranh chấp xử lý");
        if (!Number.isFinite(date.getTime()) || date.getTime() < now().getTime() + 60_000 || date.getTime() > now().getTime() + 90 * 86_400_000)
          throw new AppError("invalid_input", "Lịch hẹn phải sau hiện tại ít nhất 1 phút và trong 90 ngày");
        if (!await repo.pointExists(input.handoverPointId, tx)) throw new AppError("invalid_input", "Điểm hẹn không còn hoạt động");
        if (await repo.active(input.claimId, tx)) throw new AppError("conflict", "Cuộc trao đổi đã có lịch hẹn đang hoạt động");
        const id = options.id();
        await repo.create({ id, ...input, postId: context.postId, proposerId: userId, proposedAt: date }, tx);
        await repo.event({ id: options.id(), appointmentId: id, actorId: userId, action: "PROPOSED", key: input.requestKey, hash }, tx);
        const a = (await repo.find(id, tx))!; await notify(a, "PROPOSED", tx); return a;
      });
    },
    async act(userId: string, id: string, input: { action: AppointmentAction; version: number; requestKey: string; physicallyChecked?: boolean; reason?: string }) {
      await ready();
      const reason=input.reason?.trim();
      const hash = options.hash(JSON.stringify([id, input.action, input.version, Boolean(input.physicallyChecked),reason ?? ""]));
      const initial = await repo.find(id);
      if (!initial) throw new AppError("not_found", "Không tìm thấy lịch hẹn");
      participant(initial, userId);
      return options.transaction(async tx => {
        const context = await repo.context(initial.claimId, tx);
        if (!context) throw new AppError("not_found", "Không tìm thấy cuộc trao đổi");
        const previous = await replay(userId, input.requestKey, hash, tx); if (previous) return previous;
        const a = (await repo.find(id, tx))!;
        if (a.version === 0) throw new AppError("conflict", "Lịch hẹn cũ chỉ có thể xem; cần quản trị đối soát trước khi chuyển đổi xác nhận");
        if (a.version !== input.version) throw new AppError("conflict", "Lịch hẹn vừa thay đổi. Vui lòng tải lại trước khi xác nhận");
        if (a.custodyAuthorized || ["COMPLETED", "REJECTED", "CANCELLED"].includes(a.status)) throw new AppError("conflict", "Lịch hẹn đã kết thúc");
        const time = now();
        if (input.action === "CANCEL" || input.action === "REJECT") {
          if (input.action === "REJECT" && (a.status !== "PENDING" || a.proposerId === userId)) throw new AppError("conflict", "Chỉ người nhận đề xuất mới được từ chối lịch chờ");
          const noHandover=a.finderResponse === "PENDING" && a.ownerResponse === "PENDING";
          const mutualDispute=a.finderResponse === "DISPUTED" && a.ownerResponse === "DISPUTED";
          if (!noHandover && !mutualDispute) throw new AppError("conflict", "Đã có xác nhận hoặc mâu thuẫn một phía; cần hai bên đối soát trước khi hủy lịch");
          if(input.action === "CANCEL" && (!reason || reason.length < 3 || reason.length > 500)) throw new AppError("invalid_input", "Lý do hủy lịch cần từ 3 đến 500 ký tự");
          a.status = input.action === "CANCEL" ? "CANCELLED" : "REJECTED";
        } else {
          if (!context.eligible || !await repo.assertSafe(context, tx)) throw new AppError("conflict", "Vật phẩm đang do kho hoặc tranh chấp xử lý; không thể hoàn tất trả trực tiếp");
          if (input.action === "ACCEPT") {
            if (a.status !== "PENDING" || a.proposerId === userId || new Date(a.proposedAt).getTime() <= time.getTime()) throw new AppError("conflict", "Chỉ bên còn lại được chấp nhận lịch chưa diễn ra");
            a.status = "ACCEPTED";
          } else {
            if (a.status !== "ACCEPTED" || new Date(a.proposedAt).getTime() > time.getTime()) throw new AppError("conflict", "Chỉ ghi nhận bàn giao/không đến sau giờ hẹn đã được chấp nhận");
            if (input.action === "NO_SHOW") {
              if (time.getTime() < new Date(a.proposedAt).getTime() + 15 * 60_000) throw new AppError("conflict", "Chờ ít nhất 15 phút sau giờ hẹn để báo không đến");
              if (a.finderResponse !== "PENDING" || a.ownerResponse !== "PENDING") throw new AppError("conflict", "Đã có xác nhận hoặc mâu thuẫn bàn giao; cần đối soát thay vì báo không đến");
              a.noShowUserId = userId === a.finderId ? a.ownerId : a.finderId; a.status = "CANCELLED";
            } else {
              if (input.action === "CONFIRM" && !input.physicallyChecked) throw new AppError("invalid_input", "Hãy xác nhận đã trực tiếp đối chiếu và bàn giao/nhận đúng vật phẩm");
              const response = input.action === "CONFIRM" ? "CONFIRMED" : "DISPUTED";
              if (userId === a.finderId) a.finderResponse = response; else a.ownerResponse = response;
              if (a.finderResponse === "CONFIRMED" && a.ownerResponse === "CONFIRMED") { a.status = "COMPLETED"; a.completedAt = time.toISOString(); }
            }
          }
        }
        a.version++;
        const action = input.action === "CONFIRM" || input.action === "DISPUTE" ? `${userId === a.finderId ? "FINDER" : "OWNER"}_${input.action}` : input.action;
        await repo.update(a, time, tx);
        await repo.event({ id: options.id(), appointmentId: id, actorId: userId, action, key: input.requestKey, hash, note:reason }, tx);
        if (a.status === "COMPLETED") await repo.event({ id: options.id(), appointmentId: id, actorId: userId, action: "RETURN_COMPLETED" }, tx);
        await notify(a, action, tx); return (await repo.find(id, tx))!;
      });
    },
    async queueReminders() {
      await ready(); let queued = 0; const time = now();
      for (const id of await repo.dueReminders(time,options.reminderLeadMinutes ?? 30)) {
        const first = await repo.find(id); if (!first) continue;
        await options.transaction(async tx => {
          const context = await repo.context(first.claimId, tx);
          if (!context?.eligible || !await repo.assertSafe(context, tx)) return;
          const a = await repo.find(id, tx);
          if (!a || a.status !== "ACCEPTED" || a.custodyAuthorized || new Date(a.proposedAt).getTime() <= time.getTime()) return;
          if (!await repo.markReminded(id, time, tx)) return;
          await notify(a, "REMINDER", tx, true);
          await repo.event({ id: options.id(), appointmentId: id, actorId: null, action: "REMINDER_QUEUED" }, tx); queued++;
        });
      }
      return { queued };
    }
  };
}
