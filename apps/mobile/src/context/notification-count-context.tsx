import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useAuth } from "@/context/auth-context";
import { api } from "@/services/api";

interface NotificationCountValue { unreadCount: number; refreshUnreadCount: () => Promise<void> }
const NotificationCountContext = createContext<NotificationCountValue | null>(null);

export function NotificationCountProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [countState, setCountState] = useState<{ userId: string | null; count: number }>({ userId: null, count: 0 });
  const unreadCount = user && countState.userId === user.id ? countState.count : 0;
  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.get<{ unreadTotal?: number }>("/notifications");
      setCountState({ userId: user.id, count: Math.max(0, response.data.unreadTotal ?? 0) });
    } catch {
      // The notification badge is best-effort and never blocks navigation.
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const initialPoll = setTimeout(() => void refreshUnreadCount(), 0);
    const interval = setInterval(() => void refreshUnreadCount(), 60_000);
    return () => { clearTimeout(initialPoll); clearInterval(interval); };
  }, [user, refreshUnreadCount]);

  const value = useMemo(() => ({ unreadCount, refreshUnreadCount }), [unreadCount, refreshUnreadCount]);
  return <NotificationCountContext.Provider value={value}>{children}</NotificationCountContext.Provider>;
}

export function useNotificationCount() {
  const value = useContext(NotificationCountContext);
  if (!value) throw new Error("useNotificationCount must be used inside NotificationCountProvider");
  return value;
}
