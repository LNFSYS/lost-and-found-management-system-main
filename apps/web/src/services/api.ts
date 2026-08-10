export type Role = "USER" | "STUDENT" | "LECTURER" | "STAFF" | "ADMIN";
export interface CurrentUser { id: string; email: string; fullName: string; studentCode: string | null; phoneNumber: string | null; roles: Role[]; status: "ACTIVE" | "DISABLED"; createdAt: string; updatedAt: string; }
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
  updateProfile: (payload: Partial<Pick<CurrentUser, "fullName" | "studentCode" | "phoneNumber">>) => raw<{ user: CurrentUser }>("/auth/profile", { method: "PATCH", body: JSON.stringify(payload) }).then((result) => result.user)
};
