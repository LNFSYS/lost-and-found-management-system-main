import { Bell, CheckCheck, CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type AppNotification, type CustodyRequestDetailResponse } from "../services/api";

function icon(type: AppNotification["type"]) {
  if (type === "CLAIM_ACCEPTED") return <CheckCircle2 size={18} />;
  if (type === "CLAIM_REJECTED" || type === "CLAIM_WITHDRAWN") return <XCircle size={18} />;
  return <MessageCircle size={18} />;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [custody, setCustody] = useState<CustodyRequestDetailResponse | null>(null);
  const [custodyError, setCustodyError] = useState("");
  const requestId = search.get("custodyRequestId");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.listNotifications(50).then((result) => setItems(result.items)).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    let active = true;
    setCustody(null);
    setCustodyError("");
    if (requestId) void api.getCustodyRequest(requestId).then(result => { if (active) setCustody(result); }).catch(error => { if (active) setCustodyError(error.message); });
    return () => { active = false; };
  }, [requestId]);

  async function open(item: AppNotification) {
    if (!item.isRead) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
      void api.markNotificationRead(item.id).catch(() => undefined);
    }
    if (item.entityType === "CLAIM" && item.entityId) navigate(`/claims/${item.entityId}`);
    if (["APPOINTMENT","APPOINTMENT_REMINDER"].includes(item.entityType ?? "") && item.entityId) navigate(`/appointments/${item.entityId}`);
    if (item.entityType === "POST" && item.entityId) navigate(`/posts/${item.entityId}`);
    if (item.entityType === "CUSTODY_REQUEST" && item.entityId) setSearch({ custodyRequestId: item.entityId });
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
    {requestId && <div className="custody-modal-overlay"><section className="custody-modal" role="dialog" aria-modal="true" aria-labelledby="notification-custody-title">
      <h2 id="notification-custody-title">Yêu cầu bàn giao custody</h2>
      {custodyError && <p role="alert">{custodyError}</p>}
      {!custody && !custodyError && <p role="status">Đang tải...</p>}
      {custody && <><p><strong>{custody.request.post?.title}</strong></p><p>Trạng thái: {custody.request.status}</p><p>{custody.request.handoverPoint?.name}</p><p>{custody.request.handoverPoint?.address}</p>
        {custody.request.confirmedHandoverAt && <p>{new Date(custody.request.confirmedHandoverAt).toLocaleString("vi-VN")}</p>}
        <ol>{custody.audit.map(event => <li key={event.id}>{event.action} · {new Date(event.createdAt).toLocaleString("vi-VN")}</li>)}</ol>
        {["PENDING","ACCEPTED"].includes(custody.request.status) && <button className="secondary-button" type="button" onClick={() => {
          void api.cancelCustodyRequest(requestId, { reason: "Người dùng hủy yêu cầu" }).then(() => api.getCustodyRequest(requestId)).then(setCustody).catch(error => setCustodyError(error.message));
        }}><XCircle size={16} />Hủy yêu cầu</button>}
      </>}
      <button type="button" className="secondary-button" onClick={() => setSearch({})}>Đóng</button>
    </section></div>}
  </section>;
}
