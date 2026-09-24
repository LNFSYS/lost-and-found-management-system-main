import { Bell, CheckCheck, CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AppNotification } from "../services/api";

function icon(type: AppNotification["type"]) {
  if (type === "CLAIM_ACCEPTED") return <CheckCircle2 size={18} />;
  if (type === "CLAIM_REJECTED" || type === "CLAIM_WITHDRAWN") return <XCircle size={18} />;
  return <MessageCircle size={18} />;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.listNotifications(50).then((result) => setItems(result.items)).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  async function open(item: AppNotification) {
    if (!item.isRead) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
      void api.markNotificationRead(item.id).catch(() => undefined);
    }
    if (item.entityType === "CLAIM" && item.entityId) navigate(`/claims/${item.entityId}`);
  }

  function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    void api.markAllNotificationsRead().catch(() => undefined);
  }

  return <section className="notifications-page">
    <header className="notifications-page__heading"><Bell size={30} /><div><p className="eyebrow">NOTIFICATION CENTER</p><h1>Thông báo</h1><p>Các sự kiện liên quan đến tài khoản và bài đăng của bạn.</p></div><button type="button" className="secondary-button" onClick={markAllRead}><CheckCheck size={16} /> Đánh dấu đã đọc</button></header>
    {loading && <p className="center-state">Đang tải thông báo...</p>}
    {!loading && !items.length && <p className="center-state">Bạn chưa có thông báo.</p>}
    <div className="notifications-page__list">{items.map((item) => <button type="button" className={`notifications-page__item ${item.isRead ? "" : "unread"}`} key={item.id} onClick={() => { void open(item); }}><span className="notifications-page__icon">{icon(item.type)}</span><span><strong>{item.title}</strong><small>{item.body}</small><time>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</time></span></button>)}</div>
  </section>;
}
