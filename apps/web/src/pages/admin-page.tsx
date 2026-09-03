import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  EyeOff,
  Filter,
  FileText,
  FolderTree,
  Handshake,
  Layers3,
  MapPin,
  MapPinned,
  PencilLine,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserPlus,
  UsersRound,
  X
} from "lucide-react";
import { api, type AdminAccessRole, type AdminArea, type AdminBuilding, type AdminCatalog, type AdminCategory, type AdminDashboardKpis, type AdminHandoverPoint, type AdminHandoverPointPayload, type AdminModerationReport, type AdminReportEntityType, type AdminReportStatus, type AdminUser, type AdminUserStatus, type ConfigHistoryEntry, type ConfigValueType, type ModerationActionType, type SystemConfig } from "../services/api";

type AdminTab = "operations" | "users" | "configs" | "categories" | "locations" | "handover";
type PendingAction = "" | "load" | "users" | "user" | "user-toggle" | "configs" | "config" | "config-history" | "reports" | "review" | "kpis" | "export" | "category" | "area" | "building" | "handover" | "toggle" | "delete";

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
const emptyUserForm = { email: "", password: "", fullName: "", studentCode: "", phoneNumber: "", audienceRole: "", accessRole: "USER" as AdminAccessRole, status: "ACTIVE" as AdminUserStatus, reason: "" };
const emptyUserFilters = { q: "", role: "" as AdminAccessRole | "", status: "" as AdminUserStatus | "", page: 1, pageSize: 10 };
const emptyConfigForm = { configKey: "", configValue: "", valueType: "STRING" as ConfigValueType, description: "", isPublic: false, reason: "" };
const emptyConfigFilters = { q: "", valueType: "" as ConfigValueType | "", isPublic: "" as boolean | "", page: 1, pageSize: 10 };
const emptyReportFilters = { q: "", status: "PENDING" as AdminReportStatus | "", entityType: "" as AdminReportEntityType | "", page: 1, pageSize: 10 };
const emptyReviewForm = { actionType: "DISMISS_REPORT" as ModerationActionType, reason: "" };
const reportEntityLabels: Record<AdminReportEntityType, string> = { POST: "Bài đăng", USER: "Người dùng", CLAIM: "Claim", CHAT: "Chat" };
const reportStatusLabels: Record<AdminReportStatus, string> = { PENDING: "Chờ xử lý", REVIEWED: "Đã xử lý", DISMISSED: "Đã bỏ qua" };
const moderationActionLabels: Record<ModerationActionType, string> = {
  DISMISS_REPORT: "Bỏ qua report",
  WARN_USER: "Cảnh báo user",
  HIDE_POST: "Ẩn bài đăng",
  DELETE_POST: "Xóa bài đăng",
  BAN_USER: "Khóa user",
  UNBAN_USER: "Mở khóa user"
};

function moderationActionsForReport(report: AdminModerationReport): ModerationActionType[] {
  if (report.entityType === "POST") return ["DISMISS_REPORT", "WARN_USER", "HIDE_POST", "DELETE_POST", "BAN_USER", "UNBAN_USER"];
  if (report.entityType === "USER") return ["DISMISS_REPORT", "WARN_USER", "BAN_USER", "UNBAN_USER"];
  return ["DISMISS_REPORT"];
}
const exportSectionLabels = {
  overview: "Tổng quan",
  trends: "Xu hướng",
  statusBreakdown: "Trạng thái"
};
const exportSectionKeys = ["overview", "trends", "statusBreakdown"] as const;

function shiftDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const emptyKpiFilters = { from: shiftDate(-29), to: shiftDate(0) };

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

function ReportStatusBadge({ status }: { status: AdminReportStatus }) {
  return <span className={`admin-status admin-status--report-${status.toLowerCase()}`}>
    {reportStatusLabels[status]}
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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [configTotal, setConfigTotal] = useState(0);
  const [reports, setReports] = useState<AdminModerationReport[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [kpis, setKpis] = useState<AdminDashboardKpis | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("operations");
  const [pendingAction, setPendingAction] = useState<PendingAction>("load");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [userFilters, setUserFilters] = useState(emptyUserFilters);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [userEditingId, setUserEditingId] = useState<string | null>(null);
  const [configFilters, setConfigFilters] = useState(emptyConfigFilters);
  const [configForm, setConfigForm] = useState(emptyConfigForm);
  const [configEditingId, setConfigEditingId] = useState<string | null>(null);
  const [configHistory, setConfigHistory] = useState<ConfigHistoryEntry[]>([]);
  const [historyConfig, setHistoryConfig] = useState<SystemConfig | null>(null);
  const [reportFilters, setReportFilters] = useState(emptyReportFilters);
  const [selectedReport, setSelectedReport] = useState<AdminModerationReport | null>(null);
  const [reviewForm, setReviewForm] = useState(emptyReviewForm);
  const [kpiFilters, setKpiFilters] = useState(emptyKpiFilters);
  const [exportFormat, setExportFormat] = useState<"CSV" | "JSON">("CSV");
  const [exportSections, setExportSections] = useState({ overview: true, trends: true, statusBreakdown: true });
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

  async function loadReports(nextFilters = reportFilters, silent = false) {
    if (!silent) setPendingAction("reports");
    setError("");
    try {
      const result = await api.listAdminReports(nextFilters);
      setReports(result.items);
      setReportTotal(result.total);
      setReportFilters({ ...nextFilters, page: result.page, pageSize: result.pageSize });
    } catch (reason) {
      setError(messageOf(reason, "Không thể tải hàng đợi report"));
    } finally {
      if (!silent) setPendingAction("");
    }
  }

  async function loadKpis(nextFilters = kpiFilters, silent = false) {
    if (!silent) setPendingAction("kpis");
    setError("");
    try {
      setKpis(await api.getAdminDashboardKpis(nextFilters));
      setKpiFilters(nextFilters);
    } catch (reason) {
      setError(messageOf(reason, "Không thể tải KPI vận hành"));
    } finally {
      if (!silent) setPendingAction("");
    }
  }

  useEffect(() => {
    void Promise.all([
      loadCatalog(),
      loadUsers(emptyUserFilters, true),
      loadConfigs(emptyConfigFilters, true),
      loadReports(emptyReportFilters, true),
      loadKpis(emptyKpiFilters, true)
    ]).finally(() => setPendingAction(""));
  }, []);

  const mainCategories = useMemo(() => catalog?.categories.filter((category) => !category.parentId) ?? [], [catalog]);
  const childCategories = useMemo(() => catalog?.categories.filter((category) => category.parentId) ?? [], [catalog]);
  const activeAreas = useMemo(() => catalog?.areas.filter((area) => area.isActive) ?? [], [catalog]);
  const handoverBuildings = useMemo(() => catalog?.buildings.filter((building) => !handoverForm.areaId || building.areaId === handoverForm.areaId) ?? [], [catalog, handoverForm.areaId]);
  const recentTrends = useMemo(() => kpis?.trends
    .filter((trend) => [trend.posts, trend.claims, trend.appointments, trend.returns, trend.custody, trend.reports].some((value) => value > 0))
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 14) ?? [], [kpis]);
  const trendMax = useMemo(() => Math.max(1, ...recentTrends.flatMap((trend) => [trend.posts, trend.claims, trend.appointments, trend.returns, trend.custody, trend.reports])), [recentTrends]);
  const selectedExportSections = useMemo(() => (Object.entries(exportSections)
    .filter(([, enabled]) => enabled)
    .map(([section]) => section) as Array<"overview" | "trends" | "statusBreakdown">), [exportSections]);
  const reviewNeedsPost = reviewForm.actionType === "HIDE_POST" || reviewForm.actionType === "DELETE_POST";
  const reviewNeedsUser = reviewForm.actionType === "WARN_USER" || reviewForm.actionType === "BAN_USER" || reviewForm.actionType === "UNBAN_USER";

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
      status: user.status,
      reason: ""
    });
  }

  async function submitUser(event: FormEvent) {
    event.preventDefault();
    const audienceRole = userForm.audienceRole ? userForm.audienceRole as "STUDENT" | "LECTURER" : null;
    if (userEditingId) {
      if (await runUserAction("user", () => api.updateAdminUser(userEditingId, {
        email: userForm.email,
        fullName: userForm.fullName,
        studentCode: userForm.studentCode.trim() || null,
        phoneNumber: userForm.phoneNumber.trim() || null,
        accessRole: userForm.accessRole,
        status: userForm.status,
        reason: userForm.reason.trim() || null
      }), "Đã cập nhật người dùng")) resetUserForm();
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
      status: userForm.status,
      reason: userForm.reason.trim() || null
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
      isPublic: config.isPublic,
      reason: ""
    });
  }

  async function submitConfig(event: FormEvent) {
    event.preventDefault();
    const payload = {
      configKey: configForm.configKey,
      configValue: configForm.configValue,
      valueType: configForm.valueType,
      description: configForm.description.trim() || null,
      isPublic: configForm.isPublic,
      reason: configForm.reason.trim() || null
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

  async function viewConfigHistory(config: SystemConfig) {
    setPendingAction("config-history");
    setError("");
    try {
      const result = await api.getSystemConfigHistory(config.id);
      setHistoryConfig(config);
      setConfigHistory(result.items);
    } catch (reason) {
      setError(messageOf(reason, "Không thể tải lịch sử cấu hình"));
    } finally {
      setPendingAction("");
    }
  }

  function applyReportFilters(event: FormEvent) {
    event.preventDefault();
    void loadReports({ ...reportFilters, page: 1 });
  }

  function changeReportPage(delta: number) {
    const maxPage = Math.max(1, Math.ceil(reportTotal / reportFilters.pageSize));
    const page = Math.min(maxPage, Math.max(1, reportFilters.page + delta));
    if (page !== reportFilters.page) void loadReports({ ...reportFilters, page });
  }

  function applyKpiFilters(event: FormEvent) {
    event.preventDefault();
    void loadKpis(kpiFilters);
  }

  function selectReport(report: AdminModerationReport) {
    setSelectedReport(report);
    setReviewForm({
      actionType: "DISMISS_REPORT",
      reason: ""
    });
  }

  function changeReviewAction(actionType: ModerationActionType) {
    setReviewForm({
      ...reviewForm,
      actionType,
    });
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (!selectedReport) return;
    if (!window.confirm(`Áp dụng "${moderationActionLabels[reviewForm.actionType]}" cho report này?`)) return;
    setPendingAction("review");
    setError("");
    setNotice("");
    try {
      await api.reviewAdminReport(selectedReport.id, {
        actionType: reviewForm.actionType,
        reason: reviewForm.reason.trim()
      });
      setNotice("Đã ghi nhận quyết định moderation");
      setSelectedReport(null);
      setReviewForm(emptyReviewForm);
      await Promise.all([loadReports(reportFilters, true), loadKpis(kpiFilters, true), loadCatalog(true)]);
    } catch (reason) {
      setError(messageOf(reason, "Không thể xử lý report"));
    } finally {
      setPendingAction("");
    }
  }

  async function exportStatistics() {
    if (!selectedExportSections.length) {
      setError("Chọn ít nhất một phần dữ liệu để xuất");
      return;
    }
    setPendingAction("export");
    setError("");
    setNotice("");
    try {
      const result = await api.exportAdminStatistics({ ...kpiFilters, format: exportFormat, sections: selectedExportSections });
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice(`Đã xuất ${result.rowCount} dòng aggregate`);
    } catch (reason) {
      setError(messageOf(reason, "Không thể xuất thống kê"));
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
      <button type="button" className="secondary-button" onClick={() => void Promise.all([loadCatalog(), loadUsers(userFilters, true), loadConfigs(configFilters, true), loadReports(reportFilters, true), loadKpis(kpiFilters, true)]).finally(() => setPendingAction(""))} disabled={pendingAction === "load"}><RefreshCw size={17} /> Làm mới</button>
    </header>

    <div className="admin-stats" aria-label="Thống kê nhanh">
      <StatCard icon={<BarChart3 size={20} />} value={catalog?.stats.totalPosts ?? 0} label="Tổng bài đăng" />
      <StatCard icon={<Clock3 size={20} />} value={catalog?.stats.processingPosts ?? 0} label="Đang xử lý" />
      <StatCard icon={<UsersRound size={20} />} value={catalog?.stats.totalUsers ?? 0} label="Người dùng" />
      <StatCard icon={<CheckCircle2 size={20} />} value={catalog?.stats.returnedPosts ?? 0} label="Đã hoàn trả" />
    </div>

    <div className="admin-tabs" role="tablist" aria-label="Chức năng quản trị">
      <button type="button" className={activeTab === "operations" ? "active" : ""} onClick={() => setActiveTab("operations")}><ShieldCheck size={18} /> Vận hành</button>
      <button type="button" className={activeTab === "users" ? "active" : ""} onClick={() => setActiveTab("users")}><UsersRound size={18} /> Người dùng</button>
      <button type="button" className={activeTab === "configs" ? "active" : ""} onClick={() => setActiveTab("configs")}><Settings2 size={18} /> Cấu hình</button>
      <button type="button" className={activeTab === "categories" ? "active" : ""} onClick={() => setActiveTab("categories")}><FolderTree size={18} /> Danh mục</button>
      <button type="button" className={activeTab === "locations" ? "active" : ""} onClick={() => setActiveTab("locations")}><MapPinned size={18} /> Khu vực</button>
      <button type="button" className={activeTab === "handover" ? "active" : ""} onClick={() => setActiveTab("handover")}><Handshake size={18} /> Điểm bàn giao</button>
    </div>

    {notice && <p className="form-note admin-message">{notice}</p>}
    {error && <p className="form-error admin-message" role="alert">{error}</p>}

    {activeTab === "operations" && <div className="admin-operations-layout">
      <section className="admin-panel admin-panel--list admin-operations-dashboard">
        <div className="admin-list-heading">
          <div><p className="eyebrow">DASHBOARD KPI</p><h2>Chỉ số vận hành</h2></div>
          <strong>{kpis?.filters.days ?? 0} ngày</strong>
        </div>
        <form className="admin-reporting-filters" onSubmit={applyKpiFilters}>
          <label className="input-field"><span>Từ ngày</span><input type="date" value={kpiFilters.from} onChange={(event) => setKpiFilters({ ...kpiFilters, from: event.target.value })} required /></label>
          <label className="input-field"><span>Đến ngày</span><input type="date" value={kpiFilters.to} onChange={(event) => setKpiFilters({ ...kpiFilters, to: event.target.value })} required /></label>
          <button className="secondary-button" disabled={pendingAction === "kpis"}><Filter size={17} /> Lọc KPI</button>
        </form>

        <div className="admin-kpi-metrics">
          <article><BarChart3 size={18} /><strong>{kpis?.totals.posts ?? 0}</strong><span>Bài đăng</span></article>
          <article><FileText size={18} /><strong>{kpis?.totals.claims ?? 0}</strong><span>Claims</span></article>
          <article><Handshake size={18} /><strong>{kpis?.totals.appointments ?? 0}</strong><span>Lịch hẹn</span></article>
          <article><CheckCircle2 size={18} /><strong>{kpis?.totals.returns ?? 0}</strong><span>Hoàn trả</span></article>
        </div>
        <div className="admin-kpi-snapshot"><p className="eyebrow">SNAPSHOT HIỆN TẠI</p><div className="admin-kpi-metrics">
          <article><Clock3 size={18} /><strong>{kpis?.snapshot.openPosts ?? 0}</strong><span>Đang mở</span></article>
          <article><Layers3 size={18} /><strong>{kpis?.snapshot.custodyItems ?? 0}</strong><span>Custody</span></article>
          <article><AlertTriangle size={18} /><strong>{kpis?.snapshot.unresolvedReports ?? 0}</strong><span>Report mở</span></article>
        </div></div>

        <div className="admin-trend-table-wrap">
          <table className="admin-trend-table">
            <thead><tr><th>Ngày</th><th>Bài</th><th>Claim</th><th>Lịch</th><th>Return</th><th>Custody</th><th>Report</th></tr></thead>
            <tbody>
              {recentTrends.map((trend) => <tr key={trend.date}>
                <td>{new Date(`${trend.date}T00:00:00`).toLocaleDateString("vi-VN")}</td>
                {(["posts", "claims", "appointments", "returns", "custody", "reports"] as const).map((metric) => <td key={metric}>
                  <span className="admin-trend-value">{trend[metric]}</span>
                  <i className="admin-trend-bar"><b style={{ width: `${Math.max(3, trend[metric] / trendMax * 100)}%` }} /></i>
                </td>)}
              </tr>)}
              {!recentTrends.length && <tr><td colSpan={7} className="admin-empty-cell">Chưa có dữ liệu KPI</td></tr>}
            </tbody>
          </table>
        </div>

        {kpis && <div className="admin-breakdown-grid">
          {(Object.entries(kpis.statusBreakdown) as Array<[keyof AdminDashboardKpis["statusBreakdown"], Array<{ status: string; total: number }>] >).map(([group, items]) => <article key={group}>
            <strong>{group}</strong>
            {items.length ? items.map((item) => <span key={item.status}>{item.status}<b>{item.total}</b></span>) : <span>NONE<b>0</b></span>}
          </article>)}
        </div>}
      </section>

      <aside className="admin-panel admin-panel--form admin-export-panel">
        <div className="admin-panel-heading">
          <span><Download size={18} /></span>
          <div><p className="eyebrow">EXPORT</p><h2>Xuất thống kê</h2></div>
        </div>
        <div className="admin-form">
          <label className="input-field"><span>Định dạng</span><select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as "CSV" | "JSON")}>
            <option value="CSV">CSV</option>
            <option value="JSON">JSON</option>
          </select></label>
          <div className="admin-export-sections">
            {exportSectionKeys.map((section) => <label className="admin-check" key={section}>
              <input type="checkbox" checked={exportSections[section]} onChange={(event) => setExportSections({ ...exportSections, [section]: event.target.checked })} />
              <span>{exportSectionLabels[section]}</span>
            </label>)}
          </div>
          <button type="button" className="primary-button" onClick={() => void exportStatistics()} disabled={pendingAction === "export"}><Download size={17} /> Xuất file</button>
        </div>
      </aside>

      <section className="admin-panel admin-panel--list admin-reports-panel">
        <div className="admin-list-heading"><div><p className="eyebrow">MODERATION</p><h2>Hàng đợi report</h2></div><strong>{reportTotal}</strong></div>
        <form className="admin-reporting-filters admin-reporting-filters--reports" onSubmit={applyReportFilters}>
          <label className="input-field"><span>Tìm kiếm</span><input value={reportFilters.q} onChange={(event) => setReportFilters({ ...reportFilters, q: event.target.value })} placeholder="Lý do, report text, tiêu đề..." /></label>
          <label className="input-field"><span>Trạng thái</span><select value={reportFilters.status} onChange={(event) => setReportFilters({ ...reportFilters, status: event.target.value as AdminReportStatus | "" })}>
            <option value="">Tất cả</option>
            <option value="PENDING">Chờ xử lý</option>
            <option value="REVIEWED">Đã xử lý</option>
            <option value="DISMISSED">Đã bỏ qua</option>
          </select></label>
          <label className="input-field"><span>Loại</span><select value={reportFilters.entityType} onChange={(event) => setReportFilters({ ...reportFilters, entityType: event.target.value as AdminReportEntityType | "" })}>
            <option value="">Tất cả</option>
            <option value="POST">Bài đăng</option>
            <option value="USER">Người dùng</option>
            <option value="CLAIM">Claim</option>
            <option value="CHAT">Chat</option>
          </select></label>
          <button className="secondary-button" disabled={pendingAction === "reports"}><Filter size={17} /> Lọc</button>
        </form>

        <div className="admin-user-table-wrap">
          <table className="admin-user-table admin-report-table">
            <thead><tr><th>Report</th><th>Đối tượng</th><th>Trạng thái</th><th>Thời gian</th><th></th></tr></thead>
            <tbody>
              {reports.map((report) => <tr key={report.id}>
                <td>
                  <strong>{report.reason}</strong>
                  <span>{report.details || "Không có mô tả thêm"}</span>
                  <small>{report.reporter.fullName} / {report.reporter.email}</small>
                </td>
                <td>
                  <strong>{reportEntityLabels[report.entityType]}</strong>
                  <span>{report.entity.title || report.entityId}</span>
                  <small>{report.entity.status || "Không rõ"}{report.entity.ownerName ? ` / ${report.entity.ownerName}` : ""}</small>
                </td>
                <td><ReportStatusBadge status={report.status} /></td>
                <td>{new Date(report.createdAt).toLocaleString("vi-VN")}</td>
                <td><button type="button" className="secondary-button" onClick={() => selectReport(report)} disabled={report.status !== "PENDING"}><ShieldCheck size={17} /> Review</button></td>
              </tr>)}
              {!reports.length && <tr><td colSpan={5} className="admin-empty-cell">Không có report phù hợp</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <button type="button" className="secondary-button" onClick={() => changeReportPage(-1)} disabled={reportFilters.page <= 1}>Trước</button>
          <span>Trang {reportFilters.page} / {Math.max(1, Math.ceil(reportTotal / reportFilters.pageSize))}</span>
          <button type="button" className="secondary-button" onClick={() => changeReportPage(1)} disabled={reportFilters.page >= Math.max(1, Math.ceil(reportTotal / reportFilters.pageSize))}>Sau</button>
        </div>
      </section>

      <aside className="admin-panel admin-panel--form admin-review-panel">
        <div className="admin-panel-heading">
          <span><ShieldCheck size={18} /></span>
          <div><p className="eyebrow">ACTION</p><h2>Xác nhận moderation</h2></div>
        </div>
        {selectedReport ? <form className="admin-form" onSubmit={submitReview}>
          <div className="admin-selected-report">
            <strong>{reportEntityLabels[selectedReport.entityType]} / {selectedReport.reason}</strong>
            <span>{selectedReport.entity.title || selectedReport.entityId}</span>
          </div>
          <label className="input-field"><span>Hành động</span><select value={reviewForm.actionType} onChange={(event) => changeReviewAction(event.target.value as ModerationActionType)}>
            {(selectedReport ? moderationActionsForReport(selectedReport) : ["DISMISS_REPORT"] as ModerationActionType[]).map((action) => <option key={action} value={action}>{moderationActionLabels[action]}</option>)}
          </select></label>
          {(reviewNeedsPost || reviewNeedsUser) && <div className="admin-selected-report"><strong>Đối tượng được suy ra từ report</strong><span>{selectedReport.entity.title || selectedReport.entityId}</span><small>{selectedReport.entity.ownerName ? `Chủ bài đăng: ${selectedReport.entity.ownerName}` : `ID: ${selectedReport.entityId}`}</small></div>}
          <label className="input-field"><span>Lý do</span><textarea rows={4} value={reviewForm.reason} onChange={(event) => setReviewForm({ ...reviewForm, reason: event.target.value })} required maxLength={255} /></label>
          <div className="admin-form-actions">
            <button type="button" className="secondary-button" onClick={() => setSelectedReport(null)}><X size={17} /> Hủy</button>
            <button className="primary-button" disabled={pendingAction === "review"}><ShieldCheck size={17} /> Ghi nhận</button>
          </div>
        </form> : <div className="admin-empty admin-empty--compact"><ShieldCheck size={28} /><strong>Chưa chọn report</strong></div>}
      </aside>
    </div>}

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
          <label className="input-field"><span>Lý do thay đổi</span><input value={userForm.reason} onChange={(event) => setUserForm({ ...userForm, reason: event.target.value })} placeholder="Không bắt buộc" /></label>
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
          <label className="input-field"><span>Lý do thay đổi</span><input value={configForm.reason} onChange={(event) => setConfigForm({ ...configForm, reason: event.target.value })} placeholder="Không bắt buộc" /></label>
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
                     <button type="button" className="admin-icon-button" title="Xem lịch sử" aria-label="Xem lịch sử" onClick={() => void viewConfigHistory(config)} disabled={pendingAction === "config-history"}><Clock3 size={16} /></button>
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
       {historyConfig && <section className="admin-panel admin-panel--list admin-config-history">
         <div className="admin-list-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h2>Lịch sử {historyConfig.configKey}</h2></div><button type="button" className="admin-icon-button" title="Đóng lịch sử" aria-label="Đóng lịch sử" onClick={() => setHistoryConfig(null)}><X size={17} /></button></div>
         {!configHistory.length && <p className="admin-list-intro">Chưa có bản ghi lịch sử.</p>}
         {configHistory.length > 0 && <div className="admin-history-list">{configHistory.map((entry) => <article key={entry.id} className="admin-history-entry">
           <div><strong>{entry.action}</strong><span>{new Date(entry.changedAt).toLocaleString("vi-VN")}</span></div>
           <p>{entry.reason || "Không ghi lý do"}</p>
           <small>Actor: {entry.changedBy}</small>
         </article>)}</div>}
       </section>}
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
