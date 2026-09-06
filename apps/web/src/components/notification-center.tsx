import { Bell, CheckCheck, CheckCircle2, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { api, type AppNotification } from "../services/api";

function notificationIcon(type: AppNotification["type"]) {
  return type === "CLAIM_ACCEPTED" ? <CheckCircle2 size={17} /> : <MessageCircle size={17} />;
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const centerRef = useRef<HTMLDivElement>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<AppNotification | null>(null);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setToast(null);
      setOpen(false);
      knownIds.current = new Set();
      initialized.current = false;
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const result = await api.listNotifications(20);
        if (!active) return;
        const fresh = initialized.current
          ? result.items.find((item) => !knownIds.current.has(item.id) && !item.isRead)
          : undefined;
        setItems(result.items);
        knownIds.current = new Set(result.items.map((item) => item.id));
        initialized.current = true;
        if (fresh) setToast(fresh);
      } catch {
        // Notification polling is deliberately non-blocking for the rest of the app.
      } finally {
        if (active) setLoading(false);
      }
    };

    setLoading(true);
    void load();
    const timer = window.setInterval(() => { void load(); }, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (centerRef.current && !centerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!user) return null;

  const unreadCount = items.filter((item) => !item.isRead).length;

  async function openNotification(item: AppNotification) {
    setOpen(false);
    setToast(null);
    if (!item.isRead) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
      void api.markNotificationRead(item.id).catch(() => undefined);
    }
    if (item.entityType === "CLAIM" && item.entityId) navigate(`/claims/${item.entityId}`);
  }

  function markAllRead() {
    if (!unreadCount) return;
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    void api.markAllNotificationsRead().catch(() => undefined);
  }

  return <>
    <div className="notification-center" ref={centerRef}>
      <button
        className={`notification-trigger ${open ? "active" : ""}`}
        type="button"
        aria-label="Thông báo"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={19} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && <section className="notification-popover" aria-label="Thông báo">
        <header className="notification-popover__header">
          <div><strong>Thông báo</strong><small>{unreadCount ? `${unreadCount} chưa đọc` : "Tất cả đã đọc"}</small></div>
          <button type="button" className="notification-mark-all" disabled={!unreadCount} onClick={markAllRead}>
            <CheckCheck size={15} /> Đánh dấu đã đọc
          </button>
        </header>
        <div className="notification-list">
          {loading && !items.length && <p className="notification-empty">Đang tải thông báo...</p>}
          {!loading && !items.length && <p className="notification-empty">Bạn chưa có thông báo mới.</p>}
          {items.map((item) => <button
            type="button"
            className={`notification-item ${item.isRead ? "" : "unread"}`}
            key={item.id}
            onClick={() => { void openNotification(item); }}
          >
            <span className={`notification-item__icon notification-item__icon--${item.type.toLowerCase()}`}>{notificationIcon(item.type)}</span>
            <span className="notification-item__copy"><strong>{item.title}</strong><span>{item.body}</span><time>{formatNotificationDate(item.createdAt)}</time></span>
            {!item.isRead && <i className="notification-item__dot" aria-label="Chưa đọc" />}
          </button>)}
        </div>
      </section>}
    </div>
    {toast && <div className="notification-toast" role="status" aria-live="polite">
      <button type="button" className="notification-toast__content" onClick={() => { void openNotification(toast); }}>
        <span className={`notification-toast__icon notification-toast__icon--${toast.type.toLowerCase()}`}>{notificationIcon(toast.type)}</span>
        <span><strong>{toast.title}</strong><small>{toast.body}</small></span>
      </button>
      <button type="button" className="notification-toast__close" aria-label="Đóng thông báo" onClick={() => setToast(null)}><X size={16} /></button>
    </div>}
  </>;
}
