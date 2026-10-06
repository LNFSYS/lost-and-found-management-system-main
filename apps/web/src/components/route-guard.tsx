import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import type { Role } from "../services/api";

export function RouteGuard({ roles }: { roles?: Role[] }) {
  const { user, ready, sessionError, retryAt, retrySession } = useAuth();
  const location = useLocation();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!sessionError) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [sessionError, retryAt]);
  if (!ready && sessionError) return <main className="center-state auth-recovery">
    <p role="alert">{sessionError}</p>
    <p>Chưa thể khôi phục phiên. Trang này chưa được mở; bạn có thể thử lại.</p>
    <button className="secondary-button" disabled={now < retryAt} onClick={retrySession}><RotateCw size={18} />{now < retryAt ? `Thử lại sau ${Math.ceil((retryAt - now) / 1000)} giây` : "Thử lại"}</button>
    <Link to="/login">Đăng nhập lại</Link>
  </main>;
  if (!ready) return <main className="center-state">Đang khôi phục phiên đăng nhập...</main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !user.roles.some((role) => roles.includes(role))) return <Navigate to="/home" replace />;
  return <Outlet />;
}
