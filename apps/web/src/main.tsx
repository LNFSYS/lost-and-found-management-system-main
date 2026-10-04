import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { AdminLayout } from "./components/admin-layout";
import { RouteGuard } from "./components/route-guard";
import { AuthProvider, useAuth } from "./context/auth-context";
import { ForgotPasswordPage, ResetPasswordPage } from "./pages/forgot-password-page";
import { AdminPage } from "./pages/admin-page";
import { LoginPage } from "./pages/login-page";
import { ProfilePage } from "./pages/profile-page";
import { NotificationPreferencesPage } from "./pages/notification-preferences-page";
import { NotificationsPage } from "./pages/notifications-page";
import { RegisterPage } from "./pages/register-page";
import { StaffPage } from "./pages/staff-page";
import { PostsPage } from "./pages/posts-page";
import { PostDetailPage } from "./pages/post-detail-page";
import { PostMatchesPage } from "./pages/post-matches-page";
import { registerServiceWorker } from "./pwa";
import { ClaimsPage } from "./pages/claims-page";
import { ReportsPage } from "./pages/reports-page";
import "./styles.css";

registerServiceWorker();

const HomePage = lazy(async () => {
  const module = await import("./pages/home-page");
  return { default: module.HomePage };
});

function AdminHome() {
  const { user } = useAuth();
  return user?.roles.includes("ADMIN") ? <AdminPage /> : <Navigate to="/admin/staff" replace />;
}

function StaffRedirect() {
  const location = useLocation();
  return <Navigate to={`/admin/staff${location.search}${location.hash}`} replace />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<RouteGuard />}>
            <Route element={<RouteGuard roles={["STAFF", "ADMIN"]} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminHome />} />
                <Route path="/admin/staff" element={<StaffPage />} />
              </Route>
              <Route path="/staff" element={<StaffRedirect />} />
            </Route>
            <Route element={<AppLayout />}>
              <Route path="/home" element={<Suspense fallback={<main className="center-state">Đang mở hành trình...</main>}><HomePage /></Suspense>} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/notification-preferences" element={<NotificationPreferencesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/posts" element={<PostsPage />} />
              <Route path="/my-posts" element={<PostsPage initialTab="mine" />} />
              <Route path="/posts/:postId/matches" element={<PostMatchesPage />} />
              <Route path="/posts/:postId" element={<PostDetailPage />} />
              <Route path="/claims" element={<ClaimsPage />} />
              <Route path="/claims/:claimId" element={<ClaimsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
