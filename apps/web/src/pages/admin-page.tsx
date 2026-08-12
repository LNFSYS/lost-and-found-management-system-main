import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  FolderTree,
  Layers3,
  MapPinned,
  PencilLine,
  Plus,
  RefreshCw,
  Trash2,
  UsersRound,
  X
} from "lucide-react";
import { api, type AdminArea, type AdminBuilding, type AdminCatalog, type AdminCategory } from "../services/api";

type AdminTab = "categories" | "locations";
type PendingAction = "" | "load" | "category" | "area" | "building" | "toggle" | "delete";

const emptyCategoryForm = { name: "", parentId: "", isActive: true };
const emptyAreaForm = { name: "", description: "", isActive: true };
const emptyBuildingForm = { name: "", areaId: "", isActive: true };

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
  </section>;
}
