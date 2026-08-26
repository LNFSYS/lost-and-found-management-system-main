import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Filter,
  FolderTree,
  Layers3,
  MapPinned,
  PencilLine,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  UserPlus,
  UsersRound,
  X
} from "lucide-react";
import { api, type AdminAccessRole, type AdminArea, type AdminBuilding, type AdminCatalog, type AdminCategory, type AdminUser, type AdminUserStatus, type ConfigValueType, type SystemConfig } from "../services/api";

type AdminTab = "users" | "configs" | "categories" | "locations";
type PendingAction = "" | "load" | "users" | "user" | "user-toggle" | "configs" | "config" | "category" | "area" | "building" | "toggle" | "delete";

const emptyCategoryForm = { name: "", parentId: "", isActive: true };
const emptyAreaForm = { name: "", description: "", isActive: true };
const emptyBuildingForm = { name: "", areaId: "", isActive: true };
const emptyUserForm = { email: "", password: "", fullName: "", studentCode: "", phoneNumber: "", audienceRole: "", accessRole: "USER" as AdminAccessRole, status: "ACTIVE" as AdminUserStatus };
const emptyUserFilters = { q: "", role: "" as AdminAccessRole | "", status: "" as AdminUserStatus | "", page: 1, pageSize: 10 };
const emptyConfigForm = { configKey: "", configValue: "", valueType: "STRING" as ConfigValueType, description: "", isPublic: false };
const emptyConfigFilters = { q: "", valueType: "" as ConfigValueType | "", isPublic: "" as boolean | "", page: 1, pageSize: 10 };

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

function UserStatusBadge({ status }: { status: AdminUserStatus }) {
  return <span className={`admin-status ${status === "ACTIVE" ? "admin-status--active" : ""}`}>
    {status === "ACTIVE" ? "Active" : "Disabled"}
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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [configTotal, setConfigTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [pendingAction, setPendingAction] = useState<PendingAction>("load");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [userFilters, setUserFilters] = useState(emptyUserFilters);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [userEditingId, setUserEditingId] = useState<string | null>(null);
  const [configFilters, setConfigFilters] = useState(emptyConfigFilters);
  const [configForm, setConfigForm] = useState(emptyConfigForm);
  const [configEditingId, setConfigEditingId] = useState<string | null>(null);
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

  async function loadUsers(nextFilters = userFilters, silent = false) {
    if (!silent) setPendingAction("users");
    setError("");
    try {
      const result = await api.listAdminUsers(nextFilters);
      setUsers(result.items);
      setUserTotal(result.total);
      setUserFilters({ ...nextFilters, page: result.page, pageSize: result.pageSize });
    } catch (reason) {
      setError(messageOf(reason, "Không thể tải danh sách người dùng"));
    } finally {
      if (!silent) setPendingAction("");
    }
  }

  async function loadConfigs(nextFilters = configFilters, silent = false) {
    if (!silent) setPendingAction("configs");
    setError("");
    try {
      const result = await api.listSystemConfigs(nextFilters);
      setConfigs(result.items);
      setConfigTotal(result.total);
      setConfigFilters({ ...nextFilters, page: result.page, pageSize: result.pageSize });
    } catch (reason) {
      setError(messageOf(reason, "Không thể tải cấu hình hệ thống"));
    } finally {
      if (!silent) setPendingAction("");
    }
  }

  useEffect(() => {
    void Promise.all([loadCatalog(), loadUsers(emptyUserFilters, true), loadConfigs(emptyConfigFilters, true)]).finally(() => setPendingAction(""));
  }, []);

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

  async function runUserAction(action: PendingAction, work: () => Promise<unknown>, success: string) {
    setPendingAction(action);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice(success);
      await Promise.all([loadUsers(userFilters, true), loadCatalog(true)]);
      return true;
    } catch (reason) {
      setError(messageOf(reason, "Không thể thực hiện thao tác"));
      return false;
    } finally {
      setPendingAction("");
    }
  }

  async function runConfigAction(action: PendingAction, work: () => Promise<unknown>, success: string) {
    setPendingAction(action);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice(success);
      await loadConfigs(configFilters, true);
      return true;
    } catch (reason) {
      setError(messageOf(reason, "Không thể thực hiện thao tác"));
      return false;
    } finally {
      setPendingAction("");
    }
  }

  function resetUserForm() {
    setUserForm(emptyUserForm);
    setUserEditingId(null);
  }

  function editUser(user: AdminUser) {
    setActiveTab("users");
    setUserEditingId(user.id);
    setUserForm({
      email: user.email,
      password: "",
      fullName: user.fullName,
      studentCode: user.studentCode ?? "",
      phoneNumber: user.phoneNumber ?? "",
      audienceRole: user.roles.includes("LECTURER") ? "LECTURER" : user.roles.includes("STUDENT") ? "STUDENT" : "",
      accessRole: user.accessRole,
      status: user.status
    });
  }

  async function submitUser(event: FormEvent) {
    event.preventDefault();
    const audienceRole = userForm.audienceRole ? userForm.audienceRole as "STUDENT" | "LECTURER" : null;
    if (userEditingId) {
      const current = users.find((user) => user.id === userEditingId);
      if (await runUserAction("user", async () => {
        await api.updateAdminUser(userEditingId, {
          email: userForm.email,
          fullName: userForm.fullName,
          studentCode: userForm.studentCode.trim() || null,
          phoneNumber: userForm.phoneNumber.trim() || null
        });
        if (current && current.accessRole !== userForm.accessRole) await api.changeAdminUserRole(userEditingId, userForm.accessRole);
        if (current && current.status !== userForm.status) await api.changeAdminUserStatus(userEditingId, userForm.status);
      }, "Đã cập nhật người dùng")) resetUserForm();
      return;
    }

    if (await runUserAction("user", () => api.createAdminUser({
      email: userForm.email,
      password: userForm.password,
      fullName: userForm.fullName,
      studentCode: userForm.studentCode.trim() || null,
      phoneNumber: userForm.phoneNumber.trim() || null,
      audienceRole,
      accessRole: userForm.accessRole,
      status: userForm.status
    }), "Đã tạo người dùng")) resetUserForm();
  }

  function applyUserFilters(event: FormEvent) {
    event.preventDefault();
    void loadUsers({ ...userFilters, page: 1 });
  }

  function changeUserPage(delta: number) {
    const maxPage = Math.max(1, Math.ceil(userTotal / userFilters.pageSize));
    const page = Math.min(maxPage, Math.max(1, userFilters.page + delta));
    if (page !== userFilters.page) void loadUsers({ ...userFilters, page });
  }

  function changeUserRole(user: AdminUser, accessRole: AdminAccessRole) {
    void runUserAction("user-toggle", () => api.changeAdminUserRole(user.id, accessRole), "Đã cập nhật vai trò");
  }

  function toggleUserStatus(user: AdminUser) {
    const status: AdminUserStatus = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    void runUserAction("user-toggle", () => api.changeAdminUserStatus(user.id, status), status === "ACTIVE" ? "Đã mở tài khoản" : "Đã khóa tài khoản");
  }

  function deleteUser(user: AdminUser) {
    if (!window.confirm(`Xóa người dùng "${user.email}"?`)) return;
    void runUserAction("delete", () => api.deleteAdminUser(user.id), "Đã xóa người dùng");
  }

  function resetConfigForm() {
    setConfigForm(emptyConfigForm);
    setConfigEditingId(null);
  }

  function editConfig(config: SystemConfig) {
    setActiveTab("configs");
    setConfigEditingId(config.id);
    setConfigForm({
      configKey: config.configKey,
      configValue: config.configValue,
      valueType: config.valueType,
      description: config.description ?? "",
      isPublic: config.isPublic
    });
  }

  async function submitConfig(event: FormEvent) {
    event.preventDefault();
    const payload = {
      configKey: configForm.configKey,
      configValue: configForm.configValue,
      valueType: configForm.valueType,
      description: configForm.description.trim() || null,
      isPublic: configForm.isPublic
    };
    if (configEditingId) {
      if (await runConfigAction("config", () => api.updateSystemConfig(configEditingId, payload), "Đã cập nhật cấu hình")) resetConfigForm();
      return;
    }
    if (await runConfigAction("config", () => api.createSystemConfig(payload), "Đã tạo cấu hình")) resetConfigForm();
  }

  function applyConfigFilters(event: FormEvent) {
    event.preventDefault();
    void loadConfigs({ ...configFilters, page: 1 });
  }

  function changeConfigPage(delta: number) {
    const maxPage = Math.max(1, Math.ceil(configTotal / configFilters.pageSize));
    const page = Math.min(maxPage, Math.max(1, configFilters.page + delta));
    if (page !== configFilters.page) void loadConfigs({ ...configFilters, page });
  }

  function toggleConfigPublic(config: SystemConfig) {
    void runConfigAction("config", () => api.updateSystemConfig(config.id, { isPublic: !config.isPublic }), config.isPublic ? "Đã ẩn khỏi public config" : "Đã bật public config");
  }

  function deleteConfig(config: SystemConfig) {
    if (!window.confirm(`Xóa cấu hình "${config.configKey}"?`)) return;
    void runConfigAction("delete", () => api.deleteSystemConfig(config.id), "Đã xóa cấu hình");
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
      <button type="button" className="secondary-button" onClick={() => void Promise.all([loadCatalog(), loadUsers(userFilters, true), loadConfigs(configFilters, true)]).finally(() => setPendingAction(""))} disabled={pendingAction === "load"}><RefreshCw size={17} /> Làm mới</button>
    </header>

    <div className="admin-stats" aria-label="Thống kê nhanh">
      <StatCard icon={<BarChart3 size={20} />} value={catalog?.stats.totalPosts ?? 0} label="Tổng bài đăng" />
      <StatCard icon={<Clock3 size={20} />} value={catalog?.stats.processingPosts ?? 0} label="Đang xử lý" />
      <StatCard icon={<UsersRound size={20} />} value={catalog?.stats.totalUsers ?? 0} label="Người dùng" />
      <StatCard icon={<CheckCircle2 size={20} />} value={catalog?.stats.returnedPosts ?? 0} label="Đã hoàn trả" />
    </div>

    <div className="admin-tabs" role="tablist" aria-label="Chức năng quản trị">
      <button type="button" className={activeTab === "users" ? "active" : ""} onClick={() => setActiveTab("users")}><UsersRound size={18} /> Người dùng</button>
      <button type="button" className={activeTab === "configs" ? "active" : ""} onClick={() => setActiveTab("configs")}><Settings2 size={18} /> Cấu hình</button>
      <button type="button" className={activeTab === "categories" ? "active" : ""} onClick={() => setActiveTab("categories")}><FolderTree size={18} /> Danh mục</button>
      <button type="button" className={activeTab === "locations" ? "active" : ""} onClick={() => setActiveTab("locations")}><MapPinned size={18} /> Khu vực</button>
    </div>

    {notice && <p className="form-note admin-message">{notice}</p>}
    {error && <p className="form-error admin-message" role="alert">{error}</p>}

    {activeTab === "users" && <div className="admin-grid admin-grid--users">
      <aside className="admin-panel admin-panel--form">
        <div className="admin-panel-heading">
          <span><UserPlus size={18} /></span>
          <div><p className="eyebrow">USERS</p><h2>{userEditingId ? "Cập nhật người dùng" : "Tạo người dùng"}</h2></div>
        </div>
        <form className="admin-form" onSubmit={submitUser}>
          <label className="input-field"><span>Email</span><input type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} required /></label>
          {!userEditingId && <label className="input-field"><span>Mật khẩu</span><input type="password" minLength={8} value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} required /></label>}
          <label className="input-field"><span>Họ và tên</span><input value={userForm.fullName} onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })} required /></label>
          <label className="input-field"><span>Mã sinh viên/nhân sự</span><input value={userForm.studentCode} onChange={(event) => setUserForm({ ...userForm, studentCode: event.target.value })} /></label>
          <label className="input-field"><span>Số điện thoại</span><input value={userForm.phoneNumber} onChange={(event) => setUserForm({ ...userForm, phoneNumber: event.target.value })} /></label>
          <div className="warehouse-form-pair">
            {!userEditingId && <label className="input-field"><span>Nhóm sử dụng</span><select value={userForm.audienceRole} onChange={(event) => setUserForm({ ...userForm, audienceRole: event.target.value })}>
              <option value="">Không gắn</option>
              <option value="STUDENT">Student</option>
              <option value="LECTURER">Lecturer</option>
            </select></label>}
            <label className="input-field"><span>Vai trò truy cập</span><select value={userForm.accessRole} onChange={(event) => setUserForm({ ...userForm, accessRole: event.target.value as AdminAccessRole })}>
              <option value="USER">User</option>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select></label>
          </div>
          <label className="input-field"><span>Trạng thái</span><select value={userForm.status} onChange={(event) => setUserForm({ ...userForm, status: event.target.value as AdminUserStatus })}>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select></label>
          <div className="admin-form-actions">
            {userEditingId && <button type="button" className="secondary-button" onClick={resetUserForm}><X size={17} /> Hủy</button>}
            <button className="primary-button" disabled={pendingAction === "user"}><Plus size={17} /> {userEditingId ? "Lưu người dùng" : "Tạo người dùng"}</button>
          </div>
        </form>
      </aside>

      <section className="admin-panel admin-panel--list">
        <div className="admin-list-heading"><div><p className="eyebrow">ACCESS</p><h2>Danh sách người dùng</h2></div><strong>{userTotal}</strong></div>
        <form className="admin-user-filters" onSubmit={applyUserFilters}>
          <label className="input-field"><span>Tìm kiếm</span><input value={userFilters.q} onChange={(event) => setUserFilters({ ...userFilters, q: event.target.value })} placeholder="Email, tên, mã số..." /></label>
          <label className="input-field"><span>Vai trò</span><select value={userFilters.role} onChange={(event) => setUserFilters({ ...userFilters, role: event.target.value as AdminAccessRole | "" })}>
            <option value="">Tất cả</option>
            <option value="ADMIN">Admin</option>
            <option value="STAFF">Staff</option>
            <option value="USER">User</option>
          </select></label>
          <label className="input-field"><span>Trạng thái</span><select value={userFilters.status} onChange={(event) => setUserFilters({ ...userFilters, status: event.target.value as AdminUserStatus | "" })}>
            <option value="">Tất cả</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select></label>
          <button className="secondary-button" disabled={pendingAction === "users"}><Filter size={17} /> Lọc</button>
        </form>
        <div className="admin-user-table-wrap">
          <table className="admin-user-table">
            <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Cập nhật</th><th></th></tr></thead>
            <tbody>
              {users.map((user) => <tr key={user.id}>
                <td>
                  <strong>{user.fullName}</strong>
                  <span>{user.email}</span>
                  <small>{user.studentCode || "Chưa có mã"} / {user.phoneNumber || "Chưa có SĐT"}</small>
                </td>
                <td>
                  <select className="admin-inline-select" value={user.accessRole} onChange={(event) => changeUserRole(user, event.target.value as AdminAccessRole)} disabled={pendingAction === "user-toggle"}>
                    <option value="USER">User</option>
                    <option value="STAFF">Staff</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td><UserStatusBadge status={user.status} /></td>
                <td>{new Date(user.updatedAt).toLocaleDateString("vi-VN")}</td>
                <td>
                  <div className="admin-user-actions">
                    <button type="button" className="admin-icon-button" title="Chỉnh sửa" aria-label="Chỉnh sửa" onClick={() => editUser(user)}><PencilLine size={16} /></button>
                    <button type="button" className="admin-icon-button" title={user.status === "ACTIVE" ? "Khóa tài khoản" : "Mở tài khoản"} aria-label={user.status === "ACTIVE" ? "Khóa tài khoản" : "Mở tài khoản"} onClick={() => toggleUserStatus(user)}>{user.status === "ACTIVE" ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    <button type="button" className="admin-icon-button admin-icon-button--danger" title="Xóa người dùng" aria-label="Xóa người dùng" onClick={() => deleteUser(user)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>)}
              {!users.length && <tr><td colSpan={5} className="admin-empty-cell">Không có người dùng phù hợp</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <button type="button" className="secondary-button" onClick={() => changeUserPage(-1)} disabled={userFilters.page <= 1}>Trước</button>
          <span>Trang {userFilters.page} / {Math.max(1, Math.ceil(userTotal / userFilters.pageSize))}</span>
          <button type="button" className="secondary-button" onClick={() => changeUserPage(1)} disabled={userFilters.page >= Math.max(1, Math.ceil(userTotal / userFilters.pageSize))}>Sau</button>
        </div>
      </section>
    </div>}

    {activeTab === "configs" && <div className="admin-grid admin-grid--users">
      <aside className="admin-panel admin-panel--form">
        <div className="admin-panel-heading">
          <span><Settings2 size={18} /></span>
          <div><p className="eyebrow">CONFIG</p><h2>{configEditingId ? "Cập nhật cấu hình" : "Tạo cấu hình"}</h2></div>
        </div>
        <form className="admin-form" onSubmit={submitConfig}>
          <label className="input-field"><span>Khóa cấu hình</span><input value={configForm.configKey} onChange={(event) => setConfigForm({ ...configForm, configKey: event.target.value })} placeholder="Ví dụ: client.max_title_length" required /></label>
          <div className="warehouse-form-pair">
            <label className="input-field"><span>Kiểu dữ liệu</span><select value={configForm.valueType} onChange={(event) => setConfigForm({ ...configForm, valueType: event.target.value as ConfigValueType })}>
              <option value="STRING">Chuỗi</option>
              <option value="INTEGER">Số nguyên</option>
              <option value="FLOAT">Số thực</option>
              <option value="BOOLEAN">Đúng/sai</option>
              <option value="JSON">JSON</option>
            </select></label>
            <label className="admin-check admin-check--field"><input type="checkbox" checked={configForm.isPublic} onChange={(event) => setConfigForm({ ...configForm, isPublic: event.target.checked })} /><span>Cho phép public</span></label>
          </div>
          <label className="input-field"><span>Giá trị</span><textarea rows={4} value={configForm.configValue} onChange={(event) => setConfigForm({ ...configForm, configValue: event.target.value })} placeholder='Ví dụ: 5, 0.75, true, {"enabled":true}' required /></label>
          <label className="input-field"><span>Mô tả</span><input value={configForm.description} onChange={(event) => setConfigForm({ ...configForm, description: event.target.value })} /></label>
          <div className="admin-form-actions">
            {configEditingId && <button type="button" className="secondary-button" onClick={resetConfigForm}><X size={17} /> Hủy</button>}
            <button className="primary-button" disabled={pendingAction === "config"}><Plus size={17} /> {configEditingId ? "Lưu cấu hình" : "Tạo cấu hình"}</button>
          </div>
        </form>
      </aside>

      <section className="admin-panel admin-panel--list">
        <div className="admin-list-heading"><div><p className="eyebrow">PUBLIC SAFE CONFIG</p><h2>Danh sách cấu hình</h2></div><strong>{configTotal}</strong></div>
        <form className="admin-user-filters" onSubmit={applyConfigFilters}>
          <label className="input-field"><span>Tìm kiếm</span><input value={configFilters.q} onChange={(event) => setConfigFilters({ ...configFilters, q: event.target.value })} placeholder="Khóa hoặc mô tả..." /></label>
          <label className="input-field"><span>Kiểu</span><select value={configFilters.valueType} onChange={(event) => setConfigFilters({ ...configFilters, valueType: event.target.value as ConfigValueType | "" })}>
            <option value="">Tất cả</option>
            <option value="STRING">Chuỗi</option>
            <option value="INTEGER">Số nguyên</option>
            <option value="FLOAT">Số thực</option>
            <option value="BOOLEAN">Đúng/sai</option>
            <option value="JSON">JSON</option>
          </select></label>
          <label className="input-field"><span>Public</span><select value={String(configFilters.isPublic)} onChange={(event) => setConfigFilters({ ...configFilters, isPublic: event.target.value === "" ? "" : event.target.value === "true" })}>
            <option value="">Tất cả</option>
            <option value="true">Có</option>
            <option value="false">Không</option>
          </select></label>
          <button className="secondary-button" disabled={pendingAction === "configs"}><Filter size={17} /> Lọc</button>
        </form>
        <div className="admin-user-table-wrap">
          <table className="admin-user-table">
            <thead><tr><th>Cấu hình</th><th>Kiểu</th><th>Public</th><th>Cập nhật</th><th></th></tr></thead>
            <tbody>
              {configs.map((config) => <tr key={config.id}>
                <td>
                  <strong>{config.configKey}</strong>
                  <span>{config.configValue}</span>
                  <small>{config.description || "Chưa có mô tả"}</small>
                </td>
                <td>{config.valueType}</td>
                <td><UserStatusBadge status={config.isPublic ? "ACTIVE" : "DISABLED"} /></td>
                <td>{new Date(config.updatedAt).toLocaleDateString("vi-VN")}</td>
                <td>
                  <div className="admin-user-actions">
                    <button type="button" className="admin-icon-button" title="Chỉnh sửa" aria-label="Chỉnh sửa" onClick={() => editConfig(config)}><PencilLine size={16} /></button>
                    <button type="button" className="admin-icon-button" title={config.isPublic ? "Ẩn khỏi public config" : "Bật public config"} aria-label={config.isPublic ? "Ẩn khỏi public config" : "Bật public config"} onClick={() => toggleConfigPublic(config)}>{config.isPublic ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    <button type="button" className="admin-icon-button admin-icon-button--danger" title="Xóa cấu hình" aria-label="Xóa cấu hình" onClick={() => deleteConfig(config)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>)}
              {!configs.length && <tr><td colSpan={5} className="admin-empty-cell">Không có cấu hình phù hợp</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <button type="button" className="secondary-button" onClick={() => changeConfigPage(-1)} disabled={configFilters.page <= 1}>Trước</button>
          <span>Trang {configFilters.page} / {Math.max(1, Math.ceil(configTotal / configFilters.pageSize))}</span>
          <button type="button" className="secondary-button" onClick={() => changeConfigPage(1)} disabled={configFilters.page >= Math.max(1, Math.ceil(configTotal / configFilters.pageSize))}>Sau</button>
        </div>
      </section>
    </div>}

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
