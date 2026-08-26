import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  FolderTree,
  Handshake,
  Layers3,
  MapPin,
  MapPinned,
  PencilLine,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  UsersRound,
  X
} from "lucide-react";
import { api, type AdminArea, type AdminBuilding, type AdminCatalog, type AdminCategory, type AdminHandoverPoint, type AdminHandoverPointPayload } from "../services/api";

type AdminTab = "categories" | "locations" | "handover";
type PendingAction = "" | "load" | "category" | "area" | "building" | "handover" | "toggle" | "delete";

const emptyCategoryForm = { name: "", parentId: "", isActive: true };
const emptyAreaForm = { name: "", description: "", isActive: true };
const emptyBuildingForm = { name: "", areaId: "", isActive: true };
const emptyHandoverForm = {
  name: "",
  address: "",
  areaId: "",
  buildingId: "",
  openingHours: "",
  contactInfo: "",
  mapImageUrl: "",
  mapPositionX: 50,
  mapPositionY: 50,
  isActive: true
};

function messageOf(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function StatCard({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return <article className="admin-stat">
    <span>{icon}</span>
    <strong>{value}</strong>
    <small>{label}</small>
  </article>;
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={`admin-status ${active ? "admin-status--active" : ""}`}>
    {active ? "Đang hoạt động" : "Đã ẩn"}
  </span>;
}

function CardActions({ active, label, onEdit, onToggle, onDelete }: { active: boolean; label: string; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return <div className="admin-card-actions">
    <button type="button" className="admin-icon-button" title={`Chỉnh sửa ${label}`} aria-label={`Chỉnh sửa ${label}`} onClick={onEdit}><PencilLine size={16} /></button>
    <button type="button" className="admin-icon-button" title={active ? `Ẩn ${label}` : `Hiện ${label}`} aria-label={active ? `Ẩn ${label}` : `Hiện ${label}`} onClick={onToggle}>
      {active ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
    <button type="button" className="admin-icon-button admin-icon-button--danger" title={`Xóa ${label}`} aria-label={`Xóa ${label}`} onClick={onDelete}><Trash2 size={16} /></button>
  </div>;
}

function HandoverMapPicker({ imageUrl, x, y, onChange }: { imageUrl: string; x: number; y: number; onChange: (position: { x: number; y: number }) => void }) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  function setFromPointer(clientX: number, clientY: number) {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    onChange({
      x: Number(Math.min(100, Math.max(0, (clientX - rect.left) / rect.width * 100)).toFixed(3)),
      y: Number(Math.min(100, Math.max(0, (clientY - rect.top) / rect.height * 100)).toFixed(3))
    });
  }

  return <div className="handover-map-picker">
    <div className="handover-map-picker__heading"><strong>Vị trí marker</strong><span>X {x.toFixed(1)}% · Y {y.toFixed(1)}%</span></div>
    <div
      ref={surfaceRef}
      className={`handover-map-picker__surface ${imageUrl ? "has-image" : ""}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setFromPointer(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => { if (event.buttons === 1) setFromPointer(event.clientX, event.clientY); }}
      role="application"
      aria-label="Bản đồ đặt marker điểm bàn giao"
    >
      {imageUrl ? <img src={imageUrl} alt="Bản đồ campus để đặt điểm bàn giao" /> : <div className="handover-map-picker__empty"><MapPinned size={28} /><span>Chọn ảnh map hoặc dùng lưới để đặt vị trí tương đối.</span></div>}
      <span className="handover-map-picker__pin" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true"><MapPin size={22} /></span>
    </div>
  </div>;
}

export function AdminPage() {
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("categories");
  const [pendingAction, setPendingAction] = useState<PendingAction>("load");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [categoryEditingId, setCategoryEditingId] = useState<string | null>(null);
  const [areaForm, setAreaForm] = useState(emptyAreaForm);
  const [areaEditingId, setAreaEditingId] = useState<string | null>(null);
  const [buildingForm, setBuildingForm] = useState(emptyBuildingForm);
  const [buildingEditingId, setBuildingEditingId] = useState<string | null>(null);
  const [handoverForm, setHandoverForm] = useState(emptyHandoverForm);
  const [handoverEditingId, setHandoverEditingId] = useState<string | null>(null);
  const [handoverMapFile, setHandoverMapFile] = useState<File | null>(null);
  const [handoverMapPreview, setHandoverMapPreview] = useState("");
  const [handoverMapTouched, setHandoverMapTouched] = useState(false);

  async function loadCatalog(silent = false) {
    if (!silent) setPendingAction("load");
    setError("");
    try {
      setCatalog(await api.getAdminCatalog());
    } catch (reason) {
      setError(messageOf(reason, "Không thể tải dữ liệu quản trị"));
    } finally {
      if (!silent) setPendingAction("");
    }
  }

  useEffect(() => { void loadCatalog(); }, []);

  const mainCategories = useMemo(() => catalog?.categories.filter((category) => !category.parentId) ?? [], [catalog]);
  const childCategories = useMemo(() => catalog?.categories.filter((category) => category.parentId) ?? [], [catalog]);
  const activeAreas = useMemo(() => catalog?.areas.filter((area) => area.isActive) ?? [], [catalog]);
  const handoverBuildings = useMemo(() => catalog?.buildings.filter((building) => !handoverForm.areaId || building.areaId === handoverForm.areaId) ?? [], [catalog, handoverForm.areaId]);

  async function runAction(action: PendingAction, work: () => Promise<unknown>, success: string) {
    setPendingAction(action);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice(success);
      await loadCatalog(true);
      return true;
    } catch (reason) {
      setError(messageOf(reason, "Không thể thực hiện thao tác"));
      return false;
    } finally {
      setPendingAction("");
    }
  }

  function resetCategoryForm() {
    setCategoryForm(emptyCategoryForm);
    setCategoryEditingId(null);
  }

  function resetAreaForm() {
    setAreaForm(emptyAreaForm);
    setAreaEditingId(null);
  }

  function resetBuildingForm() {
    setBuildingForm(emptyBuildingForm);
    setBuildingEditingId(null);
  }

  function resetHandoverForm() {
    setHandoverForm(emptyHandoverForm);
    setHandoverEditingId(null);
    setHandoverMapFile(null);
    setHandoverMapPreview("");
    setHandoverMapTouched(false);
  }

  async function submitCategory(event: FormEvent) {
    event.preventDefault();
    const payload = { name: categoryForm.name, parentId: categoryForm.parentId || null, isActive: categoryForm.isActive };
    if (await runAction("category", () => categoryEditingId ? api.updateAdminCategory(categoryEditingId, payload) : api.createAdminCategory(payload), categoryEditingId ? "Đã cập nhật danh mục" : "Đã tạo danh mục mới")) resetCategoryForm();
  }

  async function submitArea(event: FormEvent) {
    event.preventDefault();
    const payload = { name: areaForm.name, description: areaForm.description.trim() || null, isActive: areaForm.isActive };
    if (await runAction("area", () => areaEditingId ? api.updateAdminArea(areaEditingId, payload) : api.createAdminArea(payload), areaEditingId ? "Đã cập nhật khu vực" : "Đã tạo khu vực mới")) resetAreaForm();
  }

  async function submitBuilding(event: FormEvent) {
    event.preventDefault();
    const payload = { name: buildingForm.name, areaId: buildingForm.areaId, isActive: buildingForm.isActive };
    if (await runAction("building", () => buildingEditingId ? api.updateAdminBuilding(buildingEditingId, payload) : api.createAdminBuilding(payload), buildingEditingId ? "Đã cập nhật địa điểm" : "Đã tạo địa điểm mới")) resetBuildingForm();
  }

  async function submitHandover(event: FormEvent) {
    event.preventDefault();
    setPendingAction("handover");
    setError("");
    setNotice("");
    try {
      const payload: AdminHandoverPointPayload & { name: string; address: string } = {
        name: handoverForm.name,
        address: handoverForm.address,
        areaId: handoverForm.areaId || null,
        buildingId: handoverForm.buildingId || null,
        openingHours: handoverForm.openingHours.trim() || null,
        contactInfo: handoverForm.contactInfo.trim() || null,
        mapPositionX: handoverForm.mapPositionX,
        mapPositionY: handoverForm.mapPositionY,
        isActive: handoverForm.isActive
      };
      if (!handoverEditingId || (handoverMapTouched && !handoverMapFile)) payload.mapImageUrl = handoverForm.mapImageUrl.trim() || null;
      const point = handoverEditingId
        ? await api.updateAdminHandoverPoint(handoverEditingId, payload)
        : await api.createAdminHandoverPoint(payload);
      if (handoverMapFile) await api.uploadAdminHandoverMap(point.id, handoverMapFile);
      setNotice(handoverEditingId ? "Đã cập nhật điểm bàn giao" : "Đã tạo điểm bàn giao");
      resetHandoverForm();
      await loadCatalog(true);
    } catch (reason) {
      setError(messageOf(reason, "Không thể lưu điểm bàn giao"));
    } finally {
      setPendingAction("");
    }
  }

  function editCategory(category: AdminCategory) {
    setActiveTab("categories");
    setCategoryEditingId(category.id);
    setCategoryForm({ name: category.name, parentId: category.parentId ?? "", isActive: category.isActive });
  }

  function editArea(area: AdminArea) {
    setActiveTab("locations");
    setAreaEditingId(area.id);
    setAreaForm({ name: area.name, description: area.description ?? "", isActive: area.isActive });
  }

  function editBuilding(building: AdminBuilding) {
    setActiveTab("locations");
    setBuildingEditingId(building.id);
    setBuildingForm({ name: building.name, areaId: building.areaId, isActive: building.isActive });
  }

  function editHandover(point: AdminHandoverPoint) {
    setActiveTab("handover");
    setHandoverEditingId(point.id);
    setHandoverForm({
      name: point.name,
      address: point.address,
      areaId: point.areaId ?? "",
      buildingId: point.buildingId ?? "",
      openingHours: point.openingHours ?? "",
      contactInfo: point.contactInfo ?? "",
      mapImageUrl: point.mapImageUrl ?? "",
      mapPositionX: point.mapPositionX ?? 50,
      mapPositionY: point.mapPositionY ?? 50,
      isActive: point.isActive
    });
    setHandoverMapFile(null);
    setHandoverMapPreview(point.mapImageUrl ?? "");
    setHandoverMapTouched(false);
  }

  function selectHandoverMap(file?: File) {
    if (!file) return;
    if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type)) || file.size > 2 * 1024 * 1024) {
      setError("Ảnh map phải là JPEG, PNG hoặc WebP và không vượt quá 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setHandoverMapPreview(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
    setHandoverMapFile(file);
    setHandoverMapTouched(true);
    setError("");
  }

  function deleteCategory(category: AdminCategory) {
    if (!window.confirm(`Xóa danh mục "${category.name}"?`)) return;
    void runAction("delete", () => api.deleteAdminCategory(category.id), "Đã xóa danh mục");
  }

  function deleteArea(area: AdminArea) {
    if (!window.confirm(`Xóa khu vực "${area.name}"?`)) return;
    void runAction("delete", () => api.deleteAdminArea(area.id), "Đã xóa khu vực");
  }

  function deleteBuilding(building: AdminBuilding) {
    if (!window.confirm(`Xóa địa điểm "${building.name}"?`)) return;
    void runAction("delete", () => api.deleteAdminBuilding(building.id), "Đã xóa địa điểm");
  }

  function deleteHandover(point: AdminHandoverPoint) {
    if (point.activeAppointments > 0) {
      setError(`Không thể xóa "${point.name}" vì đang có ${point.activeAppointments} lịch hẹn hoạt động. Hãy tạm đóng điểm này.`);
      return;
    }
    if (!window.confirm(`Xóa vĩnh viễn điểm bàn giao "${point.name}"?`)) return;
    void runAction("delete", () => api.deleteAdminHandoverPoint(point.id), "Đã xóa điểm bàn giao");
  }

  if (pendingAction === "load" && !catalog) return <main className="center-state">Đang tải bảng quản trị...</main>;

  return <section className="admin-page">
    <header className="admin-hero">
      <div>
        <p className="eyebrow">ADMIN OPERATIONS</p>
        <h1>Bảng quản trị</h1>
      </div>
      <button type="button" className="secondary-button" onClick={() => void loadCatalog()} disabled={pendingAction === "load"}><RefreshCw size={17} /> Làm mới</button>
    </header>

    <div className="admin-stats" aria-label="Thống kê nhanh">
      <StatCard icon={<BarChart3 size={20} />} value={catalog?.stats.totalPosts ?? 0} label="Tổng bài đăng" />
      <StatCard icon={<Clock3 size={20} />} value={catalog?.stats.processingPosts ?? 0} label="Đang xử lý" />
      <StatCard icon={<UsersRound size={20} />} value={catalog?.stats.totalUsers ?? 0} label="Người dùng" />
      <StatCard icon={<CheckCircle2 size={20} />} value={catalog?.stats.returnedPosts ?? 0} label="Đã hoàn trả" />
    </div>

    <div className="admin-tabs" role="tablist" aria-label="Chức năng quản trị">
      <button type="button" className={activeTab === "categories" ? "active" : ""} onClick={() => setActiveTab("categories")}><FolderTree size={18} /> Danh mục</button>
      <button type="button" className={activeTab === "locations" ? "active" : ""} onClick={() => setActiveTab("locations")}><MapPinned size={18} /> Khu vực</button>
      <button type="button" className={activeTab === "handover" ? "active" : ""} onClick={() => setActiveTab("handover")}><Handshake size={18} /> Điểm bàn giao</button>
    </div>

    {notice && <p className="form-note admin-message">{notice}</p>}
    {error && <p className="form-error admin-message" role="alert">{error}</p>}

    {activeTab === "categories" && <div className="admin-grid">
      <aside className="admin-panel admin-panel--form">
        <div className="admin-panel-heading">
          <span><Layers3 size={18} /></span>
          <div><p className="eyebrow">CATEGORIES</p><h2>{categoryEditingId ? "Cập nhật danh mục" : "Tạo danh mục"}</h2></div>
        </div>
        <form className="admin-form" onSubmit={submitCategory}>
          <label className="input-field"><span>Tên danh mục</span><input value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} placeholder="Ví dụ: Thiết bị điện tử" required /></label>
          <label className="input-field"><span>Nhóm hiển thị</span><select value={categoryForm.parentId} onChange={(event) => setCategoryForm({ ...categoryForm, parentId: event.target.value })}>
            <option value="">Nhóm chính</option>
            {mainCategories.filter((category) => category.id !== categoryEditingId).map((category) => <option value={category.id} key={category.id}>{category.name}{category.isActive ? "" : " (đã ẩn)"}</option>)}
          </select></label>
          <p className="admin-hint">Để trống nếu đây là nhóm chính; chọn một nhóm nếu đây là danh mục cụ thể bên trong nhóm đó.</p>
          <label className="admin-check"><input type="checkbox" checked={categoryForm.isActive} onChange={(event) => setCategoryForm({ ...categoryForm, isActive: event.target.checked })} /><span>Đang hoạt động</span></label>
          <div className="admin-form-actions">
            {categoryEditingId && <button type="button" className="secondary-button" onClick={resetCategoryForm}><X size={17} /> Hủy</button>}
            <button className="primary-button" disabled={pendingAction === "category"}><Plus size={17} /> {categoryEditingId ? "Lưu danh mục" : "Tạo danh mục"}</button>
          </div>
        </form>
      </aside>

      <section className="admin-panel admin-panel--list">
        <div className="admin-list-heading"><div><p className="eyebrow">CRUD</p><h2>Danh sách danh mục</h2></div><strong>{catalog?.categories.length ?? 0}</strong></div>
        <h3 className="admin-section-title">Nhóm chính</h3>
        <div className="admin-card-grid">
          {mainCategories.map((category) => <article className="admin-entity-card" key={category.id}>
            <StatusBadge active={category.isActive} />
            <CardActions active={category.isActive} label={category.name} onEdit={() => editCategory(category)} onToggle={() => void runAction("toggle", () => api.updateAdminCategory(category.id, { isActive: !category.isActive }), category.isActive ? "Đã ẩn danh mục" : "Đã hiện danh mục")} onDelete={() => deleteCategory(category)} />
            <h3>{category.name}</h3>
            <p>{category.childCount} danh mục</p>
          </article>)}
        </div>
        <h3 className="admin-section-title">Danh mục cụ thể</h3>
        <div className="admin-card-grid">
          {childCategories.map((category) => <article className="admin-entity-card" key={category.id}>
            <StatusBadge active={category.isActive} />
            <CardActions active={category.isActive} label={category.name} onEdit={() => editCategory(category)} onToggle={() => void runAction("toggle", () => api.updateAdminCategory(category.id, { isActive: !category.isActive }), category.isActive ? "Đã ẩn danh mục" : "Đã hiện danh mục")} onDelete={() => deleteCategory(category)} />
            <h3>{category.name}</h3>
            <p>Trong nhóm {category.parentName ?? "chưa phân nhóm"}</p>
          </article>)}
        </div>
      </section>
    </div>}

    {activeTab === "locations" && <div className="admin-grid">
      <aside className="admin-panel admin-panel--form">
        <div className="admin-panel-heading">
          <span><MapPinned size={18} /></span>
          <div><p className="eyebrow">AREAS</p><h2>{areaEditingId ? "Cập nhật khu vực" : "Tạo khu vực"}</h2></div>
        </div>
        <form className="admin-form" onSubmit={submitArea}>
          <label className="input-field"><span>Tên khu vực</span><input value={areaForm.name} onChange={(event) => setAreaForm({ ...areaForm, name: event.target.value })} placeholder="Ví dụ: Khu Alpha" required /></label>
          <label className="input-field"><span>Mô tả</span><input value={areaForm.description} onChange={(event) => setAreaForm({ ...areaForm, description: event.target.value })} placeholder="Mô tả ngắn" /></label>
          <label className="admin-check"><input type="checkbox" checked={areaForm.isActive} onChange={(event) => setAreaForm({ ...areaForm, isActive: event.target.checked })} /><span>Đang hoạt động</span></label>
          <div className="admin-form-actions">
            {areaEditingId && <button type="button" className="secondary-button" onClick={resetAreaForm}><X size={17} /> Hủy</button>}
            <button className="primary-button" disabled={pendingAction === "area"}><Plus size={17} /> {areaEditingId ? "Lưu khu vực" : "Tạo khu vực"}</button>
          </div>
        </form>

        <div className="admin-form-divider" />
        <div className="admin-panel-heading admin-panel-heading--compact">
          <span><Building2 size={18} /></span>
          <div><p className="eyebrow">BUILDINGS</p><h2>{buildingEditingId ? "Cập nhật địa điểm" : "Tạo địa điểm cụ thể"}</h2></div>
        </div>
        <form className="admin-form" onSubmit={submitBuilding}>
          <label className="input-field"><span>Khu vực</span><select value={buildingForm.areaId} onChange={(event) => setBuildingForm({ ...buildingForm, areaId: event.target.value })} required>
            <option value="">Chọn khu vực</option>
            {(activeAreas.length ? activeAreas : catalog?.areas ?? []).map((area) => <option value={area.id} key={area.id}>{area.name}{area.isActive ? "" : " (đã ẩn)"}</option>)}
          </select></label>
          <label className="input-field"><span>Tên địa điểm</span><input value={buildingForm.name} onChange={(event) => setBuildingForm({ ...buildingForm, name: event.target.value })} placeholder="Ví dụ: Cổng chính" required /></label>
          <label className="admin-check"><input type="checkbox" checked={buildingForm.isActive} onChange={(event) => setBuildingForm({ ...buildingForm, isActive: event.target.checked })} /><span>Đang hoạt động</span></label>
          <div className="admin-form-actions">
            {buildingEditingId && <button type="button" className="secondary-button" onClick={resetBuildingForm}><X size={17} /> Hủy</button>}
            <button className="primary-button" disabled={pendingAction === "building" || !catalog?.areas.length}><Plus size={17} /> {buildingEditingId ? "Lưu địa điểm" : "Tạo địa điểm"}</button>
          </div>
        </form>
      </aside>

      <section className="admin-panel admin-panel--list">
        <div className="admin-list-heading"><div><p className="eyebrow">CRUD</p><h2>Danh sách khu vực</h2></div><strong>{catalog?.areas.length ?? 0}</strong></div>
        <div className="admin-card-grid">
          {catalog?.areas.map((area) => <article className="admin-entity-card" key={area.id}>
            <StatusBadge active={area.isActive} />
            <CardActions active={area.isActive} label={area.name} onEdit={() => editArea(area)} onToggle={() => void runAction("toggle", () => api.updateAdminArea(area.id, { isActive: !area.isActive }), area.isActive ? "Đã ẩn khu vực" : "Đã hiện khu vực")} onDelete={() => deleteArea(area)} />
            <h3>{area.name}</h3>
            <p>{area.description || "Không có mô tả"} · {area.buildingCount} địa điểm</p>
          </article>)}
        </div>
        <h3 className="admin-section-title">Địa điểm cụ thể</h3>
        <div className="admin-card-grid">
          {catalog?.buildings.map((building) => <article className="admin-entity-card" key={building.id}>
            <StatusBadge active={building.isActive} />
            <CardActions active={building.isActive} label={building.name} onEdit={() => editBuilding(building)} onToggle={() => void runAction("toggle", () => api.updateAdminBuilding(building.id, { isActive: !building.isActive }), building.isActive ? "Đã ẩn địa điểm" : "Đã hiện địa điểm")} onDelete={() => deleteBuilding(building)} />
            <h3>{building.name}</h3>
            <p>Trong khu vực {building.areaName}</p>
          </article>)}
        </div>
      </section>
    </div>}

    {activeTab === "handover" && <div className="admin-grid admin-grid--handover">
      <aside className="admin-panel admin-panel--form">
        <div className="admin-panel-heading">
          <span><Handshake size={18} /></span>
          <div><p className="eyebrow">HANDOVER POINTS</p><h2>{handoverEditingId ? "Cập nhật điểm bàn giao" : "Tạo điểm bàn giao"}</h2></div>
        </div>
        <form className="admin-form" onSubmit={submitHandover}>
          <label className="input-field"><span>Tên điểm bàn giao</span><input value={handoverForm.name} onChange={(event) => setHandoverForm({ ...handoverForm, name: event.target.value })} placeholder="Ví dụ: Quầy CTSV Alpha" required maxLength={100} /></label>
          <label className="input-field"><span>Địa chỉ</span><input value={handoverForm.address} onChange={(event) => setHandoverForm({ ...handoverForm, address: event.target.value })} placeholder="Tầng 1, tòa Alpha" required maxLength={255} /></label>
          <div className="admin-form-pair">
            <label className="input-field"><span>Khu vực</span><select value={handoverForm.areaId} onChange={(event) => setHandoverForm({ ...handoverForm, areaId: event.target.value, buildingId: "" })}>
              <option value="">Không gắn khu vực</option>
              {catalog?.areas.map((area) => <option value={area.id} key={area.id}>{area.name}{area.isActive ? "" : " (đã ẩn)"}</option>)}
            </select></label>
            <label className="input-field"><span>Địa điểm cụ thể</span><select value={handoverForm.buildingId} onChange={(event) => setHandoverForm({ ...handoverForm, buildingId: event.target.value })} disabled={!handoverForm.areaId}>
              <option value="">Không gắn địa điểm</option>
              {handoverBuildings.map((building) => <option value={building.id} key={building.id}>{building.name}{building.isActive ? "" : " (đã ẩn)"}</option>)}
            </select></label>
          </div>
          <div className="admin-form-pair">
            <label className="input-field"><span>Giờ hoạt động</span><input value={handoverForm.openingHours} onChange={(event) => setHandoverForm({ ...handoverForm, openingHours: event.target.value })} placeholder="08:00 - 17:30" maxLength={255} /></label>
            <label className="input-field"><span>Đơn vị / người phụ trách</span><input value={handoverForm.contactInfo} onChange={(event) => setHandoverForm({ ...handoverForm, contactInfo: event.target.value })} placeholder="Phòng CTSV · 0236..." maxLength={255} /></label>
          </div>
          <label className="input-field"><span>URL ảnh map (tùy chọn)</span><input
            value={handoverForm.mapImageUrl.startsWith("data:") ? "" : handoverForm.mapImageUrl}
            onChange={(event) => {
              const mapImageUrl = event.target.value;
              setHandoverForm({ ...handoverForm, mapImageUrl });
              setHandoverMapPreview(mapImageUrl);
              setHandoverMapFile(null);
              setHandoverMapTouched(true);
            }}
            placeholder={handoverForm.mapImageUrl.startsWith("data:") ? "Ảnh tải lên hiện tại đang được sử dụng" : "https://... hoặc /campus-map.jpg"}
          /></label>
          <div className="handover-map-actions">
            <label className="secondary-button handover-map-upload"><UploadCloud size={17} /> Chọn ảnh map<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectHandoverMap(event.target.files?.[0])} /></label>
            {(handoverMapPreview || handoverForm.mapImageUrl) && <button type="button" className="secondary-button" onClick={() => {
              setHandoverMapFile(null);
              setHandoverMapPreview("");
              setHandoverMapTouched(true);
              setHandoverForm({ ...handoverForm, mapImageUrl: "" });
            }}><X size={17} /> Bỏ ảnh</button>}
          </div>
          <p className="admin-hint">JPEG, PNG hoặc WebP, tối đa 2 MB. Kéo trực tiếp marker trên ảnh hoặc nhập tọa độ bên dưới.</p>
          <HandoverMapPicker imageUrl={handoverMapPreview || handoverForm.mapImageUrl} x={handoverForm.mapPositionX} y={handoverForm.mapPositionY} onChange={({ x, y }) => setHandoverForm({ ...handoverForm, mapPositionX: x, mapPositionY: y })} />
          <div className="admin-form-pair">
            <label className="input-field"><span>Tọa độ X (%)</span><input type="number" min={0} max={100} step="0.001" value={handoverForm.mapPositionX} onChange={(event) => setHandoverForm({ ...handoverForm, mapPositionX: Number(event.target.value) })} required /></label>
            <label className="input-field"><span>Tọa độ Y (%)</span><input type="number" min={0} max={100} step="0.001" value={handoverForm.mapPositionY} onChange={(event) => setHandoverForm({ ...handoverForm, mapPositionY: Number(event.target.value) })} required /></label>
          </div>
          <label className="admin-check"><input type="checkbox" checked={handoverForm.isActive} onChange={(event) => setHandoverForm({ ...handoverForm, isActive: event.target.checked })} /><span>Cho phép người dùng chọn điểm này</span></label>
          <div className="admin-form-actions">
            {handoverEditingId && <button type="button" className="secondary-button" onClick={resetHandoverForm}><X size={17} /> Hủy</button>}
            <button className="primary-button" disabled={pendingAction === "handover"}><Plus size={17} /> {handoverEditingId ? "Lưu điểm bàn giao" : "Tạo điểm bàn giao"}</button>
          </div>
        </form>
      </aside>

      <section className="admin-panel admin-panel--list">
        <div className="admin-list-heading"><div><p className="eyebrow">CAMPUS NETWORK</p><h2>Danh sách điểm bàn giao</h2></div><strong>{catalog?.handoverPoints.length ?? 0}</strong></div>
        <p className="admin-list-intro">Chỉ điểm đang hoạt động mới xuất hiện trong form đăng bài và API công khai.</p>
        <div className="admin-card-grid admin-card-grid--handover">
          {catalog?.handoverPoints.map((point) => <article className="admin-entity-card admin-handover-card" key={point.id}>
            <StatusBadge active={point.isActive} />
            <CardActions active={point.isActive} label={point.name} onEdit={() => editHandover(point)} onToggle={() => void runAction("toggle", () => api.updateAdminHandoverPoint(point.id, { isActive: !point.isActive }), point.isActive ? "Đã tạm đóng điểm bàn giao" : "Đã mở lại điểm bàn giao")} onDelete={() => deleteHandover(point)} />
            {point.mapImageUrl && <div className="admin-handover-card__map"><img src={point.mapImageUrl} alt="" /><span style={{ left: `${point.mapPositionX ?? 50}%`, top: `${point.mapPositionY ?? 50}%` }}><MapPin size={14} /></span></div>}
            <h3>{point.name}</h3>
            <p>{point.address}</p>
            <dl className="admin-handover-meta">
              <div><dt>Vị trí</dt><dd>{point.buildingName ?? point.areaName ?? "Chưa gắn khu vực"}</dd></div>
              <div><dt>Giờ mở</dt><dd>{point.openingHours ?? "Chưa cập nhật"}</dd></div>
              <div><dt>Đang lưu</dt><dd>{point.storedItems} vật phẩm</dd></div>
              <div><dt>Lịch hẹn</dt><dd>{point.activeAppointments} đang hoạt động</dd></div>
            </dl>
            {point.activeAppointments > 0 && <p className="admin-delete-lock">Không thể xóa khi lịch hẹn còn hoạt động.</p>}
          </article>)}
        </div>
        {!catalog?.handoverPoints.length && <div className="admin-empty"><MapPinned size={28} /><strong>Chưa có điểm bàn giao</strong><span>Tạo điểm đầu tiên và đặt marker trên bản đồ campus.</span></div>}
      </section>
    </div>}
  </section>;
}
