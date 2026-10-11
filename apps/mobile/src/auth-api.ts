export type AccountRole = "USER" | "STUDENT" | "LECTURER" | "STAFF" | "ADMIN";
export type AudienceRole = "STUDENT" | "LECTURER";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  studentCode: string | null;
  status: "ACTIVE" | "DISABLED";
  roles: AccountRole[];
}

export interface MobileSession {
  user: AuthUser;
  accessToken: string;
  accessTokenExpiresIn: string;
  refreshToken: string;
}

export class AuthApiError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "AuthApiError";
  }
}

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const apiUrl = (configuredUrl || (__DEV__ ? "http://10.0.2.2:3001/api" : "")).replace(/\/+$/, "");

async function request<T>(path: string, body?: unknown, accessToken?: string): Promise<T> {
  if (!apiUrl) {
    throw new AuthApiError("Ứng dụng chưa được cấu hình địa chỉ API. Hãy liên hệ quản trị viên.");
  }
  if (!__DEV__ && !apiUrl.startsWith("https://")) {
    throw new AuthApiError("Ứng dụng bản phát hành chỉ kết nối tới API bảo mật HTTPS.");
  }
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch {
    throw new AuthApiError("Không thể kết nối máy chủ. Hãy kiểm tra mạng và địa chỉ API.");
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : "Yêu cầu chưa thể hoàn tất. Vui lòng thử lại.";
    throw new AuthApiError(message, response.status);
  }
  return payload as T;
}

export const authApi = {
  requestRegistrationOtp(email: string) {
    return request<{ delivered: boolean; expiresInMinutes: number }>("/auth/register/request-otp", { email });
  },
  register(input: {
    email: string;
    password: string;
    fullName: string;
    audienceRole: AudienceRole;
    otp: string;
    studentCode?: string;
  }) {
    return request<MobileSession>("/auth/mobile/register", input);
  },
  login(email: string, password: string) {
    return request<MobileSession>("/auth/mobile/login", { email, password });
  },
  refresh(refreshToken: string) {
    return request<MobileSession>("/auth/mobile/refresh", { refreshToken });
  },
  logout(refreshToken: string) {
    return request<void>("/auth/mobile/logout", { refreshToken });
  },
  me(accessToken: string) {
    return request<{ user: AuthUser }>("/auth/me", undefined, accessToken);
  },
  requestPasswordReset(email: string) {
    return request<{ delivered: boolean; message?: string }>("/auth/forgot-password", { email });
  },
  resetPassword(email: string, token: string, newPassword: string) {
    return request<{ reset: boolean }>("/auth/reset-password", { email, token, newPassword });
  }
};
