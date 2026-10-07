import { CalendarDays, Files, FileUser, Home, LayoutDashboard, LogOut, MessageCircle, UserRound } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useAuth } from "../context/auth-context";
import { useNetworkStatus } from "../hooks/use-network-status";
import { NotificationCenter } from "./notification-center";

export function AppLayout() {
  const { user, logout } = useAuth();
  const { online } = useNetworkStatus();
  const location = useLocation();
  const navigation=useRef<HTMLElement>(null);
  useEffect(()=>{
    const nav=navigation.current;const active=nav?.querySelector<HTMLElement>(".active");
    if(!nav||!active)return;
    const bounds=nav.getBoundingClientRect();const item=active.getBoundingClientRect();
    if(item.right>bounds.right)nav.scrollLeft+=item.right-bounds.right;
    else if(item.left<bounds.left)nav.scrollLeft-=bounds.left-item.left;
  },[location.pathname]);
  const isAdmin = user?.roles.includes("ADMIN");
  const hasAdminWorkspace = user?.roles.some(role => role === "STAFF" || role === "ADMIN");
  const viewingOwnMatch = /^\/posts\/[^/]+\/matches$/.test(location.pathname);
  return <div className="app-shell">
    <header className="topbar">
      <Link className="brand" to="/home"><span className="brand-mark"><i>F</i><i>P</i><i>T</i></span><span>Lost &amp; Found<small>FPTU Đà Nẵng</small></span></Link>
      <nav ref={navigation} aria-label="Điều hướng chính">
        <NavLink to="/home"><Home size={18} /> Trang chủ</NavLink>
        <NavLink to="/posts" end><Files size={18} /> Bài đăng</NavLink>
        <NavLink to="/my-posts" className={({ isActive }) => isActive || viewingOwnMatch ? "active" : undefined}><FileUser size={18} /> Bài của tôi</NavLink>
        <NavLink to="/profile"><UserRound size={18} /> Hồ sơ</NavLink>
        {hasAdminWorkspace && <NavLink to={isAdmin ? "/admin" : "/admin/staff"} title="Chuyển sang quản trị"><LayoutDashboard size={18} /> Quản trị</NavLink>}
        <NavLink to="/claims"><MessageCircle size={18} /> Trao đổi riêng</NavLink>
        <NavLink to="/appointments"><CalendarDays size={18} /> Lịch hẹn</NavLink>
      </nav>
      <div className="topbar-actions"><NotificationCenter /><button className="icon-text-button" onClick={() => { void logout().catch(() => undefined); }}><LogOut size={18} /> Đăng xuất</button></div>
    </header>
    {!online && <div className="offline-banner" role="status">Bạn đang offline. Ứng dụng chỉ hiển thị giao diện hoặc dữ liệu đã lưu tạm; thao tác gửi mới cần kết nối mạng.</div>}
    <main className="workspace"><Outlet /></main>
  </div>;
}
