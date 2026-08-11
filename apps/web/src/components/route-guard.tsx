import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import type { Role } from "../services/api";

export function RouteGuard({ roles }: { roles?: Role[] }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <main className="center-state">Đang khôi phục phiên đăng nhập...</main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !user.roles.some((role) => roles.includes(role))) return <Navigate to="/home" replace />;
  return <Outlet />;
}
