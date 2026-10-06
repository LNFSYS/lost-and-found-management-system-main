import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { api, ApiError, refreshSession, type CurrentUser } from "../services/api";

interface AuthContextValue {
  user: CurrentUser | null;
  ready: boolean;
  sessionError: string | null;
  retryAt: number;
  retrySession(): void;
  login(email: string, password: string): Promise<CurrentUser>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
  updateProfile(input: { fullName?: string; studentCode?: string | null; phoneNumber?: string | null }): Promise<void>;
  updateAvatar(file: File): Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [retryIndex, setRetryIndex] = useState(0);
  const sequence = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const current = ++sequence.current;
    let attempts = 0;
    async function restore() {
      attempts++;
      try {
        const session = await refreshSession();
        if (sequence.current !== current) return;
        setUser(session?.user ?? null);
        setSessionError(null);
        setRetryAt(0);
        setReady(true);
      } catch (reason) {
        if (sequence.current !== current) return;
        const deadline = reason instanceof ApiError ? Math.max(Date.now() + 100, reason.retryAt) : Date.now() + 2000;
        setSessionError(reason instanceof Error ? reason.message : "Chưa thể khôi phục phiên đăng nhập.");
        setRetryAt(deadline);
        if (attempts < 3) retryTimer.current = setTimeout(() => { if (sequence.current === current) void restore(); }, deadline - Date.now());
      }
    }
    void restore();
    const ended = () => { sequence.current++; if (retryTimer.current) clearTimeout(retryTimer.current); setUser(null); setSessionError(null); setReady(true); };
    window.addEventListener("lnfs:session-ended", ended);
    return () => { sequence.current++; if (retryTimer.current) clearTimeout(retryTimer.current); window.removeEventListener("lnfs:session-ended", ended); };
  }, [retryIndex]);
  const value = useMemo<AuthContextValue>(() => ({
    user, ready, sessionError, retryAt,
    retrySession() { setReady(false); setSessionError(null); setRetryIndex(previous => previous + 1); },
    async login(email, password) {
      const current = ++sequence.current;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      setUser(null);
      setSessionError(null);
      setReady(true);
      const authenticatedUser = await api.login(email, password);
      if (sequence.current !== current) return authenticatedUser;
      setUser(authenticatedUser);
      setSessionError(null);
      setReady(true);
      return authenticatedUser;
    },
    async logout() {
      const current = ++sequence.current;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      setUser(null);
      setSessionError(null);
      setReady(true);
      try {
        await api.logout();
      } finally {
        if (sequence.current === current) setUser(null);
      }
    },
    async refreshUser() {
      const current = ++sequence.current;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      const refreshed = await api.me();
      if (sequence.current !== current) return;
      setUser(refreshed); setSessionError(null); setReady(true);
    },
    async updateProfile(input) { setUser(await api.updateProfile(input)); },
    async updateAvatar(file) { setUser(await api.uploadProfileAvatar(file)); }
  }), [user, ready, sessionError, retryAt]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
