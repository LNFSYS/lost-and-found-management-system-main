import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Ban,
  CheckCircle2,
  Clock3,
  FileCheck,
  FileText,
  History,
  Inbox,
  LoaderCircle,
  Lock,
  MapPin,
  PackageCheck,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  XCircle
} from "lucide-react";
import {
  api,
  type CreateWarehouseItemPayload,
  type CustodyReason,
  type CustodyRequest,
  type CustodyRequestLog,
  type CustodyRequestStatus,
  type DispositionOrder,
  type DispositionOrderStatus,
  type DispositionType,
  type LegalHold,
  type OverdueWarehouseItem,
  type WarehouseCatalog,
  type WarehouseDashboard,
  type WarehouseItem,
  type WarehouseStatus,
  type WarehouseStorageLog
} from "../services/api.js";

type StaffTab = "inventory" | "custody" | "overdue" | "disposition";
type PendingAction = "" | "load" | "create" | "update" | "logs" | "custody" | "hold" | "order" | "execute";

const statusOptions: Array<{ value: WarehouseStatus; label: string }> = [
  { value: "RECEIVED", label: "Đã tiếp nhận" },
  { value: "STORED", label: "Đang lưu kho" },
  { value: "CLAIMED", label: "Đang đợi nhận" },
  { value: "RETURNED", label: "Đã trả" },
  { value: "EXPIRED", label: "Quá hạn" },
  { value: "DISPOSED", label: "Đã tiêu hủy" },
  { value: "DONATED", label: "Đã quyên góp" },
  { value: "TRANSFERRED", label: "Đã chuyển giao" }
];

const custodyReasonLabels: Record<CustodyReason, string> = {
  INACTIVITY: "Không hoạt động quá lâu",
  SAFETY_CONCERN: "Có vấn đề an toàn / nghi ngờ",
  DISPUTE: "Có tranh chấp giữa các bên",
  SENSITIVE_ITEM: "Đồ vật giá trị cao / nhạy cảm",
  VOLUNTARY: "Finder tự nguyện chuyển giao"
};

const custodyStatusLabels: Record<CustodyRequestStatus, string> = {
  PENDING: "Chờ duyệt tiếp nhận",
  ACCEPTED: "Đã đồng ý - Chờ mang đồ tới",
  REJECTED: "Từ chối tiếp nhận",
  CANCELLED: "Đã hủy yêu cầu",
  INTAKED: "Đã nhập kho"
};

const custodyActionLabels: Record<string, string> = {
  REQUESTED: "Đã gửi yêu cầu",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
  INTAKED: "Đã nhập kho",
  COMMENTED: "Đã ghi chú"
};

const dispositionTypeLabels: Record<DispositionType, string> = {
  DISPOSAL: "Tiêu hủy vật phẩm",
  DONATION: "Quyên góp từ thiện",
  TRANSFER: "Chuyển giao cơ quan chức năng"
};

const dispositionOrderStatusLabels: Record<DispositionOrderStatus, string> = {
  PENDING_APPROVAL: "Chờ Admin duyệt",
  APPROVED: "Đã duyệt - Chờ xử lý",
  REJECTED: "Admin từ chối",
  CANCELLED: "Đã hủy lệnh",
  COMPLETED: "Đã hoàn tất xử lý"
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
  if (status === "STORED" || status === "CLAIMED") return "RETURNED";
  return status;
}

function isOverdue(item: WarehouseItem) {
  return Boolean(
    item.retentionDeadline &&
      new Date(item.retentionDeadline).getTime() < Date.now() &&
      !["RETURNED", "DISPOSED", "DONATED", "TRANSFERRED"].includes(item.status)
  );
}

function StatCard({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <article className="admin-stat warehouse-stat">
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </article>
  );
}

export function StaffPage() {
  const [activeTab, setActiveTab] = useState<StaffTab>("inventory");
  const [catalog, setCatalog] = useState<WarehouseCatalog | null>(null);
  const [dashboard, setDashboard] = useState<WarehouseDashboard | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [logs, setLogs] = useState<WarehouseStorageLog[]>([]);
  const [updateForm, setUpdateForm] = useState<{ status: WarehouseStatus; conditionNotes: string; storageCode: string; note: string }>({
    status: "STORED",
    conditionNotes: "",
    storageCode: "",
    note: ""
  });

  // Custody Queue state
  const [custodyRequests, setCustodyRequests] = useState<CustodyRequest[]>([]);
  const [custodyLogs, setCustodyLogs] = useState<CustodyRequestLog[]>([]);
  const [expandedCustodyRows, setExpandedCustodyRows] = useState<string[]>([]);
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);
  const [intakeTargetRequest, setIntakeTargetRequest] = useState<CustodyRequest | null>(null);
  const [intakeForm, setIntakeForm] = useState({
    conditionNotes: "Tốt",
    storageCode: "",
    handoverPointId: "",
    areaId: "",
    buildingId: "",
    roomText: ""
  });
  const [rejectReason, setRejectReason] = useState("");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  // Overdue & Legal Hold state
  const [overdueItems, setOverdueItems] = useState<OverdueWarehouseItem[]>([]);
  const [legalHoldModalOpen, setLegalHoldModalOpen] = useState(false);
  const [legalHoldTargetItem, setLegalHoldTargetItem] = useState<WarehouseItem | null>(null);
  const [legalHoldReason, setLegalHoldReason] = useState("");

  // Disposition Orders state
  const [dispositionOrders, setDispositionOrders] = useState<DispositionOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<DispositionOrder | null>(null);
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false);
  const [createOrderForm, setCreateOrderForm] = useState<{
    dispositionType: DispositionType;
    reason: string;
    selectedItemIds: string[];
  }>({
    dispositionType: "DISPOSAL",
    reason: "",
    selectedItemIds: []
  });
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [executeOrder, setExecuteOrder] = useState<DispositionOrder | null>(null);
  const [executeForm, setExecuteForm] = useState({
    selectedItemIds: [] as string[],
    evidenceUrl: "",
    evidenceKind: "PHOTO" as "PHOTO" | "DOCUMENT" | "CERTIFICATE",
    notes: ""
  });

  const [pendingAction, setPendingAction] = useState<PendingAction>("load");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedItem = useMemo(
    () => dashboard?.items.find((item) => item.id === selectedItemId) ?? null,
    [dashboard, selectedItemId]
  );
  const leafCategories = useMemo(() => catalog?.categories.filter((item) => item.parentId) ?? [], [catalog]);
  const availableBuildings = useMemo(
    () => catalog?.buildings.filter((item) => !createForm.areaId || item.areaId === createForm.areaId) ?? [],
    [catalog, createForm.areaId]
  );

  async function loadCatalog() {
    const value = await api.getWarehouseCatalog();
    setCatalog(value);
    setCreateForm((current) => ({
      ...current,
      handoverPointId: current.handoverPointId || value.handoverPoints[0]?.id || ""
    }));
  }

  async function loadDashboard(nextFilters = filters) {
    setDashboard(
      await api.listWarehouseItems({
        q: nextFilters.q || undefined,
        status: nextFilters.status as WarehouseStatus | "",
        handoverPointId: nextFilters.handoverPointId || undefined,
        page: 1,
        pageSize: 20
      })
    );
  }

  async function submitFilters(event: FormEvent) {
    event.preventDefault();
    setPendingAction("load");
    setError("");
    try { await loadDashboard(filters); }
    catch (reason) { setError(messageOf(reason, "Không thể lọc danh sách kho")); }
    finally { setPendingAction(""); }
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    setPendingAction("create");
    setError("");
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
        storageCode: clean(createForm.storageCode),
        receivedAt: createForm.receivedAt ? new Date(createForm.receivedAt).toISOString() : undefined
      };
      const created = await api.createWarehouseItem(payload);
      setDashboard((current) => current ? { ...current, total: current.total + 1, items: [created, ...current.items] } : current);
      setSelectedItemId(created.id);
      setCreateForm({ ...emptyCreateForm, handoverPointId: createForm.handoverPointId });
      setNotice("Đã tiếp nhận vật phẩm");
    } catch (reason) { setError(messageOf(reason, "Không thể tiếp nhận vật phẩm")); }
    finally { setPendingAction(""); }
  }

  async function loadLogs(itemId: string) {
    setPendingAction("logs");
    setError("");
    try { setLogs(await api.getWarehouseLogs(itemId)); }
    catch (reason) { setError(messageOf(reason, "Không thể tải nhật ký kho")); }
    finally { setPendingAction(""); }
  }

  function selectItem(item: WarehouseItem) {
    setSelectedItemId(item.id);
    setUpdateForm({ status: nextStatus(item.status), conditionNotes: item.conditionNotes ?? "", storageCode: item.storageCode ?? "", note: "" });
    void loadLogs(item.id);
  }

  async function submitUpdate(event: FormEvent) {
    event.preventDefault();
    if (!selectedItem) return;
    setPendingAction("update");
    setError("");
    try {
      const updated = await api.updateWarehouseItem(selectedItem.id, {
        status: updateForm.status,
        conditionNotes: clean(updateForm.conditionNotes),
        storageCode: clean(updateForm.storageCode),
        note: clean(updateForm.note)
      });
      setDashboard((current) => current ? { ...current, items: current.items.map((item) => item.id === updated.id ? updated : item) } : current);
      setUpdateForm({ status: nextStatus(updated.status), conditionNotes: updated.conditionNotes ?? "", storageCode: updated.storageCode ?? "", note: "" });
      setLogs(await api.getWarehouseLogs(updated.id));
      setNotice("Đã cập nhật trạng thái kho");
    } catch (reason) { setError(messageOf(reason, "Không thể cập nhật trạng thái kho")); }
    finally { setPendingAction(""); }
  }

  async function loadCustodyQueue() {
    const res = await api.listStaffCustodyRequests({ page: 1, pageSize: 30 });
    setCustodyRequests(res.items);
  }

  async function loadOverdueList() {
    const res = await api.listOverdueWarehouseItems({ page: 1, pageSize: 30 });
    setOverdueItems(res.items);
  }

  async function loadDispositionOrders() {
    const res = await api.listDispositionOrders({ page: 1, pageSize: 30 });
    setDispositionOrders(res.items);
  }

  async function loadInitial() {
    setPendingAction("load");
    setError("");
    try {
      await Promise.all([loadCatalog(), loadDashboard(), loadCustodyQueue(), loadOverdueList(), loadDispositionOrders()]);
    } catch (reason) {
      setError(messageOf(reason, "Không thể tải dữ liệu kho"));
    } finally {
      setPendingAction("");
    }
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  // Custody actions
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [acceptTargetRequest, setAcceptTargetRequest] = useState<CustodyRequest | null>(null);
  const [acceptForm, setAcceptForm] = useState({
    confirmedHandoverPointId: "",
    proposedTime: "",
    notes: ""
  });

  async function handleAcceptCustody(req: CustodyRequest) {
    if (!catalog?.handoverPoints[0]?.id) return;
    setAcceptTargetRequest(req);
    setAcceptForm({
      confirmedHandoverPointId: req.proposedHandoverPointId || catalog.handoverPoints[0].id,
      proposedTime: "",
      notes: "Staff đã duyệt tiếp nhận"
    });
    setAcceptModalOpen(true);
  }

  async function handleConfirmAccept(e: FormEvent) {
    e.preventDefault();
    if (!acceptTargetRequest) return;
    setPendingAction("custody");
    setError("");
    try {
      await api.acceptCustodyRequest(acceptTargetRequest.id, {
        confirmedHandoverPointId: acceptForm.confirmedHandoverPointId,
        notes: acceptForm.notes
      });
      setNotice("Đã chấp nhận yêu cầu custody thành công");
      setAcceptModalOpen(false);
      setAcceptTargetRequest(null);
      await loadCustodyQueue();
    } catch (reason) {
      setError(messageOf(reason, "Không thể duyệt yêu cầu custody"));
    } finally {
      setPendingAction("");
    }
  }

  async function handleRejectCustody() {
    if (!rejectTargetId || !rejectReason.trim()) return;
    setPendingAction("custody");
    setError("");
    try {
      await api.rejectCustodyRequest(rejectTargetId, rejectReason);
      setNotice("Đã từ chối yêu cầu custody");
      setRejectModalOpen(false);
      setRejectReason("");
      setRejectTargetId(null);
      await loadCustodyQueue();
    } catch (reason) {
      setError(messageOf(reason, "Không thể từ chối yêu cầu custody"));
    } finally {
      setPendingAction("");
    }
  }

  async function handleConfirmIntake(e: FormEvent) {
    e.preventDefault();
    if (!intakeTargetRequest) return;
    setPendingAction("custody");
    setError("");
    try {
      const createdItem = await api.confirmStaffIntake(intakeTargetRequest.id, {
        conditionNotes: intakeForm.conditionNotes,
        storageCode: intakeForm.storageCode || null,
        handoverPointId: intakeForm.handoverPointId || intakeTargetRequest.confirmedHandoverPointId || catalog?.handoverPoints[0]?.id || "",
        areaId: intakeForm.areaId || null,
        buildingId: intakeForm.buildingId || null,
        roomText: intakeForm.roomText || null,
        idempotencyKey: `intake-${intakeTargetRequest.id}`
      });
      setNotice(`Đã tiếp nhận và tạo bản ghi kho thành công: ${createdItem.itemName}`);
      setIntakeModalOpen(false);
      setIntakeTargetRequest(null);
      await Promise.all([loadCustodyQueue(), loadDashboard(), loadOverdueList()]);
    } catch (reason) {
      setError(messageOf(reason, "Không thể tiếp nhận vật phẩm"));
    } finally {
      setPendingAction("");
    }
  }

  // Legal Hold actions
  async function handleApplyLegalHold(e: FormEvent) {
    e.preventDefault();
    if (!legalHoldTargetItem || !legalHoldReason.trim()) return;
    setPendingAction("hold");
    setError("");
    try {
      await api.applyLegalHold(legalHoldTargetItem.id, legalHoldReason);
      setNotice(`Đã áp dụng lệnh Legal Hold cho ${legalHoldTargetItem.itemName}`);
      setLegalHoldModalOpen(false);
      setLegalHoldReason("");
      setLegalHoldTargetItem(null);
      await Promise.all([loadDashboard(), loadOverdueList()]);
    } catch (reason) {
      setError(messageOf(reason, "Không thể áp dụng Legal Hold"));
    } finally {
      setPendingAction("");
    }
  }

  // Disposition Orders actions
  async function handleCreateDispositionOrder(e: FormEvent) {
    e.preventDefault();
    if (createOrderForm.selectedItemIds.length === 0 || !createOrderForm.reason.trim()) return;
    setPendingAction("order");
    setError("");
    try {
      const order = await api.createDispositionOrder({
        dispositionType: createOrderForm.dispositionType,
        reason: createOrderForm.reason,
        warehouseItemIds: createOrderForm.selectedItemIds
      });
      setNotice(`Đã tạo lệnh xử lý kho ${order.orderNumber} (Chờ Admin duyệt)`);
      setCreateOrderModalOpen(false);
      setCreateOrderForm({ dispositionType: "DISPOSAL", reason: "", selectedItemIds: [] });
      await Promise.all([loadDispositionOrders(), loadOverdueList()]);
    } catch (reason) {
      setError(messageOf(reason, "Không thể tạo lệnh xử lý kho"));
    } finally {
      setPendingAction("");
    }
  }

  async function handleApproveOrder(orderId: string) {
    setPendingAction("order");
    setError("");
    try {
      await api.approveDispositionOrder(orderId);
      setNotice("Admin đã phê duyệt lệnh xử lý");
      await loadDispositionOrders();
      if (selectedOrderId === orderId) {
        setSelectedOrderDetail(await api.getDispositionOrderDetail(orderId));
      }
    } catch (reason) {
      setError(messageOf(reason, "Không thể phê duyệt lệnh"));
    } finally {
      setPendingAction("");
    }
  }

  async function handleExecuteDisposition(e: FormEvent) {
    e.preventDefault();
    if (!executeOrder || executeForm.selectedItemIds.length === 0) return;
    setPendingAction("execute");
    setError("");
    try {
      await api.executeDisposition(executeOrder.id, {
        processedItemIds: executeForm.selectedItemIds,
        evidenceUrls: executeForm.evidenceUrl
          ? [{ fileUrl: executeForm.evidenceUrl, fileKind: executeForm.evidenceKind, description: "Biên bản xử lý" }]
          : [],
        notes: executeForm.notes
      });
      setNotice(`Đã thực hiện xử lý vật phẩm thành công`);
      setExecuteModalOpen(false);
      setExecuteOrder(null);
      await Promise.all([loadDispositionOrders(), loadDashboard(), loadOverdueList()]);
    } catch (reason) {
      setError(messageOf(reason, "Không thể thực hiện xử lý vật phẩm"));
    } finally {
      setPendingAction("");
    }
  }

  // View detail helper
  async function viewCustodyDetail(req: CustodyRequest) {
    const detail = await api.getCustodyRequestDetail(req.id);
    setCustodyLogs(detail.logs);
  }

  async function viewOrderDetail(order: DispositionOrder) {
    setSelectedOrderId(order.id);
    const detail = await api.getDispositionOrderDetail(order.id);
    setSelectedOrderDetail(detail);
  }

  return (
    <div className="admin-page warehouse-page">
      <header className="admin-header">
        <div>
          <h1>Kho nội bộ</h1>
          <p>Quy trình tiếp nhận có kiểm soát (Custody), theo dõi quá hạn (Retention) và lệnh tiêu hủy/quyên góp an toàn (Guarded Disposition).</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void loadInitial()}
          disabled={pendingAction !== ""}
        >
          {pendingAction === "load" ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
          Làm mới
        </button>
      </header>

      {notice && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} /> {notice}
        </div>
      )}
      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="admin-tabs">
        <button
          type="button"
          className={activeTab === "inventory" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setActiveTab("inventory")}
        >
          <Archive size={16} /> Kho lưu trữ ({dashboard?.total ?? 0})
        </button>
        <button
          type="button"
          className={activeTab === "custody" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setActiveTab("custody")}
        >
          <Inbox size={16} /> Hàng đợi Custody ({custodyRequests.filter((r) => r.status === "PENDING").length} chờ)
        </button>
        <button
          type="button"
          className={activeTab === "overdue" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setActiveTab("overdue")}
        >
          <AlertTriangle size={16} /> Theo dõi quá hạn ({overdueItems.length})
        </button>
        <button
          type="button"
          className={activeTab === "disposition" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setActiveTab("disposition")}
        >
          <FileCheck size={16} /> Lệnh xử lý kho ({dispositionOrders.length})
        </button>
      </div>

      {/* TAB 1: INVENTORY */}
      {activeTab === "inventory" && (
        <section className="warehouse-inventory-section">
          {dashboard && (
            <div className="admin-stats-grid">
              <StatCard icon={<Archive size={20} />} value={dashboard.stats.totalItems} label="Tổng trong kho" />
              <StatCard icon={<PackageCheck size={20} />} value={dashboard.stats.storedItems} label="Đang lưu kho" />
              <StatCard icon={<Clock3 size={20} />} value={dashboard.stats.overdueItems} label="Quá hạn retention" />
              <StatCard icon={<CheckCircle2 size={20} />} value={dashboard.stats.returnedItems} label="Đã trao trả" />
            </div>
          )}

          <div className="warehouse-layout">
            <aside className="admin-panel admin-panel--form warehouse-receive-panel">
              <div className="admin-panel-heading"><span><PackageCheck size={18} /></span><h2>Tiếp nhận vật phẩm</h2></div>
              <form className="admin-form" onSubmit={submitCreate}>
                <label className="input-field"><span>Điểm bàn giao</span><select required value={createForm.handoverPointId} onChange={(event) => setCreateForm({ ...createForm, handoverPointId: event.target.value })}>
                  <option value="">Chọn điểm bàn giao</option>
                  {catalog?.handoverPoints.map((point) => <option key={point.id} value={point.id}>{point.name} - {point.address}</option>)}
                </select></label>
                <label className="input-field"><span>Tên vật phẩm</span><input required value={createForm.itemName} onChange={(event) => setCreateForm({ ...createForm, itemName: event.target.value })} /></label>
                <label className="input-field"><span>Danh mục</span><select value={createForm.categoryId} onChange={(event) => setCreateForm({ ...createForm, categoryId: event.target.value })}>
                  <option value="">Chưa phân loại</option>
                  {leafCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select></label>
                <label className="input-field"><span>Mô tả</span><textarea rows={3} value={createForm.description} onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} /></label>
                <label className="input-field"><span>Tình trạng khi nhận</span><textarea required rows={3} value={createForm.conditionNotes} onChange={(event) => setCreateForm({ ...createForm, conditionNotes: event.target.value })} /></label>
                <div className="warehouse-form-pair">
                  <label className="input-field"><span>Khu vực</span><select value={createForm.areaId} onChange={(event) => setCreateForm({ ...createForm, areaId: event.target.value, buildingId: "" })}>
                    <option value="">Chưa rõ</option>{catalog?.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                  </select></label>
                  <label className="input-field"><span>Địa điểm</span><select value={createForm.buildingId} onChange={(event) => setCreateForm({ ...createForm, buildingId: event.target.value })}>
                    <option value="">Chưa rõ</option>{availableBuildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
                  </select></label>
                </div>
                <div className="warehouse-form-pair">
                  <label className="input-field"><span>Phòng/vị trí</span><input value={createForm.roomText} onChange={(event) => setCreateForm({ ...createForm, roomText: event.target.value })} /></label>
                  <label className="input-field"><span>Mã lưu kho</span><input value={createForm.storageCode} onChange={(event) => setCreateForm({ ...createForm, storageCode: event.target.value })} /></label>
                </div>
                <div className="warehouse-form-pair">
                  <label className="input-field"><span>Người giao</span><input value={createForm.finderName} onChange={(event) => setCreateForm({ ...createForm, finderName: event.target.value })} /></label>
                  <label className="input-field"><span>Liên hệ</span><input value={createForm.finderContact} onChange={(event) => setCreateForm({ ...createForm, finderContact: event.target.value })} /></label>
                </div>
                <label className="input-field"><span>Thời gian nhận</span><input type="datetime-local" value={createForm.receivedAt} onChange={(event) => setCreateForm({ ...createForm, receivedAt: event.target.value })} /></label>
                <button className="primary-button" disabled={pendingAction === "create"}><PackageCheck size={17} /> Tiếp nhận</button>
              </form>
            </aside>

            <div className="warehouse-main">
              <form className="warehouse-filter-bar" onSubmit={submitFilters}>
                <label className="input-field"><span>Tìm vật phẩm</span><input aria-label="Tìm vật phẩm trong kho" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} /></label>
                <label className="input-field"><span>Trạng thái</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                  <option value="">Tất cả</option>{statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select></label>
                <label className="input-field"><span>Điểm bàn giao</span><select value={filters.handoverPointId} onChange={(event) => setFilters({ ...filters, handoverPointId: event.target.value })}>
                  <option value="">Tất cả</option>{catalog?.handoverPoints.map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}
                </select></label>
                <button className="secondary-button"><Search size={17} /> Tìm</button>
              </form>
              <section className="warehouse-counts" aria-label="Số vật phẩm tại điểm bàn giao">
                {dashboard?.handoverCounts.map((point) => <article key={point.handoverPointId}>
                  <MapPin size={17} /><strong>{point.itemCount}</strong><span>{point.name}</span>
                  <small>{point.storedCount} đang lưu kho - {point.overdueCount} quá hạn</small>
                </article>)}
              </section>

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Vật phẩm</th>
                  <th>Điểm bàn giao</th>
                  <th>Vị trí lưu</th>
                  <th>Hạn lưu kho</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.itemName}</strong>
                      <div className="item-subtitle">{item.category?.name ?? "Chưa phân loại"}</div>
                    </td>
                    <td>{item.handoverPoint?.name ?? "—"}</td>
                    <td><code>{item.storageCode ?? "Chưa gán"}</code></td>
                    <td>
                      {formatDate(item.retentionDeadline)}
                      {isOverdue(item) && <span className="overdue-badge">[Quá hạn]</span>}
                    </td>
                    <td>
                      <span className={`status-badge status-${item.status.toLowerCase()}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td><button type="button" className="secondary-button warehouse-select-button" onClick={() => selectItem(item)}><History size={15} /> Chọn</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </div>

            <aside className="admin-panel warehouse-detail-panel">
              <div className="admin-panel-heading"><span><Save size={18} /></span><h2>Cập nhật và nhật ký</h2></div>
              {selectedItem ? <>
                <div className="warehouse-selected-summary">
                  <span className={`warehouse-status warehouse-status--${selectedItem.status.toLowerCase()}`}>{statusLabel(selectedItem.status)}</span>
                  <h3>{selectedItem.itemName}</h3>
                  <p>Hạn lưu giữ: {formatDate(selectedItem.retentionDeadline)} - Nhận lúc {formatDateTime(selectedItem.receivedAt)}</p>
                </div>
                <form className="admin-form" onSubmit={submitUpdate}>
                  <label className="input-field"><span>Trạng thái mới</span><select value={updateForm.status} onChange={(event) => setUpdateForm({ ...updateForm, status: event.target.value as WarehouseStatus })}>
                    {statusOptions.filter((status) => !["DISPOSED", "DONATED", "TRANSFERRED"].includes(status.value)).map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select></label>
                  <label className="input-field"><span>Mã lưu kho</span><input value={updateForm.storageCode} onChange={(event) => setUpdateForm({ ...updateForm, storageCode: event.target.value })} /></label>
                  <label className="input-field"><span>Tình trạng</span><textarea rows={3} value={updateForm.conditionNotes} onChange={(event) => setUpdateForm({ ...updateForm, conditionNotes: event.target.value })} /></label>
                  <label className="input-field"><span>Ghi chú nhật ký</span><textarea rows={2} value={updateForm.note} onChange={(event) => setUpdateForm({ ...updateForm, note: event.target.value })} /></label>
                  <button className="primary-button" disabled={pendingAction === "update"}><CheckCircle2 size={17} /> Lưu trạng thái</button>
                </form>
                <div className="warehouse-log-list">
                  <div className="admin-list-heading"><h2>Lịch sử</h2><strong>{logs.length}</strong></div>
                  {logs.map((log) => <article key={log.id}>
                    <strong>{statusLabel(log.fromStatus)} -&gt; {statusLabel(log.toStatus)}</strong>
                    <span>{log.actor.fullName ?? "Nhân viên"} - {formatDateTime(log.createdAt)}</span>
                    {(log.storageCode || log.conditionNotes || log.note) && <p>{[log.storageCode, log.conditionNotes, log.note].filter(Boolean).join(" | ")}</p>}
                  </article>)}
                </div>
              </> : <div className="warehouse-empty warehouse-empty--compact"><History size={38} /><strong>Chọn một vật phẩm để xem nhật ký</strong></div>}
            </aside>
          </div>
        </section>
      )}

      {/* TAB 2: CUSTODY QUEUE */}
      {activeTab === "custody" && (
        <section className="custody-queue-section">
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Vật phẩm & Finder</th>
                  <th>Lý do yêu cầu</th>
                  <th>Điểm đề xuất</th>
                  <th>Ngày gửi</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {custodyRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      Hiện không có yêu cầu custody nào.
                    </td>
                  </tr>
                ) : (
                  custodyRequests.map((req) => {
                    const isExpanded = expandedCustodyRows.includes(req.id);
                    return [
                      <tr key={req.id}>
                        <td>
                          <strong>{req.postTitle ?? "Vật phẩm"}</strong>
                          <div className="item-subtitle">
                            Finder: {req.finderName ?? req.finderId} | ĐT: {req.finderContact ?? "—"}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-info">{custodyReasonLabels[req.reason]}</span>
                          {req.reasonNotes && <div className="item-subtitle">{req.reasonNotes}</div>}
                        </td>
                        <td>{req.confirmedHandoverPointName ?? req.proposedHandoverPointName ?? "Chưa chỉ định"}</td>
                        <td>{formatDateTime(req.createdAt)}</td>
                        <td>
                          <span className={`status-badge status-${req.status.toLowerCase()}`}>
                            {custodyStatusLabels[req.status]}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            {req.status === "PENDING" && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() => void handleAcceptCustody(req)}
                                  title="Chấp nhận yêu cầu"
                                >
                                  <CheckCircle2 size={14} /> Duyệt
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger"
                                  onClick={() => {
                                    setRejectTargetId(req.id);
                                    setRejectModalOpen(true);
                                  }}
                                  title="Từ chối yêu cầu"
                                >
                                  <XCircle size={14} /> Từ chối
                                </button>
                              </>
                            )}
                            {req.status === "ACCEPTED" && (
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={() => {
                                  setIntakeTargetRequest(req);
                                  setIntakeForm({
                                    conditionNotes: "Tốt",
                                    storageCode: `WH-${Math.floor(100 + Math.random() * 900)}`,
                                    handoverPointId: req.confirmedHandoverPointId || req.proposedHandoverPointId || catalog?.handoverPoints[0]?.id || "",
                                    areaId: "",
                                    buildingId: "",
                                    roomText: ""
                                  });
                                  setIntakeModalOpen(true);
                                }}
                              >
                                <PackageCheck size={14} /> Nhận đồ thực tế
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                const currentExpanded = expandedCustodyRows.includes(req.id);
                                setExpandedCustodyRows(currentExpanded 
                                  ? expandedCustodyRows.filter(id => id !== req.id)
                                  : [...expandedCustodyRows, req.id]
                                );
                                if (!currentExpanded) {
                                  void viewCustodyDetail(req);
                                }
                              }}
                            >
                              <History size={14} /> Lịch sử
                            </button>
                          </div>
                        </td>
                      </tr>,
                      isExpanded ? (
                        <tr key={`${req.id}-history`}>
                          <td colSpan={6} className="custody-history-cell">
                            <div className="custody-history-content">
                              <h4>Lịch sử tiếp nhận chuyển giao (Chain of Custody) - Mã #{req.id.slice(0, 8)}</h4>
                              {custodyLogs.length === 0 ? (
                                <p>Chưa có lịch sử nào.</p>
                              ) : (
                                <div className="custody-log-list">
                                  {custodyLogs.map((log) => (
                                    <div key={log.id} className="custody-log-item">
                                      <span className="log-time">{formatDateTime(log.createdAt)}</span>: <span className="log-action">{custodyActionLabels[log.action] || log.action}</span> bởi <span className="log-actor">{log.actorName || log.actorId}</span> - <span className="log-notes">{log.notes}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null
                    ];
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: OVERDUE & RETENTION WATCH */}
      {activeTab === "overdue" && (
        <section className="overdue-section">
          <div>
            <p>Danh sách các vật phẩm đã quá thời hạn lưu kho theo chính sách trường. Cần kiểm tra Legal Hold và tạo lệnh xử lý (Disposition Order).</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const eligibleIds = overdueItems.filter((it) => it.isEligibleForDisposition).map((it) => it.id);
                setCreateOrderForm({
                  dispositionType: "DISPOSAL",
                  reason: "Vật phẩm quá hạn lưu giữ không có người nhận",
                  selectedItemIds: eligibleIds
                });
                setCreateOrderModalOpen(true);
              }}
            >
              <PlusCircle size={16} /> Tạo lệnh xử lý kho (Disposition Order)
            </button>
          </div>

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Vật phẩm</th>
                  <th>Vị trí kho</th>
                  <th>Hạn lưu kho</th>
                  <th>Số ngày quá hạn</th>
                  <th>Legal Hold</th>
                  <th>Đủ điều kiện xử lý?</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {overdueItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      Hiện không có vật phẩm nào quá hạn lưu kho.
                    </td>
                  </tr>
                ) : (
                  overdueItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.itemName}</strong>
                        <div className="item-subtitle">{item.category?.name}</div>
                      </td>
                      <td><code>{item.storageCode ?? "Chưa gán"}</code></td>
                      <td>{formatDate(item.retentionDeadline)}</td>
                      <td>
                        <strong className="overdue-days">{item.daysOverdue} ngày</strong>
                      </td>
                      <td>
                        {item.legalHoldCount > 0 ? (
                          <span className="badge badge-danger">
                            <Lock size={12} /> Bị giữ ({item.legalHoldCount})
                          </span>
                        ) : (
                          <span className="no-hold">Không</span>
                        )}
                      </td>
                      <td>
                        {item.isEligibleForDisposition ? (
                          <span className="eligible-yes">✓ Đủ điều kiện</span>
                        ) : (
                          <span className="eligible-no">
                            ✗ {item.blockers.join("; ")}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setLegalHoldTargetItem(item);
                            setLegalHoldModalOpen(true);
                          }}
                        >
                          <Lock size={14} /> Legal Hold
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: DISPOSITION ORDERS */}
      {activeTab === "disposition" && (
        <section className="disposition-orders-section">
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã lệnh</th>
                  <th>Loại xử lý</th>
                  <th>Lý do</th>
                  <th>Người tạo / Ngày</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {dispositionOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      Chưa có lệnh xử lý kho nào được tạo.
                    </td>
                  </tr>
                ) : (
                  dispositionOrders.map((ord) => (
                    <tr key={ord.id}>
                      <td><code>{ord.orderNumber}</code></td>
                      <td>
                        <span className="badge badge-info">{dispositionTypeLabels[ord.dispositionType]}</span>
                      </td>
                      <td>{ord.reason}</td>
                      <td>
                        {ord.createdBy.fullName}
                        <div className="item-subtitle">{formatDateTime(ord.createdAt)}</div>
                      </td>
                      <td>
                        <span className={`status-badge status-${ord.status.toLowerCase()}`}>
                          {dispositionOrderStatusLabels[ord.status]}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          {ord.status === "PENDING_APPROVAL" && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => void handleApproveOrder(ord.id)}
                            >
                              <ShieldCheck size={14} /> Duyệt lệnh (Admin)
                            </button>
                          )}
                          {ord.status === "APPROVED" && (
                            <button
                              type="button"
                              className="btn btn-sm btn-success"
                              onClick={async () => {
                                const detail = await api.getDispositionOrderDetail(ord.id);
                                setExecuteOrder(detail);
                                setExecuteForm({
                                  selectedItemIds: detail.items?.map((it) => it.warehouseItemId) ?? [],
                                  evidenceUrl: "",
                                  evidenceKind: "PHOTO",
                                  notes: ""
                                });
                                setExecuteModalOpen(true);
                              }}
                            >
                              <UploadCloud size={14} /> Thực hiện & Nộp chứng từ
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => void viewOrderDetail(ord)}
                          >
                            <FileText size={14} /> Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Order Detail View */}
          {selectedOrderDetail && (
            <div className="card order-detail">
              <h4>Chi tiết Lệnh xử lý: {selectedOrderDetail.orderNumber}</h4>
              <p><strong>Loại xử lý:</strong> {dispositionTypeLabels[selectedOrderDetail.dispositionType]} | <strong>Trạng thái:</strong> {dispositionOrderStatusLabels[selectedOrderDetail.status]}</p>
              <p><strong>Lý do:</strong> {selectedOrderDetail.reason}</p>
              <h5>Danh sách vật phẩm trong lệnh:</h5>
              <ul>
                {selectedOrderDetail.items?.map((item) => (
                  <li key={item.id}>
                    {item.itemName} (Mã kho: {item.storageCode ?? "Chưa rõ"}) - Trạng thái: <strong>{item.status}</strong>
                  </li>
                ))}
              </ul>
              {selectedOrderDetail.evidence && selectedOrderDetail.evidence.length > 0 && (
                <>
                  <h5>Bằng chứng & Tài liệu thực hiện:</h5>
                  <ul>
                    {selectedOrderDetail.evidence.map((ev) => (
                      <li key={ev.id}>
                        <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer">
                          [{ev.fileKind}] {ev.description || "Xem tài liệu"}
                        </a>{" "}
                        - Người nộp: {ev.uploadedBy.fullName}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedOrderDetail(null)}>
                Đóng
              </button>
            </div>
          )}
        </section>
      )}

      {/* MODAL: PHYSICAL INTAKE */}
      {intakeModalOpen && intakeTargetRequest && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <h3>Xác nhận tiếp nhận thực tế (Physical Intake)</h3>
            <p>Vật phẩm: <strong>{intakeTargetRequest.postTitle}</strong></p>
            <form onSubmit={handleConfirmIntake}>
              <div className="form-group">
                <label>Tình trạng vật phẩm nhận được (*):</label>
                <textarea
                  className="form-control"
                  rows={2}
                  required
                  value={intakeForm.conditionNotes}
                  onChange={(e) => setIntakeForm({ ...intakeForm, conditionNotes: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Mã vị trí lưu kho (Storage Code):</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ví dụ: WH-A-023"
                  value={intakeForm.storageCode}
                  onChange={(e) => setIntakeForm({ ...intakeForm, storageCode: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Điểm bàn giao / Kho:</label>
                <select
                  className="form-control"
                  value={intakeForm.handoverPointId}
                  onChange={(e) => setIntakeForm({ ...intakeForm, handoverPointId: e.target.value })}
                >
                  {catalog?.handoverPoints.map((hp) => (
                    <option key={hp.id} value={hp.id}>{hp.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIntakeModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={pendingAction !== ""}>
                  {pendingAction === "custody" ? <LoaderCircle className="spin" size={16} /> : <PackageCheck size={16} />}
                  Xác nhận nhập kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REJECT CUSTODY */}
      {rejectModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <h3>Từ chối yêu cầu chuyển giao Custody</h3>
            <div className="form-group">
              <label>Lý do từ chối (*):</label>
              <textarea
                className="form-control"
                rows={3}
                required
                placeholder="Nhập lý do từ chối..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setRejectModalOpen(false)}>
                Hủy
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void handleRejectCustody()} disabled={pendingAction !== ""}>
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ACCEPT CUSTODY */}
      {acceptModalOpen && acceptTargetRequest && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <h3>Duyệt yêu cầu chuyển giao Custody</h3>
            <p>Vật phẩm: <strong>{acceptTargetRequest.postTitle ?? "Vật phẩm"}</strong></p>
            <p>Finder: <strong>{acceptTargetRequest.finderName ?? acceptTargetRequest.finderId}</strong></p>
            <form onSubmit={handleConfirmAccept}>
              <div className="form-group">
                <label>Điểm bàn giao (*):</label>
                <select
                  className="form-control"
                  required
                  value={acceptForm.confirmedHandoverPointId}
                  onChange={(e) => setAcceptForm({ ...acceptForm, confirmedHandoverPointId: e.target.value })}
                >
                  {catalog?.handoverPoints.map((hp) => (
                    <option key={hp.id} value={hp.id}>{hp.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Thời gian gửi đề xuất:</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={acceptForm.proposedTime}
                  onChange={(e) => setAcceptForm({ ...acceptForm, proposedTime: e.target.value })}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <small style={{ color: "#666", fontSize: "0.85rem" }}>Để trống nếu có thể giao ngay</small>
              </div>
              <div className="form-group">
                <label>Ghi chú:</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Ghi chú thêm..."
                  value={acceptForm.notes}
                  onChange={(e) => setAcceptForm({ ...acceptForm, notes: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setAcceptModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={pendingAction !== ""}>
                  {pendingAction === "custody" ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}
                  Xác nhận duyệt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LEGAL HOLD */}
      {legalHoldModalOpen && legalHoldTargetItem && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <h3>Áp dụng lệnh Tạm giữ pháp lý (Legal Hold)</h3>
            <p>Vật phẩm: <strong>{legalHoldTargetItem.itemName}</strong></p>
            <p className="warning-text">Khi Legal Hold được kích hoạt, vật phẩm sẽ bị khóa cứng và không thể tiêu hủy hay quyên góp cho đến khi có lệnh gỡ.</p>
            <form onSubmit={handleApplyLegalHold}>
              <div className="form-group">
                <label>Lý do tạm giữ (*):</label>
                <textarea
                  className="form-control"
                  rows={3}
                  required
                  placeholder="Ví dụ: Đang có tranh chấp quyền sở hữu hoặc yêu cầu từ công an trường..."
                  value={legalHoldReason}
                  onChange={(e) => setLegalHoldReason(e.target.value)}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setLegalHoldModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-danger" disabled={pendingAction !== ""}>
                  <Lock size={16} /> Áp dụng Legal Hold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE DISPOSITION ORDER */}
      {createOrderModalOpen && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content card" style={{ maxWidth: "600px", width: "100%", padding: "1.5rem" }}>
            <h3>Tạo Lệnh xử lý kho (Disposition Order)</h3>
            <form onSubmit={handleCreateDispositionOrder}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Loại hình xử lý (*):</label>
                <select
                  className="form-control"
                  value={createOrderForm.dispositionType}
                  onChange={(e) => setCreateOrderForm({ ...createOrderForm, dispositionType: e.target.value as DispositionType })}
                >
                  <option value="DISPOSAL">Tiêu hủy vật phẩm (Disposal)</option>
                  <option value="DONATION">Quyên góp từ thiện (Donation)</option>
                  <option value="TRANSFER">Chuyển giao cơ quan chức năng (Transfer)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Lý do tạo lệnh (*):</label>
                <textarea
                  className="form-control"
                  rows={2}
                  required
                  value={createOrderForm.reason}
                  onChange={(e) => setCreateOrderForm({ ...createOrderForm, reason: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Số lượng vật phẩm đã chọn: <strong>{createOrderForm.selectedItemIds.length}</strong> vật phẩm</label>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCreateOrderModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={pendingAction !== ""}>
                  <PlusCircle size={16} /> Tạo lệnh xử lý
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXECUTE DISPOSITION & EVIDENCE */}
      {executeModalOpen && executeOrder && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content card" style={{ maxWidth: "600px", width: "100%", padding: "1.5rem" }}>
            <h3>Thực hiện lệnh xử lý & Nộp chứng từ</h3>
            <p>Lệnh: <strong>{executeOrder.orderNumber}</strong> ({dispositionTypeLabels[executeOrder.dispositionType]})</p>
            <form onSubmit={handleExecuteDisposition}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Đường dẫn tài liệu / Ảnh bằng chứng (Evidence URL):</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://... ảnh tiêu hủy hoặc biên bản bàn giao"
                  value={executeForm.evidenceUrl}
                  onChange={(e) => setExecuteForm({ ...executeForm, evidenceUrl: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Loại chứng từ:</label>
                <select
                  className="form-control"
                  value={executeForm.evidenceKind}
                  onChange={(e) => setExecuteForm({ ...executeForm, evidenceKind: e.target.value as "PHOTO" | "DOCUMENT" | "CERTIFICATE" })}
                >
                  <option value="PHOTO">Ảnh chụp thực tế (Photo)</option>
                  <option value="DOCUMENT">Biên bản bàn giao (Document)</option>
                  <option value="CERTIFICATE">Chứng nhận tiêu hủy / Quyên góp (Certificate)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Ghi chú thực hiện:</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Ghi chú chi tiết quá trình xử lý..."
                  value={executeForm.notes}
                  onChange={(e) => setExecuteForm({ ...executeForm, notes: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setExecuteModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-success" disabled={pendingAction !== ""}>
                  <UploadCloud size={16} /> Hoàn tất xử lý
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
