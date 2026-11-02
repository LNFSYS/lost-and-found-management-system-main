import axios, { AxiosHeaders, create, isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "lnfs.access-token";
const CACHED_USER_KEY = "lnfs.cached-user";
const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE_URL = (configuredBaseUrl || "http://localhost:3001/api").replace(/\/+$/, "");

export interface MobileUser {
  id: string;
  email: string;
  fullName: string;
  studentCode: string | null;
  phoneNumber: string | null;
  avatar: { hasAvatar: boolean; updatedAt: string | null };
  status: "ACTIVE" | "DISABLED";
  roles: ("USER" | "STUDENT" | "LECTURER" | "STAFF" | "ADMIN")[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionResponse {
  accessToken: string;
  accessTokenExpiresIn: string;
  user: MobileUser;
}

interface RetryableRequest extends InternalAxiosRequestConfig {
  _authRetry?: boolean;
}

const authExpiredListeners = new Set<() => void>();
let refreshInFlight: Promise<SessionResponse> | null = null;

export const tokenStorage = {
  get: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
};

export const cachedUserStorage = {
  async get(): Promise<MobileUser | null> {
    const value = await SecureStore.getItemAsync(CACHED_USER_KEY);
    if (!value) return null;
    try {
      return JSON.parse(value) as MobileUser;
    } catch {
      await SecureStore.deleteItemAsync(CACHED_USER_KEY);
      return null;
    }
  },
  set: (user: MobileUser) => SecureStore.setItemAsync(CACHED_USER_KEY, JSON.stringify(user)),
  clear: () => SecureStore.deleteItemAsync(CACHED_USER_KEY),
};

export function subscribeAuthExpired(listener: () => void) {
  authExpiredListeners.add(listener);
  return () => authExpiredListeners.delete(listener);
}

function notifyAuthExpired() {
  authExpiredListeners.forEach((listener) => listener());
}

function isAuthEndpoint(url = "") {
  return /\/auth\/(?:login|register|refresh|logout)(?:\?|$)/.test(url);
}

async function renewSession() {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post<SessionResponse>(`${API_BASE_URL}/auth/refresh`, undefined, { timeout: 20_000, withCredentials: true })
      .then(async ({ data }) => {
        await Promise.all([tokenStorage.set(data.accessToken), cachedUserStorage.set(data.user)]);
        return data;
      })
      .catch(async (error: unknown) => {
        if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          await Promise.all([tokenStorage.clear(), cachedUserStorage.clear()]);
          notifyAuthExpired();
        }
        throw error;
      })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export const api = create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get();
  const headers = AxiosHeaders.from(config.headers);
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  config.headers = headers;
  return config;
});

api.interceptors.response.use(
  async (response) => {
    const { accessToken, user } = (response.data ?? {}) as Partial<SessionResponse>;
    if (accessToken && user && /\/auth\/(?:login|register|refresh)(?:\?|$)/.test(response.config.url ?? "")) {
      await Promise.all([tokenStorage.set(accessToken), cachedUserStorage.set(user)]);
    }
    return response;
  },
  async (error: AxiosError) => {
    const request = error.config as RetryableRequest | undefined;
    if (error.response?.status !== 401 || !request || isAuthEndpoint(request.url)) return Promise.reject(error);
    if (request._authRetry) {
      await Promise.all([tokenStorage.clear(), cachedUserStorage.clear()]).catch(() => undefined);
      notifyAuthExpired();
      return Promise.reject(error);
    }
    const headers = AxiosHeaders.from(request.headers);
    if (!headers.has("Authorization")) return Promise.reject(error);

    request._authRetry = true;
    try {
      const session = await renewSession();
      headers.set("Authorization", `Bearer ${session.accessToken}`);
      request.headers = headers;
      return api.request(request);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

function mediaApiPath(path: string) {
  const base = new URL(API_BASE_URL);
  const url = new URL(path, `${API_BASE_URL}/`);
  if (url.origin !== base.origin) throw new Error("Authenticated media must use the configured API host.");
  const basePath = base.pathname.replace(/\/+$/, "");
  let endpoint = url.pathname;
  if (endpoint.startsWith(`${basePath}/`)) endpoint = endpoint.slice(basePath.length);
  else if (endpoint === basePath) endpoint = "/";
  else if (basePath.endsWith("/api") && endpoint.startsWith("/api/")) endpoint = endpoint.slice(4);
  return `${endpoint}${url.search}`;
}

export async function mediaBlob(path: string): Promise<Blob> {
  const response = await api.get<Blob>(mediaApiPath(path), { responseType: "blob" });
  return response.data;
}

export function isNetworkError(error: unknown): error is AxiosError {
  return isAxiosError(error) && !error.response && error.code !== "ERR_CANCELED";
}

export function getApiErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === "string" && message.trim()) return message;
    if (!error.response) return "Không thể kết nối máy chủ. Hãy kiểm tra mạng và thử lại.";
  }
  return error instanceof Error ? error.message : "Đã có lỗi xảy ra. Vui lòng thử lại.";
}
