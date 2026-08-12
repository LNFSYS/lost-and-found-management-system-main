import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { RouteGuard } from "./components/route-guard";
import { AuthProvider } from "./context/auth-context";
import { ForgotPasswordPage, ResetPasswordPage } from "./pages/forgot-password-page";
import { AdminPage } from "./pages/admin-page";
import { LoginPage } from "./pages/login-page";
import { ProfilePage } from "./pages/profile-page";
import { RegisterPage } from "./pages/register-page";
import { StaffPage } from "./pages/staff-page";
import "./styles.css";

const HomePage = lazy(async () => {
  const module = await import("./pages/home-page");
  return { default: module.HomePage };
});

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
            <Route element={<AppLayout />}>
              <Route path="/home" element={<Suspense fallback={<main className="center-state">Đang mở hành trình...</main>}><HomePage /></Suspense>} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route element={<RouteGuard roles={["STAFF", "ADMIN"]} />}>
                <Route path="/staff" element={<StaffPage />} />
              </Route>
              <Route element={<RouteGuard roles={["ADMIN"]} />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
