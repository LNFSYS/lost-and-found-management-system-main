import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type ImgHTMLAttributes } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  FileText,
  Filter,
  History,
  ImagePlus,
  Inbox,
  Info,
  Layers3,
  LoaderCircle,
  MapPin,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  User,
  UserCheck,
  X,
  XCircle
} from "lucide-react";
import {
  api,
  ApiError,
  type ClaimHistoryResponse,
  type ClaimStatus,
  type CustodyIntakeContext,
  type CustodyRequest,
  type CustodyRequestListResponse,
  type CustodyRequestStatus,
  type WarehouseCatalog,
  type WarehouseDashboard,
  type WarehouseItem,
  type WarehouseStatus,
  type WarehouseStorageLog,
  type WarehouseImage,
  type WarehouseConversationExtraction
} from "../services/api";

import { WarehouseIntakeDialog } from "../components/warehouse-intake-dialog";
import { AccessibleDialog } from "../components/accessible-dialog";
import { useModalFocus } from "../hooks/use-modal-focus";
import { WarehouseImageGallery, WarehouseImageView } from "../components/warehouse-images";

import { WarehouseDisposition } from "../components/warehouse-disposition";
import { WarehouseConversationChat } from "../components/warehouse-conversation-chat";

type StaffTab = "custody" | "warehouse" | "dashboard" | "logs";
type PendingAction = "" | "load" | "create" | "update" | "logs" | "custody" | "custody-action";

const returnTextRules = {
  receiverName: { min: 2, max: 150, message: "Họ và tên người nhận phải có từ 2 đến 150 ký tự." },
  receiverPhone: { min: 9, max: 20, message: "Số điện thoại phải có từ 9 đến 20 ký tự." },
  receiverIdentity: { min: 3, max: 100, message: "Mã thẻ SV / CMND / CCCD phải có từ 3 đến 100 ký tự." },
  note: { min: 0, max: 1000, message: "Ghi chú bàn giao không được vượt quá 1000 ký tự." }
};
type ReturnTextField = keyof typeof returnTextRules;

function returnTextError(field: ReturnTextField, value: string) {
  const rule = returnTextRules[field];
  const length = value.trim().length;
  return length < rule.min || length > rule.max ? rule.message : "";
}

const statusOptions: Array<{ value: WarehouseStatus; label: string }> = [
  { value: "RECEIVED", label: "Đã tiếp nhận" },
  { value: "STORED", label: "Đang lưu kho" },
  { value: "CLAIMED", label: "Đang đợi nhận" },
  { value: "RETURNED", label: "Đã trả" },
  { value: "EXPIRED", label: "Quá hạn" },
  { value: "DISPOSED", label: "Đã xử lý" },
  { value: "DONATED", label: "Đã quyên góp" },
  { value: "TRANSFERRED", label: "Đã chuyển giao" }
];

const custodyStatusLabels: Record<CustodyRequestStatus, { label: string; icon: ReactNode }> = {
  PENDING: { label: "Chờ tiếp nhận", icon: <Clock3 size={14} /> },
  ACCEPTED: { label: "Chờ tiếp nhận (yêu cầu cũ)", icon: <UserCheck size={14} /> },
  REJECTED: { label: "Từ chối", icon: <XCircle size={14} /> },
  CANCELLED: { label: "Đã hủy", icon: <XCircle size={14} /> },
  INTAKED: { label: "Đã tiếp nhận", icon: <CheckCircle2 size={14} /> }
};

const claimActionLabels: Record<string, string> = {
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

const claimStatusLabels: Record<ClaimStatus, string> = {
  PENDING: "Chờ Finder",
  CONVERSATION_OPEN: "Đang trao đổi",
  NEED_MORE_INFO: "Cần thêm thông tin",
  ACCEPTED: "Đủ điều kiện gặp mặt",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã đóng"
};

const emptyFilters = { q: "", status: "", handoverPointId: "", overdue: false };
const emptyRejectForm = { reason: "" };

function messageOf(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function clean(value: string) {
  const next = value.trim();
  return next ? next : null;
}

function formatDate(value: string | null) {
  if (!value) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: WarehouseStatus | string | null) {
  return statusOptions.find((item) => item.value === status)?.label ?? status ?? "Chưa rõ";
}

function nextStatus(status: WarehouseStatus): WarehouseStatus {
  if (status === "RECEIVED") return "STORED";
  return status;
}

function ProofImage({ proofId, onPreview, ...props }: ImgHTMLAttributes<HTMLImageElement> & { proofId: string; onPreview: (url: string) => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true, objectUrl = "";
    api.getWarehouseProof(proofId).then(blob => { objectUrl = URL.createObjectURL(blob); if (active) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl); }).catch(() => setUrl(""));
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [proofId]);
  return url ? <img {...props} src={url} onClick={() => onPreview(url)} /> : <span>Ảnh riêng tư</span>;
}

function Pagination({ page, pageSize, total, busy, onPage }: { page: number; pageSize: number; total: number; busy: boolean; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="warehouse-pagination" aria-label="Phân trang">
      <div className="warehouse-pagination__info">
        <span>Trang <strong>{page}</strong> / <strong>{pages}</strong></span>
        <span className="warehouse-pagination__badge">{total} mục</span>
      </div>
      <div className="warehouse-pagination__actions">
        <button
          type="button"
          className="secondary-button"
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <ChevronLeft size={16} />
          <span>Trước</span>
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy || page >= pages}
          onClick={() => onPage(page + 1)}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <span>Sau</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}

function isOverdue(item: WarehouseItem) {
  return Boolean(item.retentionDeadline && new Date(item.retentionDeadline).getTime() < Date.now() && !["RETURNED", "DISPOSED", "DONATED", "TRANSFERRED"].includes(item.status));
}

function StatCard({ icon, value, label, tone = "blue" }: { icon: ReactNode; value: number; label: string; tone?: "blue" | "orange" | "green" | "red" }) {
  return (
    <article className={`admin-stat warehouse-stat warehouse-stat--${tone}`}>
      <span className="warehouse-stat__icon">{icon}</span>
      <div className="warehouse-stat__content">
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

function ItemMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="item-meta-cell">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/* ─────────────── Custody Request Detail Modal ─────────────── */

function CustodyDetailModal({
  request,
  catalog,
  onClose,
  onIntake,
  onReject
}: {
  request: CustodyRequest;
  catalog: WarehouseCatalog | null;
  onClose: () => void;
  onIntake: (req: CustodyRequest) => void;
  onReject: (req: CustodyRequest) => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(modalRef, true, onClose);

  const [loading, setLoading] = useState(true);
  const [claimHistory, setClaimHistory] = useState<ClaimHistoryResponse | null>(null);
  const [claimHistoryError, setClaimHistoryError] = useState("");
  const [intakeContext, setIntakeContext] = useState<CustodyIntakeContext | null>(null);
  const [contextError, setContextError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setClaimHistory(null);
    setClaimHistoryError("");
    setIntakeContext(null);
    setContextError("");

    const promises: Promise<unknown>[] = [
      api.getCustodyIntakeContext(request.id).then((ctx) => {
        if (active) setIntakeContext(ctx);
      }).catch((err) => {
        if (active) setContextError(err instanceof Error ? err.message : "Không tải được bài đăng");
      })
    ];

    if (request.claimId) {
      promises.push(
        api.getClaimHistory(request.claimId).then((history) => {
          if (active) setClaimHistory(history);
        }).catch((err) => {
          if (active) setClaimHistoryError(err instanceof Error ? err.message : "Không tải được lịch sử claim");
        })
      );
    }

    Promise.allSettled(promises).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [request.id, request.claimId]);

  const statusCfg = custodyStatusLabels[request.status];

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, []);

  return (
    <div className="custody-modal-overlay warehouse-detail-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        tabIndex={-1}
        className="warehouse-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custody-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="warehouse-detail-modal__header">
          <span className="panel-icon-badge" style={{ background: "#eff6ff", color: "#2563eb" }}>
            <ShieldCheck size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="custody-detail-title">
              Chi tiết yêu cầu bàn giao #{request.id.slice(0, 8)}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
              Tạo lúc {formatDateTime(request.createdAt)} · Hình thức: {request.intakeType === "CUSTODY_TRANSFER" ? "Bàn giao trực tuyến" : "Walk-in tại quầy"}
            </p>
          </div>
          <button type="button" className="close-btn" aria-label="Đóng chi tiết" title="Đóng chi tiết" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="warehouse-detail-modal__body">
          {/* CỘT TRÁI: THÔNG TIN VẬT PHẨM & BÀN GIAO */}
          <div className="warehouse-selected-summary">
            <div className="summary-header">
              <span className={`warehouse-status warehouse-status--${request.status === "PENDING" ? "received" : request.status === "ACCEPTED" ? "stored" : request.status === "INTAKED" ? "claimed" : "expired"}`}>
                {statusCfg?.icon}
                <span>{statusCfg?.label ?? request.status}</span>
              </span>
              <code className="code-badge">#{request.id.slice(0, 8)}</code>
            </div>

            <h3>{request.post?.title ?? intakeContext?.post.title ?? request.photoSource?.title ?? "Bàn giao vật phẩm tìm thấy"}</h3>

            {intakeContext?.images && intakeContext.images.length > 0 ? (
              <WarehouseImageGallery images={intakeContext.images} />
            ) : (
              <WarehouseImageView
                image={
                  request.post?.thumbnailId
                    ? { id: request.post.thumbnailId, provenance: "SOURCE_POST" }
                    : request.photoSource
                    ? { id: request.photoSource.imageId, provenance: "CONTACT_PHOTO" }
                    : null
                }
              />
            )}
            {contextError && <p className="field-error" role="alert">{contextError}</p>}

            <h4>Mô tả vật phẩm bài đăng</h4>
            <p className="summary-desc">
              {intakeContext?.post.description ?? "Không có mô tả chi tiết."}
            </p>

            {request.reason && (
              <>
                <h4>Lý do / Ghi chú bàn giao</h4>
                <p className="summary-desc" style={{ fontStyle: "italic", color: "#475569" }}>
                  "{request.reason}"
                </p>
              </>
            )}

            {request.rejectionReason && (
              <div style={{ margin: "14px 0", padding: "12px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b" }}>
                <strong>Lý do từ chối:</strong> {request.rejectionReason}
              </div>
            )}

            <dl className="warehouse-detail-meta">
              <ItemMeta
                label="Danh mục"
                value={
                  catalog?.categories.find((c) => c.id === intakeContext?.post.categoryId)?.name ??
                  "Chưa ghi nhận"
                }
              />
              <ItemMeta label="Người bàn giao" value={request.requester.fullName ?? "Không rõ"} />
              <ItemMeta
                label="Liên hệ Finder"
                value={intakeContext?.post.finderContact ?? "Chưa có số liên hệ"}
              />
              <ItemMeta
                label="Điểm tiếp nhận"
                value={request.handoverPoint?.name ?? "Tại quầy"}
              />
              <ItemMeta
                label="Địa chỉ điểm nhận"
                value={request.handoverPoint?.address ?? "Chưa ghi nhận"}
              />
              <ItemMeta
                label="Vị trí nhặt được"
                value={
                  [
                    catalog?.areas.find((a) => a.id === intakeContext?.post.areaId)?.name,
                    catalog?.buildings.find((b) => b.id === intakeContext?.post.buildingId)?.name,
                    intakeContext?.post.roomText
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Chưa ghi nhận"
                }
              />
              <ItemMeta
                label="Hình thức"
                value={request.intakeType === "CUSTODY_TRANSFER" ? "Online (Bàn giao trực tuyến)" : "Walk-in (Tại quầy)"}
              />
              <ItemMeta label="Gửi yêu cầu lúc" value={formatDateTime(request.createdAt)} />
              {request.confirmedHandoverAt && (
                <ItemMeta label="Hẹn bàn giao lúc" value={formatDateTime(request.confirmedHandoverAt)} />
              )}
              {request.requestedIntakeAt && (
                <ItemMeta label="Giờ Finder đề xuất" value={formatDateTime(request.requestedIntakeAt)} />
              )}
              {request.handler && (
                <ItemMeta label="Nhân viên xử lý" value={request.handler.fullName ?? "Staff"} />
              )}
            </dl>

            <div className="summary-action-bar" style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
              {["PENDING", "ACCEPTED"].includes(request.status) && (
                <>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ color: "#dc2626", borderColor: "#fecaca" }}
                    onClick={() => onReject(request)}
                  >
                    <XCircle size={16} /> Từ chối tiếp nhận
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onIntake(request)}
                  >
                    <PackageCheck size={16} /> Tiếp nhận vật phẩm vào kho
                  </button>
                </>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: LỊCH SỬ CLAIM & XÁC MINH */}
          <div className="warehouse-log-list">
            <div className="admin-list-heading" style={{ marginBottom: "16px" }}>
              <div>
                <p className="eyebrow">XÁC MINH & ĐỐI CHIẾU</p>
                <h2 style={{ fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={18} color="#2563eb" />
                  Lịch sử Claim & Xác minh
                </h2>
                {request.claimId ? (
                  <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                    Mã Claim: <code>#{request.claimId.slice(0, 8)}</code>
                  </p>
                ) : (
                  <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                    Tiếp nhận trực tiếp / không qua claim
                  </p>
                )}
              </div>
            </div>

            {loading && (
              <div className="loading-inline" style={{ padding: "20px 0" }}>
                <LoaderCircle className="spin-icon" size={18} /> Đang tải dữ liệu lịch sử xác minh...
              </div>
            )}

            {claimHistoryError && (
              <div className="warehouse-log-error" role="alert" style={{ marginBottom: "12px" }}>
                <p className="field-error">{claimHistoryError}</p>
              </div>
            )}

            {!request.claimId && !loading && (
              <div style={{ padding: "24px 16px", textAlign: "center", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                <Info size={28} color="#64748b" style={{ margin: "0 auto 8px" }} />
                <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "#334155" }}>
                  Yêu cầu bàn giao trực tiếp tại quầy
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Yêu cầu này không thông qua luồng claim đối chiếu giữa người mất và người nhặt.
                </p>
              </div>
            )}

            {request.claimId && !loading && claimHistory && (
              <>
                {claimHistory.events.length === 0 ? (
                  <div style={{ padding: "20px 16px", textAlign: "center", color: "#64748b", fontStyle: "italic" }}>
                    Chưa có sự kiện nào được ghi nhận cho claim này.
                  </div>
                ) : (
                  <div className="timeline-log">
                    {claimHistory.events.map((event) => (
                      <article key={event.id} className="timeline-log__item">
                        <div className="timeline-log__marker" />
                        <div className="timeline-log__content">
                          <strong style={{ fontSize: "0.9rem", color: "#0f172a" }}>
                            {claimActionLabels[event.action] ?? event.action}
                          </strong>
                          <span className="timeline-log__meta">
                            {event.actor} • {formatDateTime(event.createdAt)}
                          </span>

                          {(event.fromStatus || event.toStatus) && (
                            <p style={{ margin: "4px 0 2px", fontSize: "0.82rem", color: "#2563eb", fontWeight: 600 }}>
                              {event.fromStatus ? claimStatusLabels[event.fromStatus] ?? event.fromStatus : "Bắt đầu"} → {event.toStatus ? claimStatusLabels[event.toStatus] ?? event.toStatus : "—"}
                            </p>
                          )}

                          {event.metadata?.decision && (
                            <p className="timeline-log__notes" style={{ margin: "4px 0 2px" }}>
                              <strong>Quyết định:</strong> {event.metadata.decision}
                            </p>
                          )}

                          {event.metadata?.reason && (
                            <p className="timeline-log__notes" style={{ margin: "4px 0 2px" }}>
                              <strong>Lý do:</strong> {event.metadata.reason}
                            </p>
                          )}

                          {event.metadata?.communicationOnly && (
                            <p style={{ margin: "4px 0 2px", fontSize: "0.78rem", color: "#64748b", fontStyle: "italic" }}>
                              (Đây là quyết định trao đổi/gặp mặt, không xác nhận quyền sở hữu)
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="custody-modal-actions" style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
          <button type="button" className="secondary-button" onClick={onClose}>
            Đóng
          </button>
          {["PENDING", "ACCEPTED"].includes(request.status) && (
            <button
              type="button"
              className="primary-button"
              onClick={() => onIntake(request)}
            >
              <PackageCheck size={16} /> Tiếp nhận vật phẩm
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Custody Queue Tab ─────────────── */

function CustodyQueueTab({
  catalog,
  custodyData,
  pendingAction,
  error,
  notice,
  onRefreshCustody,
  onNotice,
  onError,
  setPendingAction
}: {
  catalog: WarehouseCatalog | null;
  custodyData: CustodyRequestListResponse | null;
  pendingAction: PendingAction;
  error: string;
  notice: string;
  onRefreshCustody: (filters?: { status?: string; handoverPointId?: string; q?: string }, page?: number) => Promise<void>;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
  setPendingAction: (action: PendingAction) => void;
}) {
  const [rejectModal, setRejectModal] = useState<CustodyRequest | null>(null);
  const [intakeModal, setIntakeModal] = useState<CustodyRequest | null>(null);
  const [detailModal, setDetailModal] = useState<CustodyRequest | null>(null);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [rejectForm, setRejectForm] = useState(emptyRejectForm);
  const [custodyFilters, setCustodyFilters] = useState<{ status: string; handoverPointId: string; q: string }>({
    status: "ALL",
    handoverPointId: "",
    q: ""
  });

  const isCustodyFirstMount = useRef(true);
  useEffect(() => {
    if (isCustodyFirstMount.current) {
      isCustodyFirstMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void onRefreshCustody(custodyFilters, 1);
    }, 280);
    return () => clearTimeout(timer);
  }, [custodyFilters.q]);

  function updateCustodyFilter<K extends keyof typeof custodyFilters>(key: K, value: typeof custodyFilters[K]) {
    const next = { ...custodyFilters, [key]: value };
    setCustodyFilters(next);
    if (key !== "q") {
      void onRefreshCustody(next, 1);
    }
  }

  const filteredRequests = useMemo(() => {
    if (!custodyData?.items) return [];
    return custodyData.items;
  }, [custodyData]);

  const [createdWalkInItem, setCreatedWalkInItem] = useState<WarehouseItem | null>(null);

  function submitCustodyFilters(event: FormEvent) {
    event.preventDefault();
    void onRefreshCustody(custodyFilters, 1);
  }

  async function submitReject(event: FormEvent) {
    event.preventDefault();
    if (!rejectModal) return;
    setPendingAction("custody-action");
    onError("");
    onNotice("");
    try {
      await api.rejectCustodyRequest(rejectModal.id, { reason: rejectForm.reason });
      onNotice("Đã từ chối yêu cầu bàn giao");
      setRejectModal(null);
      setRejectForm(emptyRejectForm);
      await onRefreshCustody(custodyFilters);
    } catch (reason) {
      onError(messageOf(reason, "Không thể từ chối yêu cầu"));
    } finally {
      setPendingAction("");
    }
  }

  return (
    <>
      {/* Stats summary banner */}
      <div className="admin-stats warehouse-stats" aria-label="Thống kê hàng đợi bàn giao">
        <StatCard icon={<Clock3 size={20} />} value={(custodyData?.counts.PENDING ?? 0) + (custodyData?.counts.ACCEPTED ?? 0)} label="Chờ tiếp nhận" tone="orange" />
        <StatCard icon={<CheckCircle2 size={20} />} value={custodyData?.counts.INTAKED ?? 0} label="Đã tiếp nhận" tone="green" />
        <StatCard icon={<XCircle size={20} />} value={(custodyData?.counts.REJECTED ?? 0) + (custodyData?.counts.CANCELLED ?? 0)} label="Từ chối / Hủy" tone="red" />
      </div>

      {notice && (
        <div className="staff-alert staff-alert--success">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button type="button" onClick={() => onNotice("")} aria-label="Đóng"><X size={14} /></button>
        </div>
      )}
      {error && (
        <div className="staff-alert staff-alert--error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => onError("")} aria-label="Đóng"><X size={14} /></button>
        </div>
      )}

      {/* Main Custody Queue Section - Spans Full Width */}
      <section className="warehouse-main custody-queue-full">
        <div className="custody-toolbar" style={{ marginBottom: "16px" }}>
          <div className="admin-list-heading">
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>HÀNG ĐỜI BÀN GIAO</h2>
          </div>

          <button
            type="button"
            className="primary-button add-walkin-btn"
            onClick={() => setWalkInModalOpen(true)}
          >
            <Plus size={16} />
            <span>Tiếp nhận Walk-in (Tại quầy)</span>
          </button>
        </div>

        {/* Bộ lọc và tìm kiếm đồng bộ với Kho tài sản */}
        <form className="warehouse-filter-bar" onSubmit={submitCustodyFilters}>
          <label className="input-field search-field">
            <span>Tìm kiếm yêu cầu</span>
            <div className="input-with-icon" style={{ position: "relative" }}>
              <Search size={16} />
              <input
                aria-label="Tìm yêu cầu bàn giao"
                value={custodyFilters.q}
                onChange={(event) => updateCustodyFilter("q", event.target.value)}
                placeholder="Tên người gửi, tiêu đề, mã đơn..."
                style={{ paddingRight: custodyFilters.q ? "32px" : undefined }}
              />
              {custodyFilters.q && (
                <button
                  type="button"
                  aria-label="Xóa từ khóa tìm kiếm"
                  onClick={() => updateCustodyFilter("q", "")}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </label>

          <label className="input-field">
            <span>Trạng thái</span>
            <select
              value={custodyFilters.status}
              onChange={(event) => updateCustodyFilter("status", event.target.value)}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="AWAITING_INTAKE">Chờ tiếp nhận ({(custodyData?.counts.PENDING ?? 0) + (custodyData?.counts.ACCEPTED ?? 0)})</option>
              <option value="PENDING">Chờ duyệt (PENDING)</option>
              <option value="ACCEPTED">Đã duyệt (ACCEPTED)</option>
              <option value="INTAKED">Đã tiếp nhận (INTAKED)</option>
              <option value="REJECTED">Đã từ chối (REJECTED)</option>
              <option value="CANCELLED">Đã hủy (CANCELLED)</option>
            </select>
          </label>

          <label className="input-field">
            <span>Điểm bàn giao</span>
            <select
              value={custodyFilters.handoverPointId}
              onChange={(event) => updateCustodyFilter("handoverPointId", event.target.value)}
            >
              <option value="">Tất cả điểm</option>
              {catalog?.handoverPoints.map((point) => (
                <option key={point.id} value={point.id}>{point.name}</option>
              ))}
            </select>
          </label>

          <button type="submit" className="secondary-button search-btn">
            <Filter size={16} /> Lọc
          </button>
        </form>

        <div className="custody-request-list warehouse-item-list">
          {filteredRequests.map((request) => {
            const statusCfg = custodyStatusLabels[request.status];
            return (
              <article
                key={request.id}
                className="warehouse-item-card warehouse-item-card--interactive"
                style={{
                  borderLeftColor:
                    request.status === "PENDING"
                      ? "#f97316"
                      : request.status === "ACCEPTED"
                      ? "#2563eb"
                      : request.status === "INTAKED"
                      ? "#16a34a"
                      : "#ef4444"
                }}
                onClick={() => setDetailModal(request)}
              >
                <div
                  className="warehouse-card-thumbnail"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailModal(request);
                  }}
                  title="Nhấp để xem chi tiết & lịch sử claim"
                >
                  <WarehouseImageView
                    image={
                      request.post?.thumbnailId
                        ? { id: request.post.thumbnailId, provenance: "SOURCE_POST" }
                        : request.photoSource
                        ? { id: request.photoSource.imageId, provenance: "CONTACT_PHOTO" }
                        : null
                    }
                    expandable={false}
                  />
                </div>

                <div className="warehouse-card-body">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap" }}>
                    <span
                      className={`warehouse-status warehouse-status--${
                        request.status === "PENDING"
                          ? "received"
                          : request.status === "ACCEPTED"
                          ? "stored"
                          : request.status === "INTAKED"
                          ? "claimed"
                          : "expired"
                      }`}
                    >
                      {statusCfg?.icon}
                      <span>{statusCfg?.label ?? request.status}</span>
                    </span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>#{request.id.slice(0, 8)}</span>
                  </div>

                  <h2
                    title={request.post?.title ?? request.photoSource?.title ?? "Bàn giao vật phẩm tìm thấy"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailModal(request);
                    }}
                  >
                    {request.post?.title ?? request.photoSource?.title ?? "Bàn giao vật phẩm tìm thấy"}
                  </h2>

                  {request.reason && (
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      "{request.reason}"
                    </p>
                  )}

                  <dl className="warehouse-card-meta">
                    <ItemMeta label="Người gửi" value={request.requester.fullName ?? "Không rõ"} />
                    <ItemMeta label="Điểm nhận" value={request.handoverPoint?.name ?? "Tại quầy"} />
                    <ItemMeta label="Hình thức" value={request.intakeType === "CUSTODY_TRANSFER" ? "Online" : "Walk-in"} />
                    <ItemMeta label="Tạo lúc" value={<time dateTime={request.createdAt}>{formatDateTime(request.createdAt)}</time>} />
                    {request.confirmedHandoverAt && (
                      <ItemMeta label="Hẹn nhận" value={<time dateTime={request.confirmedHandoverAt}>{formatDateTime(request.confirmedHandoverAt)}</time>} />
                    )}
                    {request.rejectionReason && (
                      <ItemMeta label="Từ chối" value={<span style={{ color: "#dc2626" }}>{request.rejectionReason}</span>} />
                    )}
                  </dl>
                </div>

                <div className="warehouse-card-actions" onClick={(e) => e.stopPropagation()}>
                  {request.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        className="secondary-button warehouse-select-button"
                        style={{ color: "#dc2626", borderColor: "#fecaca" }}
                        onClick={() => { setRejectForm(emptyRejectForm); setRejectModal(request); }}
                        disabled={Boolean(pendingAction)}
                      >
                        <XCircle size={15} /> Từ chối
                      </button>
                      <button
                        type="button"
                        className="primary-button warehouse-select-button"
                        onClick={() => setIntakeModal(request)}
                        disabled={Boolean(pendingAction)}
                      >
                        <PackageCheck size={16} /> Tiếp nhận
                      </button>
                    </>
                  )}

                  {request.status === "ACCEPTED" && (
                    <>
                      <button
                        type="button"
                        className="secondary-button warehouse-select-button"
                        style={{ color: "#dc2626", borderColor: "#fecaca" }}
                        onClick={() => { setRejectForm(emptyRejectForm); setRejectModal(request); }}
                        disabled={Boolean(pendingAction)}
                      >
                        <XCircle size={15} /> Từ chối
                      </button>
                      <button
                        type="button"
                        className="primary-button warehouse-select-button primary-button--success"
                        onClick={() => setIntakeModal(request)}
                        disabled={Boolean(pendingAction)}
                      >
                        <PackageCheck size={16} /> Tiếp nhận
                      </button>
                    </>
                  )}

                  {!["PENDING", "ACCEPTED"].includes(request.status) && (
                    <button
                      type="button"
                      className="secondary-button warehouse-select-button"
                      style={{ gridColumn: "1 / -1" }}
                      onClick={() => setDetailModal(request)}
                    >
                      <History size={16} /> Xem chi tiết & lịch sử
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {!filteredRequests.length && (
            <div className="warehouse-empty">
              <Inbox size={48} className="empty-icon" />
              <h3>Chưa có yêu cầu bàn giao</h3>
              <p>Hiện không có yêu cầu bàn giao nào phù hợp với bộ lọc.</p>
            </div>
          )}
        </div>

        {custodyData && (
          <Pagination
            page={custodyData.page}
            pageSize={custodyData.pageSize}
            total={custodyData.total}
            busy={Boolean(pendingAction)}
            onPage={page => void onRefreshCustody(custodyFilters, page)}
          />
        )}
      </section>

      {walkInModalOpen && <WarehouseIntakeDialog catalog={catalog} onClose={() => setWalkInModalOpen(false)} onReceived={async item => {
        setCreatedWalkInItem(item ?? null);
        setWalkInModalOpen(false);
        onNotice("Đã tiếp nhận thực tế, chưa lưu kho.");
        await onRefreshCustody();
      }} />}

      {/* Walk-in Intake Success Modal */}
      {createdWalkInItem && (
        <div className="custody-modal-overlay" onClick={() => setCreatedWalkInItem(null)}>
          <AccessibleDialog className="custody-modal custody-modal--success" aria-label="Đã tiếp nhận trực tiếp" onDismiss={() => setCreatedWalkInItem(null)} onClick={(e) => e.stopPropagation()}>
            <div className="custody-modal__header">
              <span className="modal-badge modal-badge--green"><CheckCircle2 size={24} /></span>
              <div>
                <h3>Tiếp nhận vật phẩm thành công!</h3>
                <p>Hồ sơ lưu kho đã được tự động khởi tạo trên hệ thống.</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setCreatedWalkInItem(null)}><X size={18} /></button>
            </div>

            <div className="walkin-success-card">
              <div className="success-code-banner">
                <span className="code-label">MÃ LƯU KHO TỰ ĐỘNG</span>
                <strong className="code-value">{createdWalkInItem.storageCode || "WH-AUTO"}</strong>
              </div>

              <div className="success-info-grid">
                <div><strong>Tên vật phẩm:</strong> {createdWalkInItem.itemName}</div>
                <div><strong>Tình trạng nhận:</strong> {createdWalkInItem.conditionNotes}</div>
                <div><strong>Điểm bàn giao:</strong> {createdWalkInItem.handoverPoint?.name ?? "Chưa rõ"}</div>
                <div><strong>Hạn lưu giữ:</strong> {formatDate(createdWalkInItem.retentionDeadline)}</div>
                <div><strong>Thời gian nhận:</strong> {formatDateTime(createdWalkInItem.receivedAt)}</div>
              </div>
            </div>

            <div className="custody-modal-actions">
              <button type="button" className="primary-button primary-button--success" onClick={() => setCreatedWalkInItem(null)}>
                <CheckCircle2 size={16} /> Đã hiểu & Đóng
              </button>
            </div>
          </AccessibleDialog>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="custody-modal-overlay" onClick={() => { if (!pendingAction) setRejectModal(null); }}>
          <AccessibleDialog className="custody-modal" aria-label="Từ chối bàn giao" busy={Boolean(pendingAction)} onDismiss={() => setRejectModal(null)} onClick={(e) => e.stopPropagation()}>
            <div className="custody-modal__header">
              <span className="modal-badge modal-badge--red"><XCircle size={18} /></span>
              <div>
                <h3>Từ chối yêu cầu Bàn giao</h3>
                <p>Từ chối yêu cầu từ người dùng <strong>{rejectModal.requester.fullName}</strong></p>
              </div>
              <button type="button" className="close-btn" aria-label="Đóng từ chối" disabled={Boolean(pendingAction)} onClick={() => setRejectModal(null)}><X size={18} /></button>
            </div>

            <form className="admin-form modal-form" onSubmit={submitReject}>
              <label className="input-field">
                <span>Lý do từ chối <strong className="required-star">*</strong></span>
                <textarea value={rejectForm.reason} onChange={(e) => setRejectForm({ ...rejectForm, reason: e.target.value })} rows={3} placeholder="Mô tả lý do từ chối (vật phẩm không phù hợp, sai quy định...)" required />
              </label>

              <div className="custody-modal-actions">
                <button className="primary-button primary-button--danger" disabled={pendingAction === "custody-action"}>
                  {pendingAction === "custody-action" ? <LoaderCircle className="spin-icon" size={17} /> : <XCircle size={17} />}
                  <span>Xác nhận từ chối</span>
                </button>
                <button type="button" className="secondary-button" disabled={Boolean(pendingAction)} onClick={() => setRejectModal(null)}>Đóng</button>
              </div>
            </form>
          </AccessibleDialog>
        </div>
      )}

      {detailModal && (
        <CustodyDetailModal
          request={detailModal}
          catalog={catalog}
          onClose={() => setDetailModal(null)}
          onIntake={(req) => {
            setDetailModal(null);
            setIntakeModal(req);
          }}
          onReject={(req) => {
            setDetailModal(null);
            setRejectForm(emptyRejectForm);
            setRejectModal(req);
          }}
        />
      )}

      {intakeModal && <WarehouseIntakeDialog request={intakeModal} catalog={catalog} onClose={() => setIntakeModal(null)} onReceived={async () => {
        setIntakeModal(null);
        onNotice("Đã tiếp nhận thực tế. Vật phẩm ở trạng thái Đã tiếp nhận, chưa lưu kho.");
        await onRefreshCustody();
      }} />}
    </>
  );
}

/* ─────────────── Warehouse Inventory Tab ─────────────── */

function WarehouseInventoryTab({
  catalog,
  dashboard,
  pendingAction,
  error,
  notice,
  onRefresh,
  setPendingAction,
  onNotice,
  onError
}: {
  catalog: WarehouseCatalog | null;
  dashboard: WarehouseDashboard | null;
  pendingAction: PendingAction;
  error: string;
  notice: string;
  onRefresh: (filters?: typeof emptyFilters, page?: number) => Promise<void>;
  setPendingAction: (a: PendingAction) => void;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [filters, setFilters] = useState(emptyFilters);
  const isWarehouseFirstMount = useRef(true);
  useEffect(() => {
    if (isWarehouseFirstMount.current) {
      isWarehouseFirstMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void onRefresh(filters, 1);
    }, 280);
    return () => clearTimeout(timer);
  }, [filters.q]);

  function updateFilter<K extends keyof typeof emptyFilters>(key: K, value: typeof emptyFilters[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (key !== "q") {
      void onRefresh(next, 1);
    }
  }
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [logs, setLogs] = useState<WarehouseStorageLog[]>([]);
  const [logsError, setLogsError] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const logsSequence = useRef(0);
  const detailsModalRef = useRef<HTMLDivElement>(null);
  const [itemImages, setItemImages] = useState<WarehouseImage[]>([]);
  const [imagesError, setImagesError] = useState("");
  useEffect(() => {
    let active = true;
    setItemImages([]); setImagesError("");
    if (selectedItemId) void api.getWarehouseImages(selectedItemId).then(value => { if (active) setItemImages(value.images ?? []); })
      .catch(reason => { if (active) setImagesError(messageOf(reason, "Không thể tải ảnh vật phẩm")); });
    return () => { active = false; };
  }, [selectedItemId]);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [returnTargetItem, setReturnTargetItem] = useState<WarehouseItem | null>(null);
  const [returnRecipients, setReturnRecipients] = useState<Array<{ claimId: string; recipientId: string; fullName: string; description: string | null; verified: boolean }>>([]);
  const [claimReviewsLoading, setClaimReviewsLoading] = useState(false);
  const [claimReviewsReady, setClaimReviewsReady] = useState(false);
  const [claimReviewsError, setClaimReviewsError] = useState("");
  const [claimReviewReload, setClaimReviewReload] = useState(0);
  const returnSequence = useRef(0);
  const returnItemId = useRef<string | null>(null);
  const [claimReviewReason, setClaimReviewReason] = useState("");
  const [claimReviewConfirmed, setClaimReviewConfirmed] = useState(false);
  const [claimReviewBusy, setClaimReviewBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const sequence = returnSequence.current;
    setReturnRecipients([]);
    setClaimReviewsReady(false);
    setClaimReviewsError("");
    setClaimReviewsLoading(Boolean(returnTargetItem));
    if (returnTargetItem) {
      void api.getWarehouseReturnClaimReviews(returnTargetItem.id).then(value => {
        if (active && sequence === returnSequence.current) { setReturnRecipients(value.claims); setClaimReviewsReady(true); }
      }).catch(reason => {
        if (active && sequence === returnSequence.current) setClaimReviewsError(messageOf(reason, "Không thể tải claim của vật phẩm"));
      }).finally(() => { if (active && sequence === returnSequence.current) setClaimReviewsLoading(false); });
    }
    return () => { active = false; };
  }, [returnTargetItem?.id, claimReviewReload]);
  useEffect(() => () => { returnSequence.current++; returnItemId.current = null; }, []);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  async function compressImage(file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  }
  const [updateForm, setUpdateForm] = useState<{ status: WarehouseStatus; conditionNotes: string; storageCode: string; note: string }>({
    status: "STORED",
    conditionNotes: "",
    storageCode: "",
    note: ""
  });
  const [returnForm, setReturnForm] = useState({
    claimId: "", recipientId: "",
    receiverName: "",
    receiverIdentity: "",
    receiverPhone: "",
    proofImages: [] as string[],
    note: ""
  });
  const [uploadingProof, setUploadingProof] = useState(false);
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});
  const [returnError, setReturnError] = useState("");
  const [returnVerified, setReturnVerified] = useState(false);
  const manuallyEditedReturnFields = useRef(new Set<string>());
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  function changeReturnText(field: ReturnTextField, value: string) {
    manuallyEditedReturnFields.current.add(field);
    setReturnForm(prev => ({ ...prev, [field]: value }));
    setReturnErrors(prev => ({ ...prev, [field]: prev[field] ? returnTextError(field, value) : "" }));
    setReturnVerified(false);
  }

  function applyReturnConversationExtraction(result: WarehouseConversationExtraction) {
    if (result.mode !== "RETURN") return;
    const patch: Partial<typeof returnForm> = {};
    const fields = result.fields;
    for (const field of ["receiverName", "receiverPhone", "receiverIdentity", "note"] as const) {
      const value = fields[field];
      if (value !== null && !manuallyEditedReturnFields.current.has(field)) patch[field] = value;
    }
    const matchedClaim = fields.matchedClaim;
    let claimWasSuggested = false;
    if (matchedClaim && !manuallyEditedReturnFields.current.has("claimId") && !manuallyEditedReturnFields.current.has("recipientId")) {
      patch.claimId = matchedClaim.claimId;
      patch.recipientId = matchedClaim.recipientId;
      if (!manuallyEditedReturnFields.current.has("receiverName") && !fields.receiverName) patch.receiverName = matchedClaim.fullName;
      claimWasSuggested = true;
    }
    if (!Object.keys(patch).length) return;
    setReturnForm(previous => ({ ...previous, ...patch }));
    setReturnErrors(previous => Object.fromEntries(Object.entries(previous).map(([field, message]) => [field, Object.keys(patch).includes(field) || (claimWasSuggested && ["claimId", "recipientId"].includes(field)) ? "" : message])));
    if (claimWasSuggested) { setClaimReviewReason(""); setClaimReviewConfirmed(false); }
    setReturnVerified(false);
  }

  function returnFieldError(field: string) {
    return returnErrors[field] ? <small id={`return-${field}-error`} className="field-error" role="alert">{returnErrors[field]}</small> : null;
  }

  function parseStorageLogNote(noteText: string) {
    const references = /^Proof references: ([0-9a-f -]+)$/im.exec(noteText)?.[1].trim().split(/\s+/) ?? [];
    const cleanNote = noteText.split("\n").filter(line => !/https?:\/\/|data:image|Hình ảnh bằng chứng|Proof references:/i.test(line)).map(line => line.trim()).filter(Boolean).join(" • ");
    return { cleanNote, imageUrls: references.filter(id => /^[0-9a-f-]{36}$/i.test(id)) };
  }
  const selectedItem = useMemo(
    () => dashboard?.items.find((item) => item.id === selectedItemId) ?? null,
    [dashboard, selectedItemId]
  );

  useEffect(() => {
    if (!selectedItem) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [selectedItem?.id]);

  useModalFocus(detailsModalRef, Boolean(selectedItem), closeDetails, Boolean(pendingAction));

  function closeDetails() {
    if (pendingAction) return;
    logsSequence.current++;
    setSelectedItemId(null);
    setLogsLoading(false);
  }

  async function submitFilters(event: FormEvent) {
    event.preventDefault();
    setPendingAction("load");
    onError("");
    try {
      await onRefresh(filters, 1);
    } catch (reason) {
      onError(messageOf(reason, "Không thể lọc danh sách kho"));
    } finally {
      setPendingAction("");
    }
  }

  async function loadLogs(itemId: string, silent = false) {
    const sequence = ++logsSequence.current;
    if (!silent) setLogsLoading(true);
    setLogsError("");
    try {
      const result = await api.getWarehouseLogs(itemId);
      if (sequence === logsSequence.current) setLogs(result);
    } catch (reason) {
      if (sequence === logsSequence.current) setLogsError(messageOf(reason, "Không thể tải nhật ký kho"));
    } finally {
      if (sequence === logsSequence.current) setLogsLoading(false);
    }
  }

  function selectItem(item: WarehouseItem) {
    setLogs([]);
    setLogsError("");
    setSelectedItemId(item.id);
    setUpdateForm({
      status: item.status,
      conditionNotes: item.conditionNotes ?? "",
      storageCode: item.storageCode ?? "",
      note: ""
    });
    void loadLogs(item.id);
  }

  async function submitUpdate(event: FormEvent) {
    event.preventDefault();
    if (!selectedItem) return;
    setPendingAction("update");
    onError("");
    onNotice("");
    try {
      await api.updateWarehouseItem(selectedItem.id, {
        status: updateForm.status,
        conditionNotes: clean(updateForm.conditionNotes),
        storageCode: clean(updateForm.storageCode),
        note: clean(updateForm.note)
      });
      onNotice("Đã cập nhật trạng thái vật phẩm kho thành công");
      setUpdateModalOpen(false);
      await onRefresh();
      await loadLogs(selectedItem.id, true).catch(() => undefined);
    } catch (reason) {
      onError(messageOf(reason, "Không thể cập nhật trạng thái kho"));
    } finally {
      setPendingAction("");
    }
  }

  function openReturnModal(item: WarehouseItem) {
    returnSequence.current++;
    returnItemId.current = item.id;
    setClaimReviewsLoading(true);
    setClaimReviewsReady(false);
    setReturnErrors({});
    setReturnError("");
    setReturnVerified(false);
    setClaimReviewReason("");
    setClaimReviewConfirmed(false);
    setReturnTargetItem(item);
    manuallyEditedReturnFields.current.clear();
    setReturnForm({ claimId: "", recipientId: "", receiverName: "", receiverIdentity: "", receiverPhone: "", proofImages: [], note: "" });
  }

  function changeReturnClaim(claimId: string) {
    manuallyEditedReturnFields.current.add("claimId");
    manuallyEditedReturnFields.current.add("recipientId");
    const recipient = returnRecipients.find(value => value.claimId === claimId);
    setClaimReviewReason("");
    setClaimReviewConfirmed(false);
    setReturnErrors(previous => ({ ...previous, claimId: previous.claimId === "Cần xác minh claim tại quầy trước khi trả đồ." ? (recipient && !recipient.verified ? previous.claimId : "") : previous.claimId, claimReviewReason: "", claimReviewConfirmed: "" }));
    setReturnForm(prev => ({ ...prev, claimId: recipient?.claimId ?? "", recipientId: recipient?.recipientId ?? "", receiverName: recipient?.fullName ?? prev.receiverName }));
    if (recipient) manuallyEditedReturnFields.current.add("receiverName");
    setReturnVerified(false);
  }

  function closeReturnModal() {
    returnSequence.current++;
    returnItemId.current = null;
    setReturnTargetItem(null);
  }

  async function verifyReturnClaim() {
    if (!returnTargetItem || claimReviewBusy || !claimReviewsReady || claimReviewsLoading) return;
    const reason = claimReviewReason.trim();
    const errors: Record<string, string> = {};
    if (reason.length < 10 || reason.length > 1000) errors.claimReviewReason = "Nội dung đối chiếu phải có từ 10 đến 1000 ký tự.";
    if (!claimReviewConfirmed) errors.claimReviewConfirmed = "Cần xác nhận đã đối chiếu quyền sở hữu tại quầy.";
    setReturnErrors(previous => ({ ...previous, claimReviewReason: "", claimReviewConfirmed: "", ...errors }));
    if (Object.keys(errors).length) return;
    const itemId = returnTargetItem.id;
    const sequence = returnSequence.current;
    setClaimReviewBusy(true);
    setReturnError("");
    try {
      const result = await api.verifyWarehouseClaim(itemId, { claimId: returnForm.claimId, recipientId: returnForm.recipientId, verified: true, reason });
      if (sequence !== returnSequence.current || returnItemId.current !== itemId) return;
      setReturnRecipients(result.claims);
      setReturnErrors(previous => ({ ...previous, claimId: previous.claimId === "Cần xác minh claim tại quầy trước khi trả đồ." ? "" : previous.claimId }));
    } catch (reason) {
      if (sequence === returnSequence.current && returnItemId.current === itemId) setReturnError(messageOf(reason, "Không thể xác minh claim tại quầy"));
    } finally {
      if (sequence === returnSequence.current && returnItemId.current === itemId) setClaimReviewBusy(false);
    }
  }

  async function submitReturn(event: FormEvent) {
    event.preventDefault();
    if (!returnTargetItem || !claimReviewsReady || claimReviewsLoading || claimReviewBusy || pendingAction || uploadingProof) return;
    const sequence = returnSequence.current;
    const itemId = returnTargetItem.id;
    const errors: Record<string, string> = {};
    for (const field of Object.keys(returnTextRules) as ReturnTextField[]) {
      const message = returnTextError(field, returnForm[field]);
      if (message) errors[field] = message;
    }
    if (returnForm.proofImages.length < 1 || returnForm.proofImages.length > 5) errors.proofImage = "Vui lòng tải lên từ 1 đến 5 ảnh bằng chứng.";
    if (!returnVerified) errors.verified = "Vui lòng xác nhận đã đối chiếu người nhận và bằng chứng bàn giao.";
    if (returnForm.claimId && !returnRecipients.some(recipient => recipient.claimId === returnForm.claimId && recipient.verified)) errors.claimId = "Cần xác minh claim tại quầy trước khi trả đồ.";
    setReturnErrors(errors);
    setReturnError("");
    if (Object.keys(errors).length) return;
    setPendingAction("update");
    onError("");
    onNotice("");
    try {
      await api.returnWarehouseItem(returnTargetItem.id, {
        claimId: returnForm.claimId || null, recipientId: returnForm.recipientId || null,
        receiverName: clean(returnForm.receiverName) ?? "",
        receiverIdentity: clean(returnForm.receiverIdentity) ?? "",
        receiverPhone: clean(returnForm.receiverPhone) ?? "",
        proofImage: returnForm.proofImages.join("\n") || "",
        note: clean(returnForm.note)
      });
      if (sequence !== returnSequence.current || returnItemId.current !== itemId) return;
      onNotice("Đã hoàn tất trả hàng cho chủ sở hữu!");
      setPendingAction("");
      closeReturnModal();
      const detailsSequence = logsSequence.current;
      await onRefresh();
      if (returnSequence.current === sequence + 1 && logsSequence.current === detailsSequence && selectedItemId === itemId) {
        await loadLogs(returnTargetItem.id, true).catch(() => undefined);
      }
    } catch (reason) {
      if (returnItemId.current !== itemId || sequence !== returnSequence.current) return;
      if (reason instanceof ApiError) {
        setReturnErrors(Object.fromEntries(Object.entries(reason.fieldErrors).map(([field, messages]) => [field, messages.join(" ")])));
      }
      setReturnError(messageOf(reason, "Không thể xử lý trả hàng"));
    } finally {
      if (sequence === returnSequence.current) setPendingAction("");
    }
  }

  return (
    <>
      {notice && (
        <div className="staff-alert staff-alert--success">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button type="button" onClick={() => onNotice("")} aria-label="Đóng"><X size={14} /></button>
        </div>
      )}
      {error && (
        <div className="staff-alert staff-alert--error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => onError("")} aria-label="Đóng"><X size={14} /></button>
        </div>
      )}

      {/* Stats summary */}
      <div className="admin-stats warehouse-stats" aria-label="Thống kê kho">
        <StatCard icon={<Archive size={20} />} value={dashboard?.stats.activeItems ?? 0} label="Đang lưu giữ tại kho" tone="blue" />
        <StatCard icon={<CheckCircle2 size={20} />} value={dashboard?.stats.returnedItems ?? 0} label="Đã hoàn trả chủ" tone="green" />
        <StatCard icon={<Clock3 size={20} />} value={dashboard?.stats.overdueItems ?? 0} label="Quá hạn retention" tone="red" />
        <StatCard icon={<PackageCheck size={20} />} value={dashboard?.stats.totalItems ?? 0} label="Tổng hồ sơ kho" tone="orange" />
      </div>

      <div className="warehouse-layout warehouse-layout--inventory">
        <section className="warehouse-main">
          {/* Search and Filter bar */}
          <form className="warehouse-filter-bar" onSubmit={submitFilters}>
            <label className="input-field search-field">
              <span>Tìm kiếm vật phẩm</span>
              <div className="input-with-icon" style={{ position: "relative" }}>
                <Search size={16} />
                <input
                  aria-label="Tìm vật phẩm trong kho"
                  value={filters.q}
                  onChange={(event) => updateFilter("q", event.target.value)}
                  placeholder="Tên vật phẩm, mô tả, mã kho..."
                  style={{ paddingRight: filters.q ? "32px" : undefined }}
                />
                {filters.q && (
                  <button
                    type="button"
                    aria-label="Xóa từ khóa tìm kiếm"
                    onClick={() => updateFilter("q", "")}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </label>

            <label className="input-field">
              <span>Trạng thái</span>
              <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="">Tất cả trạng thái</option>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </label>

            <label className="input-field">
              <span>Điểm bàn giao</span>
              <select value={filters.handoverPointId} onChange={(event) => updateFilter("handoverPointId", event.target.value)}>
                <option value="">Tất cả điểm</option>
                {catalog?.handoverPoints.map((point) => (
                  <option key={point.id} value={point.id}>{point.name}</option>
                ))}
              </select>
            </label>

            <button type="submit" className="secondary-button search-btn">
              <Filter size={16} /> Lọc
            </button>
          </form>

          {/* Item List Grid */}
          <div className="warehouse-item-list">
            {dashboard?.items.map((item) => (
              <article
                className="warehouse-item-card warehouse-item-card--interactive"
                key={item.id}
                onClick={() => selectItem(item)}
              >
                <div
                  className="warehouse-card-thumbnail"
                  onClick={(e) => { e.stopPropagation(); selectItem(item); }}
                  title="Xem chi tiết vật phẩm"
                >
                  <WarehouseImageView image={item.thumbnail} expandable={false} />
                </div>
                <div className="warehouse-card-body">
                  <span className={`warehouse-status warehouse-status--${item.status.toLowerCase()}`}>
                    {statusLabel(item.status)}
                  </span>
                  <h2
                    title={item.itemName}
                    onClick={(e) => { e.stopPropagation(); selectItem(item); }}
                  >
                    {item.itemName}
                  </h2>
                  <dl className="warehouse-card-meta">
                    <ItemMeta label="Danh mục" value={item.category?.name ?? "Chưa ghi nhận"} />
                    <ItemMeta label="Tiếp nhận" value={<time dateTime={item.receivedAt}>{formatDateTime(item.receivedAt)}</time>} />
                  </dl>
                </div>
                <div className="warehouse-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="secondary-button warehouse-select-button" onClick={() => selectItem(item)}>
                    <History size={16} /> Xem chi tiết
                  </button>
                  {["RECEIVED", "STORED", "CLAIMED", "EXPIRED"].includes(item.status) && (
                    <button type="button" className="primary-button warehouse-select-button" onClick={() => openReturnModal(item)}>
                      <UserCheck size={16} /> Trả cho chủ sở hữu
                    </button>
                  )}
                </div>
              </article>
            ))}

            {!dashboard?.items.length && (
              <div className="warehouse-empty">
                <Archive size={48} className="empty-icon" />
                <h3>Không tìm thấy vật phẩm</h3>
                <p>Không có vật phẩm kho nào khớp với tiêu chí tìm kiếm.</p>
              </div>
            )}
          </div>

          {dashboard && (
            <Pagination
              page={dashboard.page}
              pageSize={dashboard.pageSize}
              total={dashboard.total}
              busy={Boolean(pendingAction)}
              onPage={page => void onRefresh(filters, page)}
            />
          )}
        </section>
      </div>

      {selectedItem && (
        <div className="custody-modal-overlay warehouse-detail-overlay" onClick={closeDetails}>
          <div ref={detailsModalRef} tabIndex={-1} className="warehouse-detail-modal" role="dialog" aria-modal="true" aria-labelledby="warehouse-detail-title" onClick={event => event.stopPropagation()}>
            <header className="warehouse-detail-modal__header">
              <span className="panel-icon-badge"><History size={18} /></span>
              <div>
                <h2 id="warehouse-detail-title">Chi tiết vật phẩm kho</h2>
              </div>
              <button type="button" className="close-btn" aria-label="Đóng chi tiết" title="Đóng chi tiết" onClick={closeDetails}><X size={20} /></button>
            </header>

            <div className="warehouse-detail-modal__body">
              <div className="warehouse-selected-summary">
                <div className="summary-header">
                  <span className={`warehouse-status warehouse-status--${selectedItem.status.toLowerCase()}`}>
                    {statusLabel(selectedItem.status)}
                  </span>
                  <code className="code-badge">{selectedItem.storageCode || "Chưa có vị trí lưu kho"}</code>
                </div>

                <h3>{selectedItem.itemName}</h3>
                <WarehouseDisposition key={selectedItem.id} itemId={selectedItem.id} onChanged={() => onRefresh()} />
                {itemImages.length ? <WarehouseImageGallery images={itemImages} /> : <WarehouseImageView image={selectedItem.thumbnail} />}
                {imagesError && <p className="field-error" role="alert">{imagesError}</p>}
                <h4>Mô tả vật phẩm</h4>
                <p className="summary-desc">{selectedItem.description || "Không có mô tả thêm."}</p>

                <dl className="warehouse-detail-meta">
                  <ItemMeta label="Danh mục" value={selectedItem.category?.name ?? "Chưa ghi nhận"} />
                  <ItemMeta label="Hạn lưu giữ" value={<span className={isOverdue(selectedItem) ? "warehouse-deadline is-overdue" : "warehouse-deadline"}>{formatDate(selectedItem.retentionDeadline)}</span>} />
                  <ItemMeta label="Tiếp nhận lúc" value={formatDateTime(selectedItem.receivedAt)} />
                  <ItemMeta label="Điểm bàn giao" value={selectedItem.handoverPoint?.name ?? "Chưa ghi nhận"} />
                  <ItemMeta label="Địa chỉ điểm nhận" value={selectedItem.handoverPoint?.address ?? "Chưa ghi nhận"} />
                  <ItemMeta label="Vị trí nhặt" value={[selectedItem.location.area?.name, selectedItem.location.building?.name, selectedItem.location.roomText].filter(Boolean).join(" · ") || "Chưa ghi nhận"} />
                  <ItemMeta label="Người nhặt / bàn giao" value={selectedItem.finder.userName ?? selectedItem.finder.name ?? "Chưa ghi nhận"} />
                  <ItemMeta label="Liên hệ người nhặt" value={selectedItem.finder.contact ?? "Chưa ghi nhận"} />
                  <ItemMeta label="Tình trạng nhận" value={selectedItem.conditionNotes ?? "Chưa ghi nhận"} />
                  <ItemMeta label="Số lượng thực nhận" value={selectedItem.receivedQuantity ?? "Hồ sơ cũ chưa ghi nhận"} />
                  <ItemMeta label="Phụ kiện thực nhận" value={selectedItem.accessories ?? "Hồ sơ cũ chưa ghi nhận"} />
                  <ItemMeta label="Đã trả lúc" value={formatDateTime(selectedItem.returnedAt)} />
                  <ItemMeta label="Nhân viên tiếp nhận" value={selectedItem.createdBy.fullName ?? "Chưa ghi nhận"} />
                  <ItemMeta label="Tạo hồ sơ lúc" value={formatDateTime(selectedItem.createdAt)} />
                  <ItemMeta label="Cập nhật lúc" value={formatDateTime(selectedItem.updatedAt)} />
                </dl>

                <div className="summary-action-bar">
                  <button
                    type="button"
                    className="primary-button update-trigger-btn"
                    onClick={() => setUpdateModalOpen(true)}
                  >
                    <Save size={16} /> Cập nhật trạng thái
                  </button>

                </div>
              </div>

              {/* Log Timeline List */}
              <div className="warehouse-log-list">
                <div className="admin-list-heading">
                  <div>
                    <p className="eyebrow">LỊCH SỬ BIẾN ĐỘNG</p>
                    <h2>Nhật ký kho ({logs.length})</h2>
                  </div>
                </div>

                {logsLoading && (
                  <div className="loading-inline"><LoaderCircle className="spin-icon" size={16} /> Đang tải nhật ký...</div>
                )}
                {logsError && <div className="warehouse-log-error" role="alert">
                  <p className="field-error">{logsError}</p>
                  <button type="button" className="secondary-button" onClick={() => void loadLogs(selectedItem.id)}><RefreshCw size={16} /> Thử lại</button>
                </div>}

                <div className="timeline-log">
                  {logs.map((log) => {
                    const { cleanNote, imageUrls } = parseStorageLogNote(log.note || "");
                    return (
                      <article key={log.id} className="timeline-log__item">
                        <div className="timeline-log__marker" />
                        <div className="timeline-log__content">
                          <strong>{statusLabel(log.fromStatus)} <ArrowRight size={12} /> {statusLabel(log.toStatus)}</strong>
                          <span className="timeline-log__meta">{log.actor.fullName ?? "Nhân viên"} • {formatDateTime(log.createdAt)}</span>
                          {(log.storageCode || log.conditionNotes || cleanNote) && (
                            <p className="timeline-log__notes">
                              {[log.storageCode && `Mã kho: ${log.storageCode}`, log.conditionNotes && `Tình trạng: ${log.conditionNotes}`, cleanNote && `Ghi chú: ${cleanNote}`].filter(Boolean).join(" | ")}
                            </p>
                          )}
                          {imageUrls.length > 0 && (
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                              {imageUrls.map((url, i) => (
                                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                  <ProofImage
                                    proofId={url}
                                    alt={`Ảnh bằng chứng ${i + 1}`}
                                    onPreview={setPreviewImageUrl}
                                    style={{
                                      width: "56px",
                                      height: "56px",
                                      objectFit: "cover",
                                      borderRadius: "6px",
                                      border: "1px solid #cbd5e1",
                                      cursor: "pointer",
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                      transition: "transform 0.15s ease"
                                    }}
                                    title="Click để phóng to ảnh bằng chứng"
                                  />
                                  <span style={{ fontSize: "0.68rem", color: "#64748b" }}>Ảnh {i + 1}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  {!logs.length && !logsError && !logsLoading && (
                    <p className="admin-hint">Chưa có nhật ký ghi nhận cho vật phẩm này.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Warehouse Item Status Modal */}
      {updateModalOpen && selectedItem && (
        <div className="custody-modal-overlay" onClick={() => { if (!pendingAction) setUpdateModalOpen(false); }}>
          <AccessibleDialog className="custody-modal" aria-label="Cập nhật trạng thái kho" busy={Boolean(pendingAction)} onDismiss={() => setUpdateModalOpen(false)} onClick={(e) => e.stopPropagation()}>
            <div className="custody-modal__header">
              <span className="modal-badge modal-badge--blue"><Save size={18} /></span>
              <div>
                <h3>Cập nhật trạng thái kho</h3>
                <p>Vật phẩm: <strong>{selectedItem.itemName}</strong></p>
              </div>
              <button type="button" className="close-btn" aria-label="Đóng cập nhật" disabled={Boolean(pendingAction)} onClick={() => setUpdateModalOpen(false)}><X size={18} /></button>
            </div>

            <form className="admin-form modal-form" onSubmit={submitUpdate}>
              <label className="input-field">
                <span>Trạng thái chuyển tiếp <strong className="required-star">*</strong></span>
                <select value={updateForm.status} onChange={(event) => setUpdateForm({ ...updateForm, status: event.target.value as WarehouseStatus })}>
                  {statusOptions.filter(status => status.value === selectedItem?.status || ["RECEIVED","STORED","EXPIRED"].includes(status.value)).map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </label>

              <label className="input-field">
                <span>Mã vị trí lưu kho</span>
                <input value={updateForm.storageCode} onChange={(event) => setUpdateForm({ ...updateForm, storageCode: event.target.value })} placeholder="Ví dụ: Tủ A1 - Hộc 02" />
              </label>

              <label className="input-field">
                <span>Tình trạng vật phẩm thực tế</span>
                <textarea value={updateForm.conditionNotes} onChange={(event) => setUpdateForm({ ...updateForm, conditionNotes: event.target.value })} rows={2} placeholder="Ghi chú thêm về tình trạng..." />
              </label>

              <label className="input-field">
                <span>Ghi chú thay đổi (Nhật ký)</span>
                <textarea value={updateForm.note} onChange={(event) => setUpdateForm({ ...updateForm, note: event.target.value })} rows={2} placeholder="Lý do cập nhật trạng thái..." />
              </label>

              <div className="custody-modal-actions">
                <button className="primary-button" disabled={pendingAction === "update"}>
                  {pendingAction === "update" ? <LoaderCircle className="spin-icon" size={17} /> : <CheckCircle2 size={17} />}
                  <span>Lưu trạng thái mới</span>
                </button>
                <button type="button" className="secondary-button" disabled={Boolean(pendingAction)} onClick={() => setUpdateModalOpen(false)}>Đóng</button>
              </div>
            </form>
          </AccessibleDialog>
        </div>
      )}

      {returnTargetItem && (
        <div className="custody-modal-overlay" onClick={() => { if (!claimReviewBusy && !pendingAction && !uploadingProof) closeReturnModal(); }}>
          <AccessibleDialog
            aria-label="Xác nhận trả hàng cho chủ sở hữu"
            onDismiss={closeReturnModal}
            busy={claimReviewBusy || Boolean(pendingAction) || uploadingProof}
            className="custody-modal custody-modal--warehouse-return"
            style={{ maxWidth: "min(1180px, 95vw)", width: "min(1180px, 95vw)", maxHeight: "calc(100dvh - 36px)", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="custody-modal__header" style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0", background: "#fff", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
              <span className="modal-badge modal-badge--green"><UserCheck size={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>Xác nhận trả hàng cho chủ sở hữu</h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                  Vật phẩm: <strong style={{ color: "#0f172a" }}>{returnTargetItem.itemName}</strong> · Mã lưu kho: <code style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px", fontSize: "0.82rem" }}>{returnTargetItem.storageCode || "Chưa có"}</code>
                </p>
              </div>
              <button type="button" className="close-btn" aria-label="Đóng trả hàng" disabled={claimReviewBusy || Boolean(pendingAction) || uploadingProof} onClick={closeReturnModal}><X size={18} /></button>
            </div>

            <form noValidate className="intake-dialog__body" style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }} onSubmit={submitReturn}>
              <div className="warehouse-return-workspace">
                {/* CỘT TRÁI: DỮ LIỆU ĐỐI CHIẾU, CHAT AI TRẢ HÀNG & BẰNG CHỨNG HÌNH ẢNH */}
                <div className="warehouse-return-left">
                  {/* Thẻ tóm tắt thông tin vật phẩm kho */}
                  <div className="intake-card intake-card--source" style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "14px 16px" }}>
                    <h4 className="intake-card__title" style={{ margin: "0 0 10px 0", fontSize: "0.92rem", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="intake-card__icon" style={{ color: "#16a34a", display: "inline-flex" }}><Package size={16} /></span>
                      Hồ sơ vật phẩm bàn giao
                    </h4>
                    <dl className="intake-source-dl" style={{ display: "grid", gridTemplateColumns: "110px minmax(0, 1fr)", gap: "8px 12px", margin: 0, fontSize: "0.84rem" }}>
                      <dt style={{ color: "#64748b", fontWeight: 500 }}>Tên vật phẩm</dt>
                      <dd style={{ margin: 0, color: "#0f172a", fontWeight: 600 }}>{returnTargetItem.itemName}</dd>

                      <dt style={{ color: "#64748b", fontWeight: 500 }}>Vị trí kho</dt>
                      <dd style={{ margin: 0, color: "#0f172a" }}>{returnTargetItem.storageCode || "Chưa ghi nhận mã vị trí"}</dd>

                      <dt style={{ color: "#64748b", fontWeight: 500 }}>Tình trạng nhận</dt>
                      <dd style={{ margin: 0, color: "#334155" }}>{returnTargetItem.conditionNotes || "Không có ghi chú lúc nhận"}</dd>

                      <dt style={{ color: "#64748b", fontWeight: 500 }}>Điểm bàn giao</dt>
                      <dd style={{ margin: 0, color: "#334155" }}>{returnTargetItem.handoverPoint?.name || "Tại quầy"}</dd>
                    </dl>
                  </div>

                  <div className="staff-alert staff-alert--info" style={{ padding: "10px 14px", fontSize: "0.8rem", margin: 0, display: "flex", alignItems: "flex-start", gap: "10px", borderRadius: "8px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" }}>
                    <Info size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <span style={{ lineHeight: 1.45 }}>
                      Vui lòng đối chiếu kỹ Thẻ sinh viên / CMND / CCCD trước khi trả hàng. Hồ sơ bàn giao và ảnh bằng chứng sẽ được lưu trữ bảo mật trong lịch sử giao dịch.
                    </span>
                  </div>

                  {claimReviewsLoading && <p role="status" style={{ fontSize: "0.85rem", color: "#64748b" }}>Đang kiểm tra claim của vật phẩm...</p>}
                  {claimReviewsError && (
                    <div style={{ padding: "10px", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
                      <p className="form-error" role="alert" style={{ margin: "0 0 8px 0" }}>{claimReviewsError}</p>
                      <button type="button" className="secondary-button" disabled={claimReviewsLoading} onClick={() => { setClaimReviewsLoading(true); setClaimReviewsReady(false); setClaimReviewsError(""); setClaimReviewReload(previous => previous + 1); }}>
                        <RefreshCw size={15} /> Thử lại kiểm tra claim
                      </button>
                    </div>
                  )}

                  {/* Chatbox AI hỗ trợ tiếp nhận & trả hàng */}
                  <WarehouseConversationChat
                    mode="RETURN"
                    warehouseItemId={returnTargetItem.id}
                    onExtraction={applyReturnConversationExtraction}
                    disabled={claimReviewsLoading}
                    allowImages={true}
                  />

                  {/* Khu vực Upload Ảnh bằng chứng bàn giao */}
                  <section className="intake-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px" }}>
                    <div className="intake-card__header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <h4 className="intake-card__title" style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="intake-card__icon" style={{ color: "#2563eb", display: "inline-flex" }}><ImagePlus size={16} /></span>
                        Ảnh bằng chứng bàn giao <strong className="required-star">*</strong> ({returnForm.proofImages.length}/5)
                      </h4>
                      <span className="intake-card__hint" style={{ fontSize: "0.78rem", color: "#64748b" }}>Tối đa 5 ảnh (JPEG/PNG/WEBP)</span>
                    </div>

                    <label
                      style={{
                        border: "2px dashed #cbd5e1",
                        borderRadius: "8px",
                        padding: "16px 12px",
                        background: "#f8fafc",
                        textAlign: "center",
                        cursor: uploadingProof ? "not-allowed" : "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s"
                      }}
                    >
                      <span style={{ color: "#2563eb", display: "flex", alignItems: "center" }}>
                        {uploadingProof ? <LoaderCircle className="spin-icon" size={24} /> : <ImagePlus size={24} />}
                      </span>
                      <strong style={{ fontSize: "0.84rem", color: "#1e293b" }}>
                        {uploadingProof ? "Đang lưu ảnh bằng chứng..." : returnForm.proofImages.length ? "Thêm ảnh bằng chứng khác" : "Chọn ảnh bằng chứng bàn giao"}
                      </strong>
                      <small style={{ fontSize: "0.74rem", color: "#64748b" }}>
                        {returnForm.proofImages.length ? `${returnForm.proofImages.length} ảnh đã lưu riêng tư` : "Chụp người nhận cùng vật phẩm hoặc biên bản bàn giao"}
                      </small>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        disabled={uploadingProof}
                        aria-label="Ảnh bằng chứng bàn giao"
                        aria-invalid={Boolean(returnErrors.proofImage)}
                        aria-describedby={returnErrors.proofImage ? "return-proofImage-error" : undefined}
                        style={{ display: "none" }}
                        onChange={async (event) => {
                          const input = event.currentTarget;
                          const files = Array.from(input.files || []);
                          if (!files.length) return;
                          if (returnForm.proofImages.length + files.length > 5) {
                            setReturnErrors(prev => ({ ...prev, proofImage: "Chỉ được tải lên tối đa 5 ảnh bằng chứng." }));
                            input.value = "";
                            return;
                          }
                          setReturnErrors(prev => ({ ...prev, proofImage: "" }));
                          setUploadingProof(true);
                          const sequence = returnSequence.current;
                          const itemId = returnTargetItem.id;
                          try {
                            for (const file of files) {
                              const res = await api.uploadWarehouseProof(file, itemId);
                              if (sequence !== returnSequence.current || returnItemId.current !== itemId) return;
                              setReturnForm((prev) => ({ ...prev, proofImages: prev.proofImages.includes(res.id) ? prev.proofImages : [...prev.proofImages, res.id] }));
                              setReturnVerified(false);
                            }
                          } catch (error) {
                            if (sequence === returnSequence.current && returnItemId.current === itemId) setReturnErrors(prev => ({ ...prev, proofImage: messageOf(error, "Không thể tải lên ảnh bằng chứng") }));
                          } finally {
                            if (sequence === returnSequence.current && returnItemId.current === itemId) setUploadingProof(false);
                            input.value = "";
                          }
                        }}
                      />
                    </label>

                    {returnFieldError("proofImage")}

                    {returnForm.proofImages.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "10px", marginTop: "12px" }}>
                        {returnForm.proofImages.map((img, index) => (
                          <div
                            key={index}
                            style={{
                              position: "relative",
                              aspectRatio: "1",
                              borderRadius: "8px",
                              overflow: "hidden",
                              border: "1.5px solid #cbd5e1",
                              background: "#f1f5f9",
                              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.06)"
                            }}
                          >
                            <ProofImage
                              proofId={img}
                              alt={`Bằng chứng ${index + 1}`}
                              onPreview={setPreviewImageUrl}
                              style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
                              title="Click để phóng to ảnh bằng chứng"
                            />
                            <span
                              style={{
                                position: "absolute",
                                bottom: "0",
                                left: "0",
                                right: "0",
                                background: "rgba(15, 23, 42, 0.65)",
                                color: "#fff",
                                fontSize: "0.66rem",
                                textAlign: "center",
                                padding: "2px 0",
                                pointerEvents: "none"
                              }}
                            >
                              Ảnh {index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReturnForm((prev) => ({ ...prev, proofImages: prev.proofImages.filter((_, i) => i !== index) }));
                                setReturnVerified(false);
                                setReturnErrors(prev => ({ ...prev, proofImage: returnForm.proofImages.length <= 1 ? "Vui lòng tải lên từ 1 đến 5 ảnh bằng chứng." : "" }));
                              }}
                              style={{
                                position: "absolute",
                                top: "4px",
                                right: "4px",
                                width: "22px",
                                height: "22px",
                                borderRadius: "50%",
                                border: "none",
                                background: "rgba(220, 38, 38, 0.92)",
                                color: "#fff",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
                              }}
                              title="Xóa ảnh này"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* CỘT PHẢI: FORM THÔNG TIN NGƯỜI NHẬN, XÁC MINH CLAIM & HOÀN TẤT */}
                <div className="warehouse-return-right">
                  <section className="intake-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                    <h4 className="intake-card__title" style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="intake-card__icon" style={{ color: "#2563eb", display: "inline-flex" }}><UserCheck size={16} /></span>
                      Thông tin người nhận thực tế
                    </h4>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <label className="input-field" style={{ margin: 0 }}>
                        <span>Họ và tên người nhận <strong className="required-star">*</strong></span>
                        <input required minLength={2} maxLength={150} value={returnForm.receiverName} aria-invalid={Boolean(returnErrors.receiverName)} aria-describedby={returnErrors.receiverName ? "return-receiverName-error" : undefined} onChange={(event) => changeReturnText("receiverName", event.target.value)} onBlur={() => setReturnErrors(prev => ({ ...prev, receiverName: returnTextError("receiverName", returnForm.receiverName) }))} placeholder="Nhập họ và tên người nhận" />
                        {returnFieldError("receiverName")}
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <label className="input-field" style={{ margin: 0 }}>
                          <span>Số điện thoại <strong className="required-star">*</strong></span>
                          <input required type="tel" minLength={9} maxLength={20} value={returnForm.receiverPhone} aria-invalid={Boolean(returnErrors.receiverPhone)} aria-describedby={returnErrors.receiverPhone ? "return-receiverPhone-error" : undefined} onChange={(event) => changeReturnText("receiverPhone", event.target.value)} onBlur={() => setReturnErrors(prev => ({ ...prev, receiverPhone: returnTextError("receiverPhone", returnForm.receiverPhone) }))} placeholder="Nhập số điện thoại" />
                          {returnFieldError("receiverPhone")}
                        </label>
                        <label className="input-field" style={{ margin: 0 }}>
                          <span>Mã thẻ SV / CCCD <strong className="required-star">*</strong></span>
                          <input required minLength={3} maxLength={100} value={returnForm.receiverIdentity} aria-invalid={Boolean(returnErrors.receiverIdentity)} aria-describedby={returnErrors.receiverIdentity ? "return-receiverIdentity-error" : undefined} onChange={(event) => changeReturnText("receiverIdentity", event.target.value)} onBlur={() => setReturnErrors(prev => ({ ...prev, receiverIdentity: returnTextError("receiverIdentity", returnForm.receiverIdentity) }))} placeholder="Nhập mã số giấy tờ" />
                          {returnFieldError("receiverIdentity")}
                        </label>
                      </div>
                    </div>
                  </section>

                  {/* Liên kết claim nếu có */}
                  {returnRecipients.length > 0 && (
                    <section className="intake-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      <label className="input-field" style={{ margin: 0 }}>
                        <span style={{ fontWeight: 600 }}>Liên kết claim trực tuyến (không bắt buộc)</span>
                        <select value={returnForm.claimId} disabled={claimReviewBusy} onChange={(event) => changeReturnClaim(event.target.value)}>
                          <option value="">Trả trực tiếp, không có claim</option>
                          {returnRecipients.map(recipient => <option key={recipient.claimId} value={recipient.claimId}>{recipient.fullName} · {recipient.verified ? "Đã xác minh" : "Chưa xác minh"} · #{recipient.claimId.slice(0, 8)}</option>)}
                        </select>
                        {returnFieldError("claimId")}
                        {returnFieldError("recipientId")}
                      </label>

                      {returnRecipients.some(recipient => recipient.claimId === returnForm.claimId && !recipient.verified) && (
                        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }} aria-label="Xác minh claim tại quầy">
                          <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "#92400e" }}>Xác minh quyền sở hữu tại quầy</h4>
                          <p style={{ margin: 0, fontSize: "0.82rem", color: "#78350f" }}>{returnRecipients.find(recipient => recipient.claimId === returnForm.claimId)?.description}</p>
                          <label className="input-field" style={{ margin: 0 }}>
                            <span style={{ fontSize: "0.8rem" }}>Nội dung đối chiếu</span>
                            <textarea maxLength={1000} rows={2} value={claimReviewReason} onChange={event => setClaimReviewReason(event.target.value)} aria-invalid={Boolean(returnErrors.claimReviewReason)} placeholder="Đặc điểm riêng, phụ kiện hoặc thông tin đã đối chiếu; không ghi số giấy tờ tại đây" />
                            {returnFieldError("claimReviewReason")}
                          </label>
                          <label className="warehouse-return-verification" style={{ fontSize: "0.82rem" }}>
                            <input type="checkbox" checked={claimReviewConfirmed} onChange={event => setClaimReviewConfirmed(event.target.checked)} />
                            Tôi đã đối chiếu quyền sở hữu tại quầy
                          </label>
                          {returnFieldError("claimReviewConfirmed")}
                          <button type="button" className="secondary-button" disabled={claimReviewBusy || claimReviewsLoading} onClick={() => void verifyReturnClaim()}>
                            <UserCheck size={16} />{claimReviewBusy ? "Đang xác minh..." : "Xác minh claim tại quầy"}
                          </button>
                        </div>
                      )}
                    </section>
                  )}

                  <section className="intake-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <label className="input-field" style={{ margin: 0 }}>
                      <span style={{ fontWeight: 600 }}>Ghi chú bàn giao</span>
                      <textarea maxLength={1000} value={returnForm.note} aria-invalid={Boolean(returnErrors.note)} aria-describedby={returnErrors.note ? "return-note-error" : undefined} onChange={(event) => changeReturnText("note", event.target.value)} rows={3} style={{ resize: "none" }} placeholder="Ghi chú thêm về hiện trạng lúc giao cho người nhận..." />
                      {returnFieldError("note")}
                    </label>

                    <label className="warehouse-return-verification" style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.84rem", cursor: "pointer" }}>
                      <input type="checkbox" required checked={returnVerified} aria-invalid={Boolean(returnErrors.verified)} aria-describedby={returnErrors.verified ? "return-verified-error" : undefined} onChange={event => { setReturnVerified(event.target.checked); setReturnErrors(prev => ({ ...prev, verified: "" })); }} />
                      <span style={{ color: "#0f172a", fontWeight: 500 }}>Tôi đã đối chiếu người nhận và ảnh bằng chứng bàn giao thực tế</span>
                    </label>
                    {returnFieldError("verified")}
                  </section>

                  {returnError && <p className="form-error" role="alert" style={{ margin: 0 }}>{returnError}</p>}

                  <div className="custody-modal-actions" style={{ marginTop: "auto", paddingTop: "14px", borderTop: "1px solid #e2e8f0", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button type="button" className="secondary-button" disabled={claimReviewBusy || Boolean(pendingAction) || uploadingProof} onClick={closeReturnModal}>
                      Hủy bỏ
                    </button>
                    <button className="primary-button" style={{ background: "#16a34a", borderColor: "#16a34a" }} disabled={Boolean(pendingAction) || uploadingProof || claimReviewBusy || claimReviewsLoading || !claimReviewsReady}>
                      {pendingAction === "update" ? <LoaderCircle className="spin-icon" size={17} /> : <CheckCircle2 size={17} />}
                      <span>Xác nhận Đã trả hàng</span>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </AccessibleDialog>
        </div>
      )}

      {previewImageUrl && (
        <div className="custody-modal-overlay" onClick={() => setPreviewImageUrl(null)} style={{ zIndex: 9999, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)" }}>
          <AccessibleDialog aria-label="Ảnh bằng chứng bàn giao" onDismiss={() => setPreviewImageUrl(null)} onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src={previewImageUrl} alt="Ảnh bằng chứng bàn giao" style={{ maxWidth: "100%", maxHeight: "82vh", borderRadius: 8, boxShadow: "0 24px 48px rgba(15, 23, 42, 0.4)", border: "2px solid #fff" }} />
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              style={{ position: "absolute", top: "-14px", right: "-14px", width: "36px", height: "36px", borderRadius: "50%", border: "none", background: "#fff", color: "#0f172a", cursor: "pointer", fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)" }}
              title="Đóng ảnh phóng to"
            >
              ×
            </button>
            <span style={{ marginTop: 8, fontSize: "0.82rem", color: "#f8fafc", fontWeight: 500, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>Ảnh bằng chứng bàn giao vật phẩm</span>
          </AccessibleDialog>
        </div>
      )}
    </>
  );
}

/* ─────────────── Main Staff Page ─────────────── */

export function StaffPage() {
  const [searchParams] = useSearchParams();
  const warehouseQuery = useRef({ ...emptyFilters, page: 1 });
  const custodyQuery = useRef<{ status: string; handoverPointId?: string; q?: string; page: number }>({ status: "ALL", page: 1 });
  const custodyLoadSequence = useRef(0);
  const warehouseLoadSequence = useRef(0);
  const [activeTab, setActiveTab] = useState<StaffTab>(searchParams.get("tab") === "warehouse" ? "warehouse" : "custody");
  const [catalog, setCatalog] = useState<WarehouseCatalog | null>(null);
  const [dashboard, setDashboard] = useState<WarehouseDashboard | null>(null);
  const [custodyData, setCustodyData] = useState<CustodyRequestListResponse | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>("load");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadCatalog() {
    const value = await api.getWarehouseCatalog();
    setCatalog(value);
  }

  async function loadDashboard() {
    const sequence = ++warehouseLoadSequence.current;
    const q = { ...warehouseQuery.current };
    const result = await api.listWarehouseItems({ overdue: q.overdue || undefined, q: q.q || undefined, status: q.status ? q.status as WarehouseStatus : undefined, handoverPointId: q.handoverPointId || undefined, page: q.page, pageSize: 9 });
    if (sequence === warehouseLoadSequence.current) setDashboard(result);
  }

  async function loadCustody() {
    const sequence = ++custodyLoadSequence.current;
    const q = { ...custodyQuery.current };
    const result = await api.listCustodyRequests({
      status: q.status !== "ALL" ? q.status as CustodyRequestStatus : undefined,
      handoverPointId: q.handoverPointId || undefined,
      q: q.q || undefined,
      page: q.page,
      pageSize: 9
    });
    if (sequence === custodyLoadSequence.current) setCustodyData(result);
  }

  async function loadInitial() {
    setPendingAction("load");
    setError("");
    try {
      await Promise.all([loadCatalog(), loadCustody()]);
    } catch (reason) {
      setError(messageOf(reason, "Không thể tải dữ liệu nhân viên"));
    } finally {
      setPendingAction("");
    }
  }

  useEffect(() => { void loadInitial(); }, []);

  // Lazy load warehouse inventory data when user switches to warehouse tab
  useEffect(() => {
    if (activeTab === "warehouse" && !dashboard) {
      setPendingAction("load");
      loadDashboard().catch((reason) => setError(messageOf(reason, "Không thể tải dữ liệu kho"))).finally(() => setPendingAction(""));
    }
  }, [activeTab, dashboard]);

  async function refreshCustody(filters?: { status?: string; handoverPointId?: string; q?: string }, page?: number) {
    if (filters?.status !== undefined) custodyQuery.current.status = filters.status;
    if (filters?.handoverPointId !== undefined) custodyQuery.current.handoverPointId = filters.handoverPointId;
    if (filters?.q !== undefined) custodyQuery.current.q = filters.q;
    if (page !== undefined) custodyQuery.current.page = page;
    try {
      await Promise.all([loadCustody(), loadDashboard()]);
    } catch (reason) {
      setError(messageOf(reason, "Không thể làm mới hàng đợi bàn giao"));
    }
  }

  async function refreshWarehouse(filters?: typeof emptyFilters, page?: number) {
    if (filters) warehouseQuery.current = { ...filters, page: page ?? 1 };
    try {
      await Promise.all([loadDashboard(), loadCustody()]);
    } catch (reason) {
      setError(messageOf(reason, "Không thể làm mới dữ liệu kho"));
    }
  }

  async function refresh() {
    setPendingAction("load");
    setError("");
    try {
      if (activeTab === "custody") await loadCustody();
      else if (activeTab === "warehouse") await loadDashboard();
      else await Promise.all([loadCustody(), loadDashboard()]);
    } catch (reason) {
      setError(messageOf(reason, "Không thể làm mới dữ liệu"));
    } finally {
      setPendingAction("");
    }
  }

  if (pendingAction === "load" && !catalog) {
    return (
      <main className="center-state">
        <LoaderCircle className="spin-icon" size={32} />
        <p>Đang tải dữ liệu khu vực nhân viên...</p>
      </main>
    );
  }

  const tabItems: Array<{ key: StaffTab; label: string; icon: ReactNode; badge?: number }> = [
    { key: "custody", label: "Hàng đợi Bàn giao", icon: <ShieldCheck size={18} />, badge: custodyData?.counts.PENDING },
    { key: "warehouse", label: "Kho tài sản", icon: <Archive size={18} /> },
    { key: "dashboard", label: "Tổng quan", icon: <FileText size={18} /> },
    { key: "logs", label: "Lịch sử hệ thống", icon: <History size={18} /> }
  ];

  return (
    <section className="warehouse-page staff-page-container">
      {/* Staff Hero Banner */}
      <header className="admin-hero warehouse-hero staff-hero">
        <div className="staff-hero__info">
          <span className="hero-eyebrow">
            <ShieldCheck size={14} /> KHU VỰC NHÂN VIÊN & DỊCH VỤ KHO
          </span>
          <h1>Tiếp nhận & Hàng đợi Bàn giao</h1>
          <p className="hero-subtitle">
            Hàng đợi bàn giao tài sản từ người nhặt, quản lý lưu trữ kho và bàn giao tài sản tại campus.
          </p>
        </div>
        <div className="staff-hero__actions">
          <button
            type="button"
            className="secondary-button refresh-btn"
            onClick={() => void refresh()}
            disabled={pendingAction === "load"}
          >
            <RefreshCw size={16} className={pendingAction === "load" ? "spin-icon" : ""} />
            <span>Làm mới</span>
          </button>
        </div>
      </header>

      {/* Staff Tab Bar Navigation */}
      <nav className="staff-tabs-container" aria-label="Staff navigation tabs">
        <div className="staff-tabs">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`staff-tab ${activeTab === tab.key ? "staff-tab--active" : ""}`}
              onClick={() => { setActiveTab(tab.key); setError(""); setNotice(""); }}
              aria-selected={activeTab === tab.key}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {Boolean(tab.badge && tab.badge > 0) && (
                <span className="staff-tab-badge pulse-badge">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab Panels */}
      {activeTab === "custody" && (
        <CustodyQueueTab
          catalog={catalog}
          custodyData={custodyData}
          pendingAction={pendingAction}
          error={error}
          notice={notice}
          onRefreshCustody={refreshCustody}
          onNotice={setNotice}
          onError={setError}
          setPendingAction={setPendingAction}
        />
      )}

      {activeTab === "warehouse" && (
        <WarehouseInventoryTab
          catalog={catalog}
          dashboard={dashboard}
          pendingAction={pendingAction}
          error={error}
          notice={notice}
          onRefresh={refreshWarehouse}
          setPendingAction={setPendingAction}
          onNotice={setNotice}
          onError={setError}
        />
      )}

      {activeTab === "dashboard" && (
        <div className="warehouse-empty staff-placeholder-panel">
          <FileText size={48} className="empty-icon" />
          <h3>Báo cáo tổng quan hoạt động kho</h3>
          <p>Tính năng báo cáo thống kê chu kỳ tiếp nhận và bàn giao đang trong lộ trình tích hợp.</p>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="warehouse-empty staff-placeholder-panel">
          <History size={48} className="empty-icon" />
          <h3>Lịch sử hoạt động toàn hệ thống</h3>
          <p>Truy xuất toàn bộ nhật ký thao tác tiếp nhận, chuyển kho và hủy vật phẩm.</p>
        </div>
      )}
    </section>
  );
}
