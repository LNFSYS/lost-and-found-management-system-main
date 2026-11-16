import { CalendarDays, Files, FileUser, Home, LayoutDashboard, LogOut, MessageCircle, ShieldCheck, UserRound } from "lucide-react";
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
  const viewingChat = /^\/claims(?:\/[^/]+)?\/?$/.test(location.pathname);
  return <div className={`app-shell${viewingChat ? " app-shell--chat" : ""}`}>
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
    {!viewingChat && (
      <footer className="app-footer">
        <div className="app-footer__content">
          <div className="app-footer__brand">
            <span className="brand-mark"><i>F</i><i>P</i><i>T</i></span>
            <div>
              <strong>FPTU Lost &amp; Found</strong>
              <small>Hệ thống Hỗ trợ Đồ Thất Lạc · ĐH FPT Đà Nẵng</small>
            </div>
          </div>
          <nav className="app-footer__links" aria-label="Liên kết chân trang">
            <Link to="/privacy-policy" className="app-footer__link">
              <ShieldCheck size={16} /> Chính sách quyền riêng tư
            </Link>
            <Link to="/posts" className="app-footer__link">Tất cả bài đăng</Link>
            <Link to="/reports" className="app-footer__link">Báo cáo &amp; Phản ánh</Link>
          </nav>
          <div className="app-footer__legal">
            <span>© 2026 Phòng Dịch vụ Sinh viên (DVSV) FPTU Đà Nẵng</span>
            <span>Căn cứ Điều 230 BLDS 2015 &amp; Nghị định 13/2023/NĐ-CP (PDPD)</span>
          </div>
        </div>
      </footer>
    )}
  </div>;
}
