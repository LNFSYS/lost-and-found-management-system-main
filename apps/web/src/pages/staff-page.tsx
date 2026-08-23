import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Archive,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  History,
  LoaderCircle,
  MapPin,
  PackageCheck,
  RefreshCw,
  Save,
  Search
} from "lucide-react";
import {
  api,
  type CreateWarehouseItemPayload,
  type WarehouseCatalog,
  type WarehouseDashboard,
  type WarehouseItem,
  type WarehouseStatus,
  type WarehouseStorageLog
} from "../services/api";

type PendingAction = "" | "load" | "create" | "update" | "logs";

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
  if (status === "EXPIRED") return "DISPOSED";
  return status;
}

function isOverdue(item: WarehouseItem) {
  return Boolean(item.retentionDeadline && new Date(item.retentionDeadline).getTime() < Date.now() && !["RETURNED", "DISPOSED", "DONATED", "TRANSFERRED"].includes(item.status));
}

function isActiveWarehouseItem(item: WarehouseItem) {
  return ["PENDING_APPROVAL", "RECEIVED", "STORED", "CLAIMED", "EXPIRED"].includes(item.status);
}

function StatCard({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return <article className="admin-stat warehouse-stat">
    <span>{icon}</span>
    <strong>{value}</strong>
    <small>{label}</small>
  </article>;
}

function ItemMeta({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

export function StaffPage() {
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
    setDashboard(await api.listWarehouseItems({
      q: nextFilters.q || undefined,
      status: nextFilters.status as WarehouseStatus | "",
      handoverPointId: nextFilters.handoverPointId || undefined,
      page: 1,
      pageSize: 12
    }));
  }

  function upsertDashboardItem(item: WarehouseItem, previous?: WarehouseItem | null) {
    setDashboard((current) => {
      if (!current) return current;
      const existing = previous ?? current.items.find((value) => value.id === item.id) ?? null;
      const existed = current.items.some((value) => value.id === item.id);
      const items = existed
        ? current.items.map((value) => value.id === item.id ? item : value)
        : [item, ...current.items].slice(0, current.pageSize);
      const receivedDelta = (item.status === "RECEIVED" ? 1 : 0) - (existing?.status === "RECEIVED" ? 1 : 0);
      const storedDelta = (item.status === "STORED" ? 1 : 0) - (existing?.status === "STORED" ? 1 : 0);
      const returnedDelta = (item.status === "RETURNED" ? 1 : 0) - (existing?.status === "RETURNED" ? 1 : 0);
      const activeDelta = (isActiveWarehouseItem(item) ? 1 : 0) - (existing && isActiveWarehouseItem(existing) ? 1 : 0);
      return {
        ...current,
        total: current.total + (existed ? 0 : 1),
        stats: {
          ...current.stats,
          totalItems: current.stats.totalItems + (existed ? 0 : 1),
          activeItems: Math.max(0, current.stats.activeItems + activeDelta),
          receivedItems: Math.max(0, current.stats.receivedItems + receivedDelta),
          storedItems: Math.max(0, current.stats.storedItems + storedDelta),
          returnedItems: Math.max(0, current.stats.returnedItems + returnedDelta)
        },
        handoverCounts: current.handoverCounts.map((point) => {
          if (existed || point.handoverPointId !== item.handoverPoint?.id) return point;
          return {
            ...point,
            itemCount: point.itemCount + (isActiveWarehouseItem(item) ? 1 : 0),
            storedCount: point.storedCount + (item.status === "STORED" ? 1 : 0),
            overdueCount: point.overdueCount + (isOverdue(item) ? 1 : 0)
          };
        }),
        items
      };
    });
  }

  async function loadInitial() {
    setPendingAction("load");
    setError("");
    try {
      await Promise.all([loadCatalog(), loadDashboard()]);
    } catch (reason) {
      setError(messageOf(reason, "Không thể tải dữ liệu kho"));
    } finally {
      setPendingAction("");
    }
  }

  useEffect(() => { void loadInitial(); }, []);

  async function refresh(silent = false) {
    if (!silent) setPendingAction("load");
    setError("");
    try {
      await loadDashboard();
    } catch (reason) {
      setError(messageOf(reason, "Không thể làm mới dữ liệu kho"));
    } finally {
      if (!silent) setPendingAction("");
    }
  }

  async function submitFilters(event: FormEvent) {
    event.preventDefault();
    setPendingAction("load");
    setError("");
    try {
      await loadDashboard(filters);
    } catch (reason) {
      setError(messageOf(reason, "Không thể lọc danh sách kho"));
    } finally {
      setPendingAction("");
    }
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    setPendingAction("create");
    setError("");
    setNotice("");
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
      upsertDashboardItem(created);
      setNotice("Đã tiếp nhận vật phẩm");
      setCreateForm({ ...emptyCreateForm, handoverPointId: createForm.handoverPointId });
      setSelectedItemId(created.id);
      setLogs([]);
      setUpdateForm({
        status: nextStatus(created.status),
        conditionNotes: created.conditionNotes ?? "",
        storageCode: created.storageCode ?? "",
        note: ""
      });
    } catch (reason) {
      setError(messageOf(reason, "Không thể tiếp nhận vật phẩm"));
    } finally {
      setPendingAction("");
    }
  }

  async function loadLogs(itemId: string, silent = false) {
    if (!silent) setPendingAction("logs");
    setError("");
    try {
      setLogs(await api.getWarehouseLogs(itemId));
    } catch (reason) {
      setError(messageOf(reason, "Không thể tải nhật ký kho"));
    } finally {
      if (!silent) setPendingAction("");
    }
  }

  function selectItem(item: WarehouseItem) {
    setSelectedItemId(item.id);
    setUpdateForm({
      status: nextStatus(item.status),
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
    setError("");
    setNotice("");
    try {
      const updated = await api.updateWarehouseItem(selectedItem.id, {
        status: updateForm.status,
        conditionNotes: clean(updateForm.conditionNotes),
        storageCode: clean(updateForm.storageCode),
        note: clean(updateForm.note)
      });
      upsertDashboardItem(updated, selectedItem);
      setNotice("Đã cập nhật trạng thái kho");
      setUpdateForm({
        status: nextStatus(updated.status),
        conditionNotes: updated.conditionNotes ?? "",
        storageCode: updated.storageCode ?? "",
        note: ""
      });
      await loadLogs(updated.id, true).catch(() => undefined);
    } catch (reason) {
      setError(messageOf(reason, "Không thể cập nhật trạng thái kho"));
    } finally {
      setPendingAction("");
    }
  }

  if (pendingAction === "load" && !dashboard) return <main className="center-state"><LoaderCircle className="spin-icon" /> Đang tải khu vực kho...</main>;

  return <section className="warehouse-page">
    <header className="admin-hero warehouse-hero">
      <div>
        <p className="eyebrow">KHO NHÂN VIÊN</p>
        <h1>Kho nội bộ</h1>
      </div>
      <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={pendingAction === "load"}><RefreshCw size={17} /> Làm mới</button>
    </header>

    <div className="admin-stats warehouse-stats" aria-label="Thống kê kho">
      <StatCard icon={<Archive size={20} />} value={dashboard?.stats.activeItems ?? 0} label="Đang giữ" />
      <StatCard icon={<ClipboardCheck size={20} />} value={dashboard?.stats.receivedItems ?? 0} label="Mới tiếp nhận" />
      <StatCard icon={<PackageCheck size={20} />} value={dashboard?.stats.storedItems ?? 0} label="Đang lưu kho" />
      <StatCard icon={<Clock3 size={20} />} value={dashboard?.stats.overdueItems ?? 0} label="Quá hạn" />
    </div>

    {notice && <p className="form-note admin-message">{notice}</p>}
    {error && <p className="form-error admin-message" role="alert">{error}</p>}

    <div className="warehouse-layout">
      <aside className="admin-panel admin-panel--form warehouse-receive-panel">
        <div className="admin-panel-heading">
          <span><ClipboardCheck size={18} /></span>
          <div><p className="eyebrow">TIẾP NHẬN</p><h2>Tiếp nhận vật phẩm</h2></div>
        </div>
        <form className="admin-form" onSubmit={submitCreate}>
          <label className="input-field"><span>Điểm bàn giao</span><select value={createForm.handoverPointId} onChange={(event) => setCreateForm({ ...createForm, handoverPointId: event.target.value })} required>
            <option value="">Chọn điểm bàn giao</option>
            {catalog?.handoverPoints.map((point) => <option key={point.id} value={point.id}>{point.name} - {point.address}</option>)}
          </select></label>
          <label className="input-field"><span>Tên vật phẩm</span><input value={createForm.itemName} onChange={(event) => setCreateForm({ ...createForm, itemName: event.target.value })} placeholder="Ví dụ: Ví da màu nâu" required /></label>
          <label className="input-field"><span>Danh mục</span><select value={createForm.categoryId} onChange={(event) => setCreateForm({ ...createForm, categoryId: event.target.value })}>
            <option value="">Chưa phân loại</option>
            {leafCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select></label>
          <label className="input-field"><span>Mô tả</span><textarea value={createForm.description} onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} rows={3} placeholder="Mô tả ngắn về vật phẩm" /></label>
          <label className="input-field"><span>Tình trạng khi nhận</span><textarea value={createForm.conditionNotes} onChange={(event) => setCreateForm({ ...createForm, conditionNotes: event.target.value })} rows={3} placeholder="Tình trạng, phụ kiện, vết xước..." required /></label>
          <div className="warehouse-form-pair">
            <label className="input-field"><span>Khu vực</span><select value={createForm.areaId} onChange={(event) => setCreateForm({ ...createForm, areaId: event.target.value, buildingId: "" })}>
              <option value="">Chưa rõ</option>
              {catalog?.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select></label>
            <label className="input-field"><span>Địa điểm</span><select value={createForm.buildingId} onChange={(event) => setCreateForm({ ...createForm, buildingId: event.target.value })}>
              <option value="">Chưa rõ</option>
              {availableBuildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
            </select></label>
          </div>
          <div className="warehouse-form-pair">
            <label className="input-field"><span>Phòng/vị trí</span><input value={createForm.roomText} onChange={(event) => setCreateForm({ ...createForm, roomText: event.target.value })} placeholder="Sảnh tầng 1" /></label>
            <label className="input-field"><span>Mã lưu kho</span><input value={createForm.storageCode} onChange={(event) => setCreateForm({ ...createForm, storageCode: event.target.value })} placeholder="A1-02" /></label>
          </div>
          <div className="warehouse-form-pair">
            <label className="input-field"><span>Người giao</span><input value={createForm.finderName} onChange={(event) => setCreateForm({ ...createForm, finderName: event.target.value })} placeholder="Họ tên" /></label>
            <label className="input-field"><span>Liên hệ</span><input value={createForm.finderContact} onChange={(event) => setCreateForm({ ...createForm, finderContact: event.target.value })} placeholder="Email/SĐT" /></label>
          </div>
          <label className="input-field"><span>Thời gian nhận</span><input type="datetime-local" value={createForm.receivedAt} onChange={(event) => setCreateForm({ ...createForm, receivedAt: event.target.value })} /></label>
          <button className="primary-button" disabled={pendingAction === "create"}><ClipboardCheck size={17} /> Tiếp nhận</button>
        </form>
      </aside>

      <section className="warehouse-main">
        <form className="warehouse-filter-bar" onSubmit={submitFilters}>
          <label className="input-field"><span>Tìm vật phẩm</span><input aria-label="Tìm vật phẩm trong kho" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Tên, mô tả, mã kho..." /></label>
          <label className="input-field"><span>Trạng thái</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">Tất cả</option>
            {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select></label>
          <label className="input-field"><span>Điểm bàn giao</span><select value={filters.handoverPointId} onChange={(event) => setFilters({ ...filters, handoverPointId: event.target.value })}>
            <option value="">Tất cả</option>
            {catalog?.handoverPoints.map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}
          </select></label>
          <button className="secondary-button"><Search size={17} /> Tìm</button>
        </form>

        <section className="warehouse-counts" aria-label="Số vật phẩm tại điểm bàn giao">
          {dashboard?.handoverCounts.map((point) => <article key={point.handoverPointId}>
            <MapPin size={17} />
            <strong>{point.itemCount}</strong>
            <span>{point.name}</span>
            <small>{point.storedCount} đang lưu kho - {point.overdueCount} quá hạn</small>
          </article>)}
        </section>

        <div className="warehouse-item-list">
          {dashboard?.items.map((item) => <article className={`warehouse-item-card ${selectedItemId === item.id ? "is-selected" : ""}`} key={item.id}>
            <div className="warehouse-item-card__top">
              <span className={`warehouse-status warehouse-status--${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span>
              <button type="button" className="secondary-button warehouse-select-button" onClick={() => selectItem(item)}><History size={15} /> Chọn</button>
            </div>
            <h2>{item.itemName}</h2>
            <p>{item.description || "Không có mô tả"}</p>
            <dl>
              <ItemMeta label="Hạn lưu giữ" value={<span className={isOverdue(item) ? "warehouse-deadline is-overdue" : "warehouse-deadline"}>{formatDate(item.retentionDeadline)}</span>} />
              <ItemMeta label="Mã kho" value={item.storageCode || "Chưa có"} />
              <ItemMeta label="Điểm nhận" value={item.handoverPoint?.name ?? "Chưa rõ"} />
              <ItemMeta label="Nhật ký" value={`${item.logCount} lần`} />
            </dl>
          </article>)}
          {!dashboard?.items.length && <div className="warehouse-empty"><Archive size={42} /><strong>Chưa có vật phẩm phù hợp</strong></div>}
        </div>
      </section>

      <aside className="admin-panel warehouse-detail-panel">
        <div className="admin-panel-heading">
          <span><Save size={18} /></span>
          <div><p className="eyebrow">TRẠNG THÁI</p><h2>Cập nhật và nhật ký</h2></div>
        </div>
        {selectedItem ? <>
          <div className="warehouse-selected-summary">
            <span className={`warehouse-status warehouse-status--${selectedItem.status.toLowerCase()}`}>{statusLabel(selectedItem.status)}</span>
            <h3>{selectedItem.itemName}</h3>
            <p>Hạn lưu giữ: {formatDate(selectedItem.retentionDeadline)} - Nhận lúc {formatDateTime(selectedItem.receivedAt)}</p>
          </div>
          <form className="admin-form" onSubmit={submitUpdate}>
            <label className="input-field"><span>Trạng thái mới</span><select value={updateForm.status} onChange={(event) => setUpdateForm({ ...updateForm, status: event.target.value as WarehouseStatus })}>
              {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select></label>
            <label className="input-field"><span>Mã lưu kho</span><input value={updateForm.storageCode} onChange={(event) => setUpdateForm({ ...updateForm, storageCode: event.target.value })} placeholder="Bắt buộc khi chuyển sang Đang lưu kho" /></label>
            <label className="input-field"><span>Tình trạng</span><textarea value={updateForm.conditionNotes} onChange={(event) => setUpdateForm({ ...updateForm, conditionNotes: event.target.value })} rows={3} /></label>
            <label className="input-field"><span>Ghi chú nhật ký</span><textarea value={updateForm.note} onChange={(event) => setUpdateForm({ ...updateForm, note: event.target.value })} rows={2} placeholder="Lý do cập nhật" /></label>
            <button className="primary-button" disabled={pendingAction === "update"}><CheckCircle2 size={17} /> Lưu trạng thái</button>
          </form>
          <div className="warehouse-log-list">
            <div className="admin-list-heading"><div><p className="eyebrow">NHẬT KÝ KHO</p><h2>Lịch sử</h2></div><strong>{logs.length}</strong></div>
            {pendingAction === "logs" && <p className="admin-hint">Đang tải nhật ký...</p>}
            {logs.map((log) => <article key={log.id}>
              <strong>{statusLabel(log.fromStatus)} -&gt; {statusLabel(log.toStatus)}</strong>
              <span>{log.actor.fullName ?? "Nhân viên"} - {formatDateTime(log.createdAt)}</span>
              {(log.storageCode || log.conditionNotes || log.note) && <p>{[log.storageCode, log.conditionNotes, log.note].filter(Boolean).join(" | ")}</p>}
            </article>)}
          </div>
        </> : <div className="warehouse-empty warehouse-empty--compact"><History size={38} /><strong>Chọn một vật phẩm để xem nhật ký</strong></div>}
      </aside>
    </div>
  </section>;
}
