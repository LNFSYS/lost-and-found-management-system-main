import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { api, refreshSession, type CurrentUser } from "../services/api";

interface AuthContextValue {
  user: CurrentUser | null;
  ready: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
  updateProfile(input: { fullName?: string; studentCode?: string | null; phoneNumber?: string | null }): Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { void refreshSession().then((session) => setUser(session?.user ?? null)).finally(() => setReady(true)); }, []);
  const value = useMemo<AuthContextValue>(() => ({
    user, ready,
    async login(email, password) { setUser(await api.login(email, password)); },
    async logout() { await api.logout(); setUser(null); },
    async refreshUser() { setUser(await api.me()); },
    async updateProfile(input) { setUser(await api.updateProfile(input)); }
  }), [user, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
