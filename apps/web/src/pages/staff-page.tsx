import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type ImgHTMLAttributes } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
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
  type AcceptCustodyRequestPayload,
  type CreateWarehouseItemPayload,
  type CustodyRequest,
  type CustodyRequestListResponse,
  type CustodyRequestStatus,
  type WarehouseCatalog,
  type WarehouseDashboard,
  type WarehouseItem,
  type WarehouseStatus,
  type WarehouseStorageLog
} from "../services/api";

type StaffTab = "custody" | "warehouse" | "dashboard" | "logs";
type PendingAction = "" | "load" | "create" | "update" | "logs" | "custody" | "custody-action";

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
  PENDING: { label: "Chờ duyệt", icon: <Clock3 size={14} /> },
  ACCEPTED: { label: "Đã duyệt – Chờ bàn giao", icon: <UserCheck size={14} /> },
  REJECTED: { label: "Từ chối", icon: <XCircle size={14} /> },
  CANCELLED: { label: "Đã hủy", icon: <XCircle size={14} /> },
  INTAKED: { label: "Đã tiếp nhận", icon: <CheckCircle2 size={14} /> }
};

const emptyCreateForm = {
  handoverPointId: "",
  itemName: "",
  description: "",
  categoryId: "",
  areaId: "",
  buildingId: "",
  roomText: "",
  finderName: "",
  finderContact: "",
  conditionNotes: "",
  storageCode: "",
  receivedAt: ""
};

const emptyFilters = { q: "", status: "", handoverPointId: "" };
const emptyAcceptForm = { handoverPointId: "", confirmedHandoverAt: "", reason: "" };
const emptyRejectForm = { reason: "" };
const emptyIntakeForm = { conditionNotes: "", storageCode: "", confirmedHandoverAt: "" };

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
  return <nav className="warehouse-pagination" aria-label="Phân trang"><button type="button" className="secondary-button" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>Trước</button><span>{page} / {pages} · {total} mục</span><button type="button" className="secondary-button" disabled={busy || page >= pages} onClick={() => onPage(page + 1)}>Sau</button></nav>;
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
  onRefreshCustody: (status?: string, page?: number) => Promise<void>;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
  setPendingAction: (action: PendingAction) => void;
}) {
  const [acceptModal, setAcceptModal] = useState<CustodyRequest | null>(null);
  const [rejectModal, setRejectModal] = useState<CustodyRequest | null>(null);
  const [intakeModal, setIntakeModal] = useState<CustodyRequest | null>(null);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [acceptForm, setAcceptForm] = useState(emptyAcceptForm);
  const [rejectForm, setRejectForm] = useState(emptyRejectForm);
  const [intakeForm, setIntakeForm] = useState(emptyIntakeForm);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [statusFilter, updateStatusFilter] = useState<string>("ALL");
  function setStatusFilter(status: string) { updateStatusFilter(status); void onRefreshCustody(status, 1); }

  const allCategories = useMemo(() => {
    if (!catalog?.categories) return [];
    return [...catalog.categories].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [catalog]);

  const availableBuildings = useMemo(() => {
    if (!catalog?.buildings) return [];
    if (!createForm.areaId) return catalog.buildings;
    const filtered = catalog.buildings.filter((item) => item.areaId === createForm.areaId);
    return filtered.length > 0 ? filtered : catalog.buildings;
  }, [catalog, createForm.areaId]);

  // Default handover point selection
  useEffect(() => {
    if (catalog?.handoverPoints.length) {
      setCreateForm((prev) => ({
        ...prev,
        handoverPointId: prev.handoverPointId || catalog.handoverPoints[0]?.id || ""
      }));
    }
  }, [catalog]);

  const filteredRequests = useMemo(() => {
    if (!custodyData?.items) return [];
    return custodyData.items;
  }, [custodyData, statusFilter]);

  const [createdWalkInItem, setCreatedWalkInItem] = useState<WarehouseItem | null>(null);

  async function submitWalkIn(event: FormEvent) {
    event.preventDefault();
    setPendingAction("create");
    onError("");
    onNotice("");
    try {
      const payload: CreateWarehouseItemPayload = {
        handoverPointId: createForm.handoverPointId,
        itemName: createForm.itemName,
        description: clean(createForm.description),
        categoryId: clean(createForm.categoryId),
        areaId: clean(createForm.areaId),
        buildingId: clean(createForm.buildingId),
        roomText: clean(createForm.roomText),
        finderName: clean(createForm.finderName),
        finderContact: clean(createForm.finderContact),
        conditionNotes: createForm.conditionNotes,
        receivedAt: createForm.receivedAt ? new Date(createForm.receivedAt).toISOString() : undefined
      };
      const created = await api.createWarehouseItem(payload);
      setCreatedWalkInItem(created);
      onNotice("Đã tiếp nhận vật phẩm thành công (Walk-in)");
      setCreateForm({ ...emptyCreateForm, handoverPointId: createForm.handoverPointId });
      setWalkInModalOpen(false);
      await onRefreshCustody();
    } catch (reason) {
      onError(messageOf(reason, "Không thể tiếp nhận vật phẩm"));
    } finally {
      setPendingAction("");
    }
  }

  async function submitAccept(event: FormEvent) {
    event.preventDefault();
    if (!acceptModal) return;
    setPendingAction("custody-action");
    onError("");
    onNotice("");
    try {
      const payload: AcceptCustodyRequestPayload = {
        handoverPointId: acceptForm.handoverPointId,
        confirmedHandoverAt: acceptForm.confirmedHandoverAt ? new Date(acceptForm.confirmedHandoverAt).toISOString() : null,
        reason: clean(acceptForm.reason)
      };
      await api.acceptCustodyRequest(acceptModal.id, payload);
      onNotice("Đã duyệt yêu cầu bàn giao thành công");
      setAcceptModal(null);
      setAcceptForm(emptyAcceptForm);
      await onRefreshCustody();
    } catch (reason) {
      onError(messageOf(reason, "Không thể duyệt yêu cầu"));
    } finally {
      setPendingAction("");
    }
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
      await onRefreshCustody();
    } catch (reason) {
      onError(messageOf(reason, "Không thể từ chối yêu cầu"));
    } finally {
      setPendingAction("");
    }
  }

  async function submitCancel(requestId: string) {
    setPendingAction("custody-action");
    onError("");
    onNotice("");
    try {
      await api.cancelCustodyRequest(requestId, { reason: "Hủy bởi nhân viên" });
      onNotice("Đã hủy yêu cầu custody");
      await onRefreshCustody();
    } catch (reason) {
      onError(messageOf(reason, "Không thể hủy yêu cầu"));
    } finally {
      setPendingAction("");
    }
  }

  async function submitIntake(event: FormEvent) {
    event.preventDefault();
    if (!intakeModal) return;
    setPendingAction("custody-action");
    onError("");
    onNotice("");
    try {
      await api.confirmCustodyIntake(intakeModal.id, {
        conditionNotes: intakeForm.conditionNotes,
        storageCode: clean(intakeForm.storageCode),
        confirmedHandoverAt: intakeForm.confirmedHandoverAt ? new Date(intakeForm.confirmedHandoverAt).toISOString() : null
      });
      onNotice("Đã xác nhận bàn giao thực tế & Nhập kho tài sản");
      setIntakeModal(null);
      setIntakeForm(emptyIntakeForm);
      await onRefreshCustody();
    } catch (reason) {
      onError(messageOf(reason, "Không thể xác nhận bàn giao"));
    } finally {
      setPendingAction("");
    }
  }

function currentLocalTime() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function defaultHandoverTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

  function openAcceptModal(request: CustodyRequest) {
    setAcceptForm({
      ...emptyAcceptForm,
      handoverPointId: request.handoverPoint?.id ?? catalog?.handoverPoints[0]?.id ?? "",
      confirmedHandoverAt: defaultHandoverTime()
    });
    setAcceptModal(request);
  }

  return (
    <>
      {/* Stats summary banner */}
      <div className="admin-stats warehouse-stats" aria-label="Thống kê custody">
        <StatCard icon={<Clock3 size={20} />} value={custodyData?.counts.PENDING ?? 0} label="Chờ duyệt" tone="orange" />
        <StatCard icon={<UserCheck size={20} />} value={custodyData?.counts.ACCEPTED ?? 0} label="Chờ bàn giao" tone="blue" />
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
        <div className="custody-toolbar">
          <div className="admin-list-heading">
            <div>
              <p className="eyebrow">HÀNG ĐỜI BÀN GIAO</p>
              <h2>Yêu cầu Custody ({custodyData?.total ?? 0})</h2>
            </div>
          </div>

          <div className="custody-toolbar-right">
            {/* Filter chips */}
            <div className="custody-filter-chips">
              <button type="button" className={`chip ${statusFilter === "ALL" ? "chip--active" : ""}`} onClick={() => setStatusFilter("ALL")}>Tất cả</button>
              <button type="button" className={`chip ${statusFilter === "PENDING" ? "chip--active" : ""}`} onClick={() => setStatusFilter("PENDING")}>Chờ duyệt ({custodyData?.counts.PENDING ?? 0})</button>
              <button type="button" className={`chip ${statusFilter === "ACCEPTED" ? "chip--active" : ""}`} onClick={() => setStatusFilter("ACCEPTED")}>Chờ bàn giao ({custodyData?.counts.ACCEPTED ?? 0})</button>
              <button type="button" className={`chip ${statusFilter === "INTAKED" ? "chip--active" : ""}`} onClick={() => setStatusFilter("INTAKED")}>Đã nhập kho ({custodyData?.counts.INTAKED ?? 0})</button>
            </div>

            {/* Walk-in Intake Trigger Button */}
            <button
              type="button"
              className="primary-button add-walkin-btn"
              onClick={() => setWalkInModalOpen(true)}
            >
              <Plus size={16} />
              <span>Tiếp nhận Walk-in (Tại quầy)</span>
            </button>
          </div>
        </div>

        {custodyData && <Pagination page={custodyData.page} pageSize={custodyData.pageSize} total={custodyData.total} busy={Boolean(pendingAction)} onPage={page => void onRefreshCustody(statusFilter, page)} />}
        <div className="custody-request-list">
          {filteredRequests.map((request) => {
            const statusCfg = custodyStatusLabels[request.status];
            return (
              <article key={request.id} className={`custody-request-card custody-request-card--${request.status.toLowerCase()}`}>
                <div className="custody-request-card__header">
                  <div className="custody-request-card__badges">
                    <span className={`custody-status custody-status--${request.status.toLowerCase()}`}>
                      {statusCfg?.icon}
                      <span>{statusCfg?.label ?? request.status}</span>
                    </span>
                    <span className="custody-type-pill">
                      {request.intakeType === "CUSTODY_TRANSFER" ? "Bàn giao trực tuyến" : "Walk-in tại quầy"}
                    </span>
                  </div>
                  <span className="custody-request-id">#{request.id.slice(0, 8)}</span>
                </div>

                <div className="custody-request-card__body">
                  <div className="custody-item-preview">
                    <h3>{request.post?.title ?? "Bàn giao vật phẩm tìm thấy"}</h3>
                    {request.reason && <p className="custody-reason">"{request.reason}"</p>}
                  </div>

                  <div className="custody-meta-grid">
                    <div className="custody-meta-item">
                      <User size={14} />
                      <span><strong>Người gửi:</strong> {request.requester.fullName ?? "Không rõ"}</span>
                    </div>
                    {request.handoverPoint && (
                      <div className="custody-meta-item">
                        <MapPin size={14} />
                        <span><strong>Điểm bàn giao:</strong> {request.handoverPoint.name}</span>
                      </div>
                    )}
                    <div className="custody-meta-item">
                      <Calendar size={14} />
                      <span><strong>Tạo lúc:</strong> {formatDateTime(request.createdAt)}</span>
                    </div>
                    {request.confirmedHandoverAt && (
                      <div className="custody-meta-item">
                        <Clock3 size={14} />
                        <span><strong>Hẹn bàn giao:</strong> {formatDateTime(request.confirmedHandoverAt)}</span>
                      </div>
                    )}
                    {request.handler && (
                      <div className="custody-meta-item">
                        <UserCheck size={14} />
                        <span><strong>Xử lý bởi:</strong> {request.handler.fullName}</span>
                      </div>
                    )}
                    {request.rejectionReason && (
                      <div className="custody-meta-item custody-meta-item--danger">
                        <XCircle size={14} />
                        <span><strong>Lý do từ chối:</strong> {request.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="custody-request-card__actions">
                  {request.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        className="primary-button custody-action-btn"
                        onClick={() => openAcceptModal(request)}
                        disabled={Boolean(pendingAction)}
                      >
                        <CheckCircle2 size={15} /> Chấp nhận yêu cầu
                      </button>
                      <button
                        type="button"
                        className="secondary-button custody-action-btn custody-action-btn--danger"
                        onClick={() => { setRejectForm(emptyRejectForm); setRejectModal(request); }}
                        disabled={Boolean(pendingAction)}
                      >
                        <XCircle size={15} /> Từ chối
                      </button>
                    </>
                  )}

                  {request.status === "ACCEPTED" && (
                    <>
                      <button
                        type="button"
                        className="primary-button custody-action-btn custody-action-btn--success"
                        onClick={() => { setIntakeForm(emptyIntakeForm); setIntakeModal(request); }}
                        disabled={Boolean(pendingAction)}
                      >
                        <PackageCheck size={16} /> Xác nhận tiếp nhận
                      </button>
                      <button
                        type="button"
                        className="secondary-button custody-action-btn custody-action-btn--danger"
                        onClick={() => { if (window.confirm('Bạn có chắc chắn muốn hủy yêu cầu bàn giao này do người dùng không đến?')) submitCancel(request.id); }}
                        disabled={Boolean(pendingAction)}
                      >
                        <XCircle size={15} /> Hủy
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}

          {!filteredRequests.length && (
            <div className="warehouse-empty">
              <Inbox size={48} className="empty-icon" />
              <h3>Chưa có yêu cầu custody</h3>
              <p>Hiện không có yêu cầu bàn giao nào phù hợp với bộ lọc.</p>
            </div>
          )}
        </div>
      </section>

      {/* Modal Walk-in Receive Form */}
      {walkInModalOpen && (
        <div className="custody-modal-overlay" onClick={() => setWalkInModalOpen(false)}>
          <div className="custody-modal custody-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="custody-modal__header">
              <span className="modal-badge modal-badge--blue"><ClipboardCheck size={20} /></span>
              <div>
                <h3>Tiếp nhận trực tiếp (Walk-in / Tại quầy)</h3>
                <p>Nhập kho tài sản trực tiếp do người nhặt đem tới bàn tiếp nhận mà không qua yêu cầu trực tuyến.</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setWalkInModalOpen(false)}><X size={18} /></button>
            </div>

            <form className="admin-form modal-form" onSubmit={submitWalkIn}>
              <label className="input-field">
                <span>Điểm bàn giao <strong className="required-star">*</strong></span>
                <select value={createForm.handoverPointId} onChange={(event) => setCreateForm({ ...createForm, handoverPointId: event.target.value })} required>
                  <option value="">Chọn điểm bàn giao</option>
                  {catalog?.handoverPoints.map((point) => (
                    <option key={point.id} value={point.id}>{point.name} - {point.address}</option>
                  ))}
                </select>
              </label>

              <label className="input-field">
                <span>Tên vật phẩm <strong className="required-star">*</strong></span>
                <input value={createForm.itemName} onChange={(event) => setCreateForm({ ...createForm, itemName: event.target.value })} placeholder="Ví dụ: Ví da màu nâu, Chìa khóa xe..." required />
              </label>

              <label className="input-field">
                <span>Danh mục</span>
                <select value={createForm.categoryId} onChange={(event) => setCreateForm({ ...createForm, categoryId: event.target.value })}>
                  <option value="">-- Chọn danh mục --</option>
                  {allCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="input-field">
                <span>Mô tả chi tiết</span>
                <textarea value={createForm.description} onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} rows={2} placeholder="Mô tả đặc điểm nhận dạng, nhãn hiệu, màu sắc..." />
              </label>

              <label className="input-field">
                <span>Tình trạng khi nhận <strong className="required-star">*</strong></span>
                <textarea value={createForm.conditionNotes} onChange={(event) => setCreateForm({ ...createForm, conditionNotes: event.target.value })} rows={2} placeholder="Vết trầy xước, phụ kiện kèm theo..." required />
              </label>

              <div className="warehouse-form-pair">
                <label className="input-field">
                  <span>Khu vực</span>
                  <select value={createForm.areaId} onChange={(event) => setCreateForm({ ...createForm, areaId: event.target.value, buildingId: "" })}>
                    <option value="">-- Chọn khu vực --</option>
                    {catalog?.areas.map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </label>

                <label className="input-field">
                  <span>Tòa nhà / Địa điểm</span>
                  <select value={createForm.buildingId} onChange={(event) => setCreateForm({ ...createForm, buildingId: event.target.value })}>
                    <option value="">-- Chọn tòa nhà / địa điểm --</option>
                    {availableBuildings.map((building) => (
                      <option key={building.id} value={building.id}>{building.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="input-field">
                <span>Vị trí nhặt được</span>
                <input value={createForm.roomText} onChange={(event) => setCreateForm({ ...createForm, roomText: event.target.value })} placeholder="Sảnh tầng 1, Phòng 203..." />
              </label>

              <div className="warehouse-form-pair">
                <label className="input-field">
                  <span>Người bàn giao</span>
                  <input value={createForm.finderName} onChange={(event) => setCreateForm({ ...createForm, finderName: event.target.value })} placeholder="Họ và tên" />
                </label>

                <label className="input-field">
                  <span>Liên hệ người giao</span>
                  <input value={createForm.finderContact} onChange={(event) => setCreateForm({ ...createForm, finderContact: event.target.value })} placeholder="Số điện thoại / Email" />
                </label>
              </div>

              <label className="input-field">
                <span>Thời gian nhận thực tế</span>
                <input type="datetime-local" max={currentLocalTime()} value={createForm.receivedAt} onChange={(event) => setCreateForm({ ...createForm, receivedAt: event.target.value })} />
              </label>

              <div className="custody-modal-actions">
                <button className="primary-button" disabled={pendingAction === "create"}>
                  {pendingAction === "create" ? <LoaderCircle className="spin-icon" size={17} /> : <ClipboardCheck size={17} />}
                  <span>Tạo hồ sơ kho (Walk-in)</span>
                </button>
                <button type="button" className="secondary-button" onClick={() => setWalkInModalOpen(false)}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Walk-in Intake Success Modal */}
      {createdWalkInItem && (
        <div className="custody-modal-overlay" onClick={() => setCreatedWalkInItem(null)}>
          <div className="custody-modal custody-modal--success" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
      )}

      {/* Accept Modal */}
      {acceptModal && (
        <div className="custody-modal-overlay" onClick={() => setAcceptModal(null)}>
          <div className="custody-modal" onClick={(e) => e.stopPropagation()}>
            <div className="custody-modal__header">
              <span className="modal-badge modal-badge--blue"><CheckCircle2 size={18} /></span>
              <div>
                <h3>Chấp nhận yêu cầu Custody</h3>
                <p>Xác nhận duyệt chuyển giao từ <strong>{acceptModal.requester.fullName}</strong></p>
              </div>
              <button type="button" className="close-btn" onClick={() => setAcceptModal(null)}><X size={18} /></button>
            </div>

            <form className="admin-form modal-form" onSubmit={submitAccept}>
              <label className="input-field">
                <span>Điểm hẹn bàn giao <strong className="required-star">*</strong></span>
                <select value={acceptForm.handoverPointId} onChange={(e) => setAcceptForm({ ...acceptForm, handoverPointId: e.target.value })} required>
                  <option value="">Chọn điểm bàn giao</option>
                  {catalog?.handoverPoints.map((point) => (
                    <option key={point.id} value={point.id}>{point.name} - {point.address}</option>
                  ))}
                </select>
              </label>

              <label className="input-field">
                <span>Thời gian hẹn bàn giao (dự kiến)</span>
                <input type="datetime-local" min={currentLocalTime()} value={acceptForm.confirmedHandoverAt} onChange={(e) => setAcceptForm({ ...acceptForm, confirmedHandoverAt: e.target.value })} />
                <small className="field-hint">Thời gian này giúp thông báo người nhặt thời gian quầy tiếp nhận mở cửa.</small>
              </label>

              <label className="input-field">
                <span>Ghi chú hướng dẫn (gửi cho người nhặt)</span>
                <textarea value={acceptForm.reason} onChange={(e) => setAcceptForm({ ...acceptForm, reason: e.target.value })} rows={2} placeholder="Vui lòng mang theo MSSV khi đến bàn giao tại quầy..." />
              </label>

              <div className="custody-modal-actions">
                <button className="primary-button" disabled={pendingAction === "custody-action"}>
                  {pendingAction === "custody-action" ? <LoaderCircle className="spin-icon" size={17} /> : <CheckCircle2 size={17} />}
                  <span>Chấp nhận yêu cầu</span>
                </button>
                <button type="button" className="secondary-button" onClick={() => setAcceptModal(null)}>Đóng</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="custody-modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="custody-modal" onClick={(e) => e.stopPropagation()}>
            <div className="custody-modal__header">
              <span className="modal-badge modal-badge--red"><XCircle size={18} /></span>
              <div>
                <h3>Từ chối yêu cầu Custody</h3>
                <p>Từ chối yêu cầu từ người dùng <strong>{rejectModal.requester.fullName}</strong></p>
              </div>
              <button type="button" className="close-btn" onClick={() => setRejectModal(null)}><X size={18} /></button>
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
                <button type="button" className="secondary-button" onClick={() => setRejectModal(null)}>Đóng</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Intake Physical Handoff Modal */}
      {intakeModal && (
        <div className="custody-modal-overlay" onClick={() => setIntakeModal(null)}>
          <div className="custody-modal" onClick={(e) => e.stopPropagation()}>
            <div className="custody-modal__header">
              <span className="modal-badge modal-badge--green"><PackageCheck size={18} /></span>
              <div>
                <h3>Xác nhận tiếp nhận</h3>
                <p>Yêu cầu <strong>#{intakeModal.id.slice(0, 8)}</strong> - Người bàn giao: <strong>{intakeModal.requester.fullName}</strong></p>
              </div>
              <button type="button" className="close-btn" onClick={() => setIntakeModal(null)}><X size={18} /></button>
            </div>

            <form className="admin-form modal-form" onSubmit={submitIntake}>
              <label className="input-field">
                <span>Tình trạng vật phẩm kiểm tra thực tế <strong className="required-star">*</strong></span>
                <textarea value={intakeForm.conditionNotes} onChange={(e) => setIntakeForm({ ...intakeForm, conditionNotes: e.target.value })} rows={3} placeholder="Ghi rõ tình trạng thực tế khi nhận: hoạt động, vết xước, phụ kiện kèm theo..." required />
              </label>

              <label className="input-field">
                <span>Thời gian bàn giao thực tế</span>
                <input type="datetime-local" max={currentLocalTime()} value={intakeForm.confirmedHandoverAt} onChange={(e) => setIntakeForm({ ...intakeForm, confirmedHandoverAt: e.target.value })} />
                <small className="field-hint">Để trống nếu tính theo thời gian hiện tại.</small>
              </label>

              <div className="custody-modal-actions">
                <button className="primary-button primary-button--success" disabled={pendingAction === "custody-action"}>
                  {pendingAction === "custody-action" ? <LoaderCircle className="spin-icon" size={17} /> : <PackageCheck size={17} />}
                  <span>Xác nhận tiếp nhận</span>
                </button>
                <button type="button" className="secondary-button" onClick={() => setIntakeModal(null)}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [logs, setLogs] = useState<WarehouseStorageLog[]>([]);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [returnTargetItem, setReturnTargetItem] = useState<WarehouseItem | null>(null);
  const [returnRecipients, setReturnRecipients] = useState<Array<{ claimId: string; recipientId: string; fullName: string }>>([]);
  useEffect(() => {
    let active = true;
    setReturnRecipients([]);
    if (returnTargetItem) {
      void api.getWarehouseReturnRecipients(returnTargetItem.id).then(value => {
        if (active) setReturnRecipients(value.recipients);
      }).catch(() => {
        if (active) setReturnRecipients([]);
      });
    }
    return () => { active = false; };
  }, [returnTargetItem?.id]);
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
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  function parseStorageLogNote(noteText: string) {
    const references = /^Proof references: ([0-9a-f -]+)$/im.exec(noteText)?.[1].trim().split(/\s+/) ?? [];
    const cleanNote = noteText.split("\n").filter(line => !/https?:\/\/|data:image|Hình ảnh bằng chứng|Proof references:/i.test(line)).map(line => line.trim()).filter(Boolean).join(" • ");
    return { cleanNote, imageUrls: references.filter(id => /^[0-9a-f-]{36}$/i.test(id)) };
  }
  const selectedItem = useMemo(
    () => dashboard?.items.find((item) => item.id === selectedItemId) ?? null,
    [dashboard, selectedItemId]
  );

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
    if (!silent) setPendingAction("logs");
    onError("");
    try {
      setLogs(await api.getWarehouseLogs(itemId));
    } catch (reason) {
      onError(messageOf(reason, "Không thể tải nhật ký kho"));
    } finally {
      if (!silent) setPendingAction("");
    }
  }

  function selectItem(item: WarehouseItem) {
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
    setReturnTargetItem(item);
    setReturnForm({ claimId: "", recipientId: "", receiverName: "", receiverIdentity: "", receiverPhone: "", proofImages: [], note: "" });
  }

  async function submitReturn(event: FormEvent) {
    event.preventDefault();
    if (!returnTargetItem) return;
    setPendingAction("update");
    onError("");
    onNotice("");
    try {
      await api.returnWarehouseItem(returnTargetItem.id, {
        claimId: returnForm.claimId, recipientId: returnForm.recipientId,
        receiverName: clean(returnForm.receiverName) ?? "",
        receiverIdentity: clean(returnForm.receiverIdentity) ?? "",
        receiverPhone: clean(returnForm.receiverPhone) ?? "",
        proofImage: returnForm.proofImages.join("\n") || "",
        note: clean(returnForm.note)
      });
      onNotice("Đã hoàn tất trả hàng cho chủ sở hữu!");
      setReturnTargetItem(null);
      await onRefresh();
      if (selectedItemId === returnTargetItem.id) {
        await loadLogs(returnTargetItem.id, true).catch(() => undefined);
      }
    } catch (reason) {
      onError(messageOf(reason, "Không thể xử lý trả hàng"));
    } finally {
      setPendingAction("");
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
              <div className="input-with-icon">
                <Search size={16} />
                <input
                  aria-label="Tìm vật phẩm trong kho"
                  value={filters.q}
                  onChange={(event) => setFilters({ ...filters, q: event.target.value })}
                  placeholder="Tên vật phẩm, mô tả, mã kho..."
                />
              </div>
            </label>

            <label className="input-field">
              <span>Trạng thái</span>
              <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                <option value="">Tất cả trạng thái</option>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </label>

            <label className="input-field">
              <span>Điểm bàn giao</span>
              <select value={filters.handoverPointId} onChange={(event) => setFilters({ ...filters, handoverPointId: event.target.value })}>
                <option value="">Tất cả điểm</option>
                {catalog?.handoverPoints.map((point) => (
                  <option key={point.id} value={point.id}>{point.name}</option>
                ))}
              </select>
            </label>

            <button className="secondary-button search-btn">
              <Filter size={16} /> Lọc
            </button>
          </form>

          {/* Item List Grid */}
          {dashboard && <Pagination page={dashboard.page} pageSize={dashboard.pageSize} total={dashboard.total} busy={Boolean(pendingAction)} onPage={page => void onRefresh(filters, page)} />}
          <div className="warehouse-item-list">
            {dashboard?.items.map((item) => (
              <article className={`warehouse-item-card ${selectedItemId === item.id ? "is-selected" : ""}`} key={item.id}>
                <div className="warehouse-item-card__top">
                  <span className={`warehouse-status warehouse-status--${item.status.toLowerCase()}`}>
                    {statusLabel(item.status)}
                  </span>
                  <div className="warehouse-card-actions">
                    <button type="button" className="secondary-button warehouse-select-button" onClick={() => selectItem(item)}>
                      <History size={14} /> Chi tiết & Nhật ký
                    </button>
                    {["RECEIVED", "STORED", "CLAIMED"].includes(item.status) && (
                      <button type="button" className="primary-button warehouse-select-button" onClick={() => openReturnModal(item)}>
                        <UserCheck size={14} /> Trả cho chủ sở hữu
                      </button>
                    )}
                  </div>
                </div>

                <h2>{item.itemName}</h2>
                <p>{item.description || "Không có mô tả chi tiết."}</p>

                <dl className="warehouse-item-meta">
                  <ItemMeta
                    label="Hạn lưu giữ"
                    value={
                      <span className={isOverdue(item) ? "warehouse-deadline is-overdue" : "warehouse-deadline"}>
                        {formatDate(item.retentionDeadline)}
                      </span>
                    }
                  />
                  <ItemMeta label="Mã lưu kho" value={<code className="code-badge">{item.storageCode || "Chưa gán"}</code>} />
                  <ItemMeta label="Điểm nhận" value={item.handoverPoint?.name ?? "Chưa rõ"} />
                  <ItemMeta label="Lịch sử" value={`${item.logCount} nhật ký`} />
                </dl>
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
        </section>

        {/* Details & History Panel (No embedded form; Clean detail view + Update Status Button) */}
        <aside className="admin-panel warehouse-detail-panel">
          <div className="admin-panel-heading">
            <span className="panel-icon-badge"><History size={18} /></span>
            <div>
              <p className="eyebrow">CHI TIẾT VẬT PHẨM KHO</p>
              <h2>Chi tiết & Lịch sử</h2>
            </div>
          </div>

          {selectedItem ? (
            <>
              <div className="warehouse-selected-summary">
                <div className="summary-header">
                  <span className={`warehouse-status warehouse-status--${selectedItem.status.toLowerCase()}`}>
                    {statusLabel(selectedItem.status)}
                  </span>
                  <code className="code-badge">{selectedItem.storageCode || "Chưa có vị trí lưu kho"}</code>
                </div>

                <h3>{selectedItem.itemName}</h3>
                <p className="summary-desc">{selectedItem.description || "Không có mô tả thêm."}</p>

                <div className="item-detail-grid">
                  <div><strong>Hạn lưu giữ:</strong> {formatDate(selectedItem.retentionDeadline)}</div>
                  <div><strong>Tiếp nhận lúc:</strong> {formatDateTime(selectedItem.receivedAt)}</div>
                  {selectedItem.handoverPoint && <div><strong>Điểm bàn giao:</strong> {selectedItem.handoverPoint.name}</div>}
                  {selectedItem.conditionNotes && <div><strong>Tình trạng nhận:</strong> {selectedItem.conditionNotes}</div>}
                </div>

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

                {pendingAction === "logs" && (
                  <div className="loading-inline"><LoaderCircle className="spin-icon" size={16} /> Đang tải nhật ký...</div>
                )}

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
                  {!logs.length && pendingAction !== "logs" && (
                    <p className="admin-hint">Chưa có nhật ký ghi nhận cho vật phẩm này.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="warehouse-empty warehouse-empty--compact">
              <History size={40} className="empty-icon" />
              <h3>Chưa chọn vật phẩm</h3>
              <p>Chọn một vật phẩm trong danh sách bên trái để xem chi tiết và lịch sử nhật ký.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Update Warehouse Item Status Modal */}
      {updateModalOpen && selectedItem && (
        <div className="custody-modal-overlay" onClick={() => setUpdateModalOpen(false)}>
          <div className="custody-modal" onClick={(e) => e.stopPropagation()}>
            <div className="custody-modal__header">
              <span className="modal-badge modal-badge--blue"><Save size={18} /></span>
              <div>
                <h3>Cập nhật trạng thái kho</h3>
                <p>Vật phẩm: <strong>{selectedItem.itemName}</strong></p>
              </div>
              <button type="button" className="close-btn" onClick={() => setUpdateModalOpen(false)}><X size={18} /></button>
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
                <button type="button" className="secondary-button" onClick={() => setUpdateModalOpen(false)}>Đóng</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {returnTargetItem && (
        <div className="custody-modal-overlay" onClick={() => setReturnTargetItem(null)}>
          <div
            className="custody-modal"
            style={{ maxWidth: "760px", width: "95%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="custody-modal__header" style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0" }}>
              <span className="modal-badge modal-badge--green"><UserCheck size={18} /></span>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>Xác nhận trả hàng cho chủ sở hữu</h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>Vật phẩm: <strong style={{ color: "#0f172a" }}>{returnTargetItem.itemName}</strong></p>
              </div>
              <button type="button" className="close-btn" onClick={() => setReturnTargetItem(null)}><X size={18} /></button>
            </div>

            <form className="admin-form modal-form" style={{ padding: "16px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "12px" }} onSubmit={submitReturn}>
              <div className="staff-alert staff-alert--info" style={{ padding: "8px 12px", fontSize: "0.78rem", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Info size={15} style={{ flexShrink: 0 }} />
                <span>Người nhận có thể không có tài khoản hoặc không có claim trên hệ thống. Vui lòng kiểm tra giấy tờ tùy thân trước khi xác nhận; thông tin sẽ được lưu trong hồ sơ bàn giao riêng tư.</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label className="input-field" style={{ margin: 0 }}>
                  <span>Họ và tên người nhận <strong className="required-star">*</strong></span>
                  <input required value={returnForm.receiverName} onChange={(event) => setReturnForm({ ...returnForm, receiverName: event.target.value })} placeholder="Nhập họ và tên người nhận" />
                </label>
                <label className="input-field" style={{ margin: 0 }}>
                  <span>Số điện thoại <strong className="required-star">*</strong></span>
                  <input required type="tel" value={returnForm.receiverPhone} onChange={(event) => setReturnForm({ ...returnForm, receiverPhone: event.target.value })} placeholder="Nhập số điện thoại" />
                </label>
                <label className="input-field" style={{ margin: 0 }}>
                  <span>Mã thẻ SV / CMND / CCCD <strong className="required-star">*</strong></span>
                  <input required value={returnForm.receiverIdentity} onChange={(event) => setReturnForm({ ...returnForm, receiverIdentity: event.target.value })} placeholder="Nhập mã số giấy tờ" />
                </label>
              </div>
              {returnRecipients.length > 0 && (
                <label className="input-field" style={{ margin: 0 }}>
                  <span>Liên kết claim trực tuyến (không bắt buộc)</span>
                  <select value={returnForm.claimId} onChange={(event) => {
                    const recipient = returnRecipients.find(value => value.claimId === event.target.value);
                    setReturnForm(prev => ({ ...prev, claimId: recipient?.claimId ?? "", recipientId: recipient?.recipientId ?? "", receiverName: recipient?.fullName ?? prev.receiverName }));
                  }}>
                    <option value="">Trả trực tiếp, không có claim</option>
                    {returnRecipients.map(recipient => <option key={recipient.claimId} value={recipient.claimId}>{recipient.fullName} · {recipient.claimId.slice(0, 8)}</option>)}
                  </select>
                </label>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label><input type="checkbox" required />Tôi đã đối chiếu người nhận và bằng chứng bàn giao</label>

                  <label className="input-field" style={{ margin: 0 }}>
                    <span style={{ fontSize: "0.8rem" }}>Ghi chú bàn giao</span>
                    <textarea value={returnForm.note} onChange={(event) => setReturnForm({ ...returnForm, note: event.target.value })} rows={2} style={{ padding: "6px 10px", fontSize: "0.82rem", resize: "none" }} placeholder="Ghi chú tình trạng lúc giao (nếu có)..." />
                  </label>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>Ảnh bằng chứng bàn giao <strong className="required-star">*</strong></span>

                  <label
                    style={{
                      border: "2px dashed #cbd5e1",
                      borderRadius: "8px",
                      padding: "14px 12px",
                      background: "#f8fafc",
                      textAlign: "center",
                      cursor: uploadingProof ? "not-allowed" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                      transition: "all 0.2s"
                    }}
                  >
                    <span style={{ color: "#2563eb", display: "flex", alignItems: "center" }}>
                      {uploadingProof ? <LoaderCircle className="spin-icon" size={22} /> : <ImagePlus size={22} />}
                    </span>
                    <strong style={{ fontSize: "0.82rem", color: "#1e293b" }}>
                      {uploadingProof ? "Đang lưu ảnh riêng tư..." : returnForm.proofImages.length ? "Thêm ảnh bằng chứng khác" : "Chọn ảnh bằng chứng"}
                    </strong>
                    <small style={{ fontSize: "0.72rem", color: "#64748b" }}>
                      {returnForm.proofImages.length ? `${returnForm.proofImages.length} ảnh đã lưu riêng tư` : "JPEG, PNG, WEBP; tối đa 5 ảnh"}
                    </small>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={uploadingProof}
                      required={returnForm.proofImages.length === 0}
                      style={{ display: "none" }}
                      onChange={async (event) => {
                        const files = Array.from(event.target.files || []);
                        if (!files.length) return;
                        setUploadingProof(true);
                        try {
                          for (const file of files) {
                            const res = await api.uploadWarehouseProof(file, returnTargetItem.id);
                            setReturnForm((prev) => ({ ...prev, proofImages: [...prev.proofImages, res.id] }));
                          }
                        } catch (error) {
                          onError(messageOf(error, "Không thể tải lên ảnh bằng chứng"));
                        } finally {
                          setUploadingProof(false);
                          event.currentTarget.value = "";
                        }
                      }}
                    />
                  </label>

                  {returnForm.proofImages.length > 0 && (
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "6px", maxHeight: "190px", overflowY: "auto" }}>
                      {returnForm.proofImages.map((img, index) => (
                        <div
                          key={index}
                          style={{
                            position: "relative",
                            width: "88px",
                            height: "88px",
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
                              padding: "1px 0",
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
                            }}
                            style={{
                              position: "absolute",
                              top: "3px",
                              right: "3px",
                              width: "20px",
                              height: "20px",
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
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="custody-modal-actions" style={{ marginTop: "4px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                <button className="primary-button" disabled={pendingAction === "update" || uploadingProof}>
                  {pendingAction === "update" ? <LoaderCircle className="spin-icon" size={17} /> : <CheckCircle2 size={17} />}
                  <span>Xác nhận Đã trả hàng</span>
                </button>
                <button type="button" className="secondary-button" onClick={() => setReturnTargetItem(null)}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewImageUrl && (
        <div className="custody-modal-overlay" onClick={() => setPreviewImageUrl(null)} style={{ zIndex: 9999, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
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
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────── Main Staff Page ─────────────── */

export function StaffPage() {
  const warehouseQuery = useRef({ ...emptyFilters, page: 1 });
  const custodyQuery = useRef({ status: "ALL", page: 1 });
  const custodyLoadSequence = useRef(0);
  const warehouseLoadSequence = useRef(0);
  const [activeTab, setActiveTab] = useState<StaffTab>("custody");
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
    const result = await api.listWarehouseItems({ q: q.q || undefined, status: q.status ? q.status as WarehouseStatus : undefined, handoverPointId: q.handoverPointId || undefined, page: q.page, pageSize: 12 });
    if (sequence === warehouseLoadSequence.current) setDashboard(result);
  }

  async function loadCustody() {
    const sequence = ++custodyLoadSequence.current;
    const q = { ...custodyQuery.current };
    const result = await api.listCustodyRequests({ status: q.status !== "ALL" ? q.status as CustodyRequestStatus : undefined, page: q.page, pageSize: 20 });
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

  async function refreshCustody(status?: string, page?: number) {
    if (status !== undefined) custodyQuery.current.status = status;
    if (page !== undefined) custodyQuery.current.page = page;
    try {
      await Promise.all([loadCustody(), loadDashboard()]);
    } catch (reason) {
      setError(messageOf(reason, "Không thể làm mới hàng đợi custody"));
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
    { key: "custody", label: "Hàng đợi Custody", icon: <ShieldCheck size={18} />, badge: custodyData?.counts.PENDING },
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
          <h1>Tiếp nhận & Quản lý Custody</h1>
          <p className="hero-subtitle">
            Hàng đợi tiếp nhận tài sản từ người nhặt, quản lý lưu trữ kho và bàn giao tài sản tại campus.
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
