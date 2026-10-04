import { FileText, FolderTree, Globe2, Handshake, LogOut, MapPinned, Settings2, ShieldCheck, UsersRound, Warehouse } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { useNetworkStatus } from "../hooks/use-network-status";

export const adminTabs = [
  { id: "operations", label: "Vận hành", icon: ShieldCheck },
  { id: "moderation", label: "Moderation", icon: FileText },
  { id: "users", label: "Người dùng", icon: UsersRound },
  { id: "configs", label: "Cấu hình", icon: Settings2 },
  { id: "categories", label: "Danh mục", icon: FolderTree },
  { id: "locations", label: "Khu vực", icon: MapPinned },
  { id: "handover", label: "Điểm bàn giao", icon: Handshake }
] as const;
export type AdminTab = typeof adminTabs[number]["id"];

export function selectedAdminTab(value: string | null): AdminTab {
  return adminTabs.find(tab => tab.id === value)?.id ?? "operations";
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { online } = useNetworkStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isAdmin = user?.roles.includes("ADMIN");
  const activeTab = location.pathname === "/admin" ? selectedAdminTab(searchParams.get("tab")) : null;

  return <div className="admin-console">
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <span className="brand-mark" aria-hidden="true"><i>F</i><i>P</i><i>T</i></span>
        <span><strong>LNFS Admin</strong><small>Trung tâm quản trị</small></span>
      </div>
      <nav className="admin-tabs" aria-label="Chức năng quản trị">
        {isAdmin && adminTabs.map(tab => <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => navigate(`/admin?tab=${tab.id}`)}>
          <tab.icon size={18} /><span>{tab.label}</span>
        </button>)}
        <NavLink to="/admin/staff"><Warehouse size={18} /><span>Khu vực nội bộ</span></NavLink>
      </nav>
      <div className="admin-sidebar__account">
        <span>{user?.fullName.slice(0, 1).toUpperCase()}</span>
        <div><strong>{user?.fullName}</strong><small>{user?.email}</small></div>
        <button type="button" title="Đăng xuất" aria-label="Đăng xuất" onClick={() => void logout().catch(() => undefined)}><LogOut size={18} /></button>
      </div>
    </aside>
    <main className="admin-main">
      <header className="admin-workspace-bar">
        <span><ShieldCheck size={17} /> {isAdmin ? "Quản trị" : "Nội bộ"}</span>
        <Link className="secondary-button" to="/home"><Globe2 size={18} /> Giao diện người dùng</Link>
      </header>
      {!online && <div className="offline-banner" role="status">Bạn đang offline. Thao tác gửi mới cần kết nối mạng.</div>}
      <Outlet />
    </main>
  </div>;
}
