import { ArrowLeft, Clock3, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { api, type ClaimHistoryResponse, type ClaimStatus } from "../services/api";
import "./claim-history-page.css";

const actionLabels: Record<string, string> = {
  CLAIM_CREATED: "Claim được tạo",
  CONVERSATION_OPENED: "Mở trao đổi riêng",
  CLAIM_ACCEPTED: "Claim được chấp nhận",
  CLAIM_REJECTED: "Claim bị từ chối",
  CLAIM_WITHDRAWN: "Claim được rút",
  MESSAGE_SENT: "Gửi tin nhắn",
  QUESTION_SENT: "Gửi câu hỏi xác minh",
  ANSWER_SUBMITTED: "Trả lời câu hỏi xác minh",
  MORE_INFO_REQUESTED: "Yêu cầu bổ sung thông tin",
  VERIFICATION_ACCEPTED: "Xác minh đủ điều kiện gặp mặt",
  VERIFICATION_DECLINED: "Từ chối claim sau xác minh",
  VERIFICATION_DECISION_CORRECTED: "Điều chỉnh quyết định xác minh",
  CUSTODY_ESCALATED: "Chuyển yêu cầu sang custody",
  STAFF_CUSTODY_VERIFIED: "Staff ghi nhận kết quả xác minh",
  DIRECT_RETURN_COMPLETED: "Ghi nhận hoàn trả trực tiếp",
  PRIVATE_EVIDENCE_UPLOADED: "Thêm bằng chứng riêng"
};

const statusLabels: Record<ClaimStatus, string> = {
  PENDING: "Chờ Finder",
  CONVERSATION_OPEN: "Đang trao đổi",
  NEED_MORE_INFO: "Cần thêm thông tin",
  ACCEPTED: "Đủ điều kiện gặp mặt",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã đóng"
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ClaimHistoryPage() {
  const { claimId = "" } = useParams();
  const { user } = useAuth();
  const [history, setHistory] = useState<ClaimHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setHistory(null);
    void api.getClaimHistory(claimId, controller.signal)
      .then(setHistory)
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không tải được lịch sử claim.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [claimId]);

  const staff = Boolean(user?.roles.some(role => role === "STAFF" || role === "ADMIN"));
  return <main className="claim-history-page">
    <header className="claim-history-heading">
      <ShieldCheck aria-hidden="true" />
      <div><p className="eyebrow">CLAIM AUDIT</p><h1>Lịch sử claim và xác minh</h1><p>Mã claim: {claimId}</p></div>
      <Link className="secondary-button" to={staff ? "/admin/staff" : `/claims/${claimId}`}><ArrowLeft size={16} /> Quay lại</Link>
    </header>
    {loading && <p role="status">Đang tải lịch sử...</p>}
    {error && <p className="claim-history-error" role="alert">{error}</p>}
    {history && <>
      <p className="claim-history-scope">{history.accessScope === "PARTICIPANT"
        ? "Lịch sử hiển thị cho người tham gia claim. Nội dung chat, câu trả lời và bằng chứng riêng không được đưa vào timeline."
        : "Quyền Staff/Admin: chỉ hiển thị sự kiện và metadata an toàn; nội dung chat và dữ liệu xác minh riêng được ẩn."}</p>
      {!history.events.length ? <p className="claim-history-empty">Claim chưa có sự kiện lịch sử.</p> : <ol className="claim-history-timeline">
        {history.events.map(event => <li key={event.id}>
          <span className="claim-history-dot"><Clock3 size={14} /></span>
          <article>
            <header><strong>{actionLabels[event.action] ?? "Cập nhật claim"}</strong><time dateTime={event.createdAt}>{dateTime(event.createdAt)}</time></header>
            <p>{event.actor}</p>
            {(event.fromStatus || event.toStatus) && <p className="claim-history-status">{event.fromStatus ? statusLabels[event.fromStatus] ?? event.fromStatus : "Bắt đầu"} → {event.toStatus ? statusLabels[event.toStatus] ?? event.toStatus : "—"}</p>}
            {event.metadata?.decision && <p>Quyết định: {event.metadata.decision}</p>}
            {event.metadata?.reason && <p>Lý do: {event.metadata.reason}</p>}
            {event.metadata?.communicationOnly && <p>Đây là quyết định trao đổi/gặp mặt, không xác nhận quyền sở hữu.</p>}
          </article>
        </li>)}
      </ol>}
    </>}
  </main>;
}
