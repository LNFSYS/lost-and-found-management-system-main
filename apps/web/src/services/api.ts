export type Role = "USER" | "STUDENT" | "LECTURER" | "STAFF" | "ADMIN";
export interface CurrentUser { id: string; email: string; fullName: string; studentCode: string | null; phoneNumber: string | null; roles: Role[]; status: "ACTIVE" | "DISABLED"; createdAt: string; updatedAt: string; }
export interface AdminCategory { id: string; name: string; icon: string | null; parentId: string | null; parentName: string | null; isActive: boolean; sortOrder: number; childCount: number; createdAt: string; }
export interface AdminArea { id: string; name: string; description: string | null; isActive: boolean; sortOrder: number; buildingCount: number; createdAt: string; }
export interface AdminBuilding { id: string; areaId: string; areaName: string; name: string; isActive: boolean; sortOrder: number; createdAt: string; }
export interface AdminCatalog { stats: { totalPosts: number; processingPosts: number; totalUsers: number; returnedPosts: number }; categories: AdminCategory[]; areas: AdminArea[]; buildings: AdminBuilding[]; }
export type AdminCategoryPayload = { name?: string; icon?: string | null; parentId?: string | null; isActive?: boolean; sortOrder?: number };
export type AdminAreaPayload = { name?: string; description?: string | null; isActive?: boolean; sortOrder?: number };
export type AdminBuildingPayload = { name?: string; areaId?: string; isActive?: boolean; sortOrder?: number };
interface SessionResponse { user: CurrentUser; accessToken: string; accessTokenExpiresIn: string; }

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";
let accessToken: string | null = null;
let refreshInFlight: Promise<SessionResponse | null> | null = null;

async function raw<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retry && path !== "/auth/refresh") {
    const session = await refreshSession();
    if (session) return raw<T>(path, init, false);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(payload.message ?? "Yêu cầu không thành công");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = raw<SessionResponse>("/auth/refresh", { method: "POST" }, false)
      .then((session) => { accessToken = session.accessToken; return session; })
      .catch(() => { accessToken = null; return null; })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

function storeSession(session: SessionResponse) { accessToken = session.accessToken; return session.user; }

export const api = {
  requestRegistrationOtp: (email: string) => raw<{ delivered: boolean; expiresInMinutes: number }>("/auth/register/request-otp", { method: "POST", body: JSON.stringify({ email }) }),
  register: async (payload: { email: string; otp: string; password: string; fullName: string; audienceRole: "STUDENT" | "LECTURER"; studentCode?: string; phoneNumber?: string }) => storeSession(await raw<SessionResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) })),
  login: async (email: string, password: string) => storeSession(await raw<SessionResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })),
  logout: async () => { await raw<void>("/auth/logout", { method: "POST" }); accessToken = null; },
  forgotPassword: (email: string) => raw<{ delivered: boolean; message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (email: string, token: string, newPassword: string) => raw<{ reset: boolean }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ email, token, newPassword }) }),
  me: () => raw<{ user: CurrentUser }>("/auth/me").then((payload) => payload.user),
  updateProfile: (payload: Partial<Pick<CurrentUser, "fullName" | "studentCode" | "phoneNumber">>) => raw<{ user: CurrentUser }>("/auth/profile", { method: "PATCH", body: JSON.stringify(payload) }).then((result) => result.user),
  getAdminCatalog: () => raw<AdminCatalog>("/admin/catalog"),
  createAdminCategory: (payload: Required<Pick<AdminCategoryPayload, "name">> & AdminCategoryPayload) => raw<AdminCategory>("/admin/categories", { method: "POST", body: JSON.stringify(payload) }),
  updateAdminCategory: (id: string, payload: AdminCategoryPayload) => raw<AdminCategory>(`/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAdminCategory: (id: string) => raw<void>(`/admin/categories/${id}`, { method: "DELETE" }),
  createAdminArea: (payload: Required<Pick<AdminAreaPayload, "name">> & AdminAreaPayload) => raw<AdminArea>("/admin/areas", { method: "POST", body: JSON.stringify(payload) }),
  updateAdminArea: (id: string, payload: AdminAreaPayload) => raw<AdminArea>(`/admin/areas/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAdminArea: (id: string) => raw<void>(`/admin/areas/${id}`, { method: "DELETE" }),
  createAdminBuilding: (payload: Required<Pick<AdminBuildingPayload, "name" | "areaId">> & AdminBuildingPayload) => raw<AdminBuilding>("/admin/buildings", { method: "POST", body: JSON.stringify(payload) }),
  updateAdminBuilding: (id: string, payload: AdminBuildingPayload) => raw<AdminBuilding>(`/admin/buildings/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAdminBuilding: (id: string) => raw<void>(`/admin/buildings/${id}`, { method: "DELETE" })
};
