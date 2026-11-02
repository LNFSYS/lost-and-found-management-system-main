import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { isAxiosError } from "axios";
import { api, cachedUserStorage, isNetworkError, subscribeAuthExpired, tokenStorage, type MobileUser, type SessionResponse } from "@/services/api";

export interface LoginCredentials { email: string; password: string }
export interface RegisterPayload extends LoginCredentials { fullName: string; otp: string; audienceRole: "STUDENT" | "LECTURER" }
export interface ProfileUpdate { fullName?: string; studentCode?: string | null; phoneNumber?: string | null }
export interface AvatarUpload { uri: string; name: string; type: string }

interface AuthContextValue {
  user: MobileUser | null;
  isHydrating: boolean;
  login: (credentials: LoginCredentials) => Promise<MobileUser>;
  register: (payload: RegisterPayload) => Promise<MobileUser>;
  refreshSession: () => Promise<MobileUser | null>;
  logout: () => Promise<void>;
  updateProfile: (profile: ProfileUpdate) => Promise<MobileUser>;
  updateAvatar: (image: AvatarUpload) => Promise<MobileUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const saveSession = useCallback(async (session: Pick<SessionResponse, "accessToken" | "user">) => {
    await Promise.all([tokenStorage.set(session.accessToken), cachedUserStorage.set(session.user)]);
    setUser(session.user);
    return session.user;
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const { data } = await api.post<SessionResponse>("/auth/login", credentials);
    return saveSession(data);
  }, [saveSession]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { data } = await api.post<SessionResponse>("/auth/register", payload);
    return saveSession(data);
  }, [saveSession]);

  const refreshSession = useCallback(async () => {
    let accessToken: string | null;
    let cachedUser: MobileUser | null;
    try {
      accessToken = await tokenStorage.get();
      cachedUser = await cachedUserStorage.get();
    } catch {
      setUser(null);
      return null;
    }
    if (accessToken && cachedUser) setUser(cachedUser);
    if (!accessToken) {
      await cachedUserStorage.clear().catch(() => undefined);
      setUser(null);
      return null;
    }

    try {
      const { data } = await api.get<{ user: MobileUser }>("/auth/me");
      await cachedUserStorage.set(data.user);
      setUser(data.user);
      return data.user;
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (accessToken && cachedUser && (isNetworkError(error) || (status !== undefined && status >= 500))) return cachedUser;
      await Promise.all([tokenStorage.clear(), cachedUserStorage.clear()]).catch(() => undefined);
      setUser(null);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", undefined, { timeout: 5_000 });
    } catch {
      // The local session must still be removed when the device is offline.
    } finally {
      await Promise.all([tokenStorage.clear(), cachedUserStorage.clear()]).catch(() => undefined);
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (profile: ProfileUpdate) => {
    const { data } = await api.patch<{ user: MobileUser }>("/auth/profile", profile);
    await cachedUserStorage.set(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const updateAvatar = useCallback(async (image: AvatarUpload) => {
    const formData = new FormData();
    formData.append("file", { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    const { data } = await api.patch<{ user: MobileUser }>("/auth/profile/avatar", formData);
    await cachedUserStorage.set(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeAuthExpired(() => { if (active) setUser(null); });
    const timer = setTimeout(() => {
      void refreshSession().finally(() => { if (active) setIsHydrating(false); });
    }, 0);
    return () => { active = false; clearTimeout(timer); unsubscribe(); };
  }, [refreshSession]);

  const value = useMemo(() => ({ user, isHydrating, login, register, refreshSession, logout, updateProfile, updateAvatar }),
    [user, isHydrating, login, register, refreshSession, logout, updateProfile, updateAvatar]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
