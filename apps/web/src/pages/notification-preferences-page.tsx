import { BellRing, Clock3, Save } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { api, type NotificationCategory, type NotificationChannelPreferences, type NotificationEmailMode, type NotificationEmailPreferences } from "../services/api";

const modes: Array<{ value: NotificationEmailMode; label: string; }> = [
  { value: "IMMEDIATE", label: "Gửi ngay" },
  { value: "DELAYED_UNREAD", label: "Chỉ khi chưa đọc" },
  { value: "DIGEST", label: "Bản tổng hợp" },
  { value: "DISABLED", label: "Tắt email" }
];

const categories: Array<{ key: NotificationCategory; label: string; description: string; }> = [
  { key: "CHAT", label: "Tin nhắn", description: "Tin nhắn trong trao đổi riêng." },
  { key: "CLAIM", label: "Claim và xác minh", description: "Yêu cầu claim, quyết định và bước xác minh." },
  { key: "MATCH", label: "Gợi ý matching", description: "Bài đăng phù hợp với vật phẩm của bạn." },
  { key: "APPOINTMENT", label: "Lịch hẹn", description: "Đề xuất, thay đổi và nhắc lịch hẹn." },
  { key: "HANDOVER", label: "Bàn giao và trả đồ", description: "Xác nhận bàn giao và hoàn tất trả đồ." },
  { key: "CUSTODY", label: "Custody và lưu kho", description: "Tiếp nhận, di chuyển và cập nhật hồ sơ lưu giữ." },
  { key: "OVERDUE", label: "Cảnh báo quá hạn", description: "Custody quá hạn và thời hạn lưu kho." },
  { key: "FEEDBACK", label: "Feedback", description: "Đánh giá nhận được sau khi hoàn tất bàn giao." }
];

function initialCategories(): NotificationChannelPreferences {
  return Object.fromEntries(categories.map(({ key }) => [key, {
    inAppEnabled: true,
    pushEnabled: false,
    emailMode: key === "CHAT" ? "DELAYED_UNREAD" : "IMMEDIATE"
  }])) as NotificationChannelPreferences;
}

function initialPreferences(): Omit<NotificationEmailPreferences, "userId" | "updatedAt"> {
  const categories = initialCategories();
  return {
    chatMode: categories.CHAT.emailMode,
    claimMode: categories.CLAIM.emailMode,
    categories,
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh"
  };
}

function decodeVapidKey(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function browserSupportsPush() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function updateBrowserSubscription(enabled: boolean, publicKey: string | null) {
  if (!browserSupportsPush()) {
    if (enabled) throw new Error("Trình duyệt này chưa hỗ trợ PWA push.");
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration("/") ?? await navigator.serviceWorker.register("/sw.js");
  let subscription = await registration.pushManager.getSubscription();
  if (!enabled) {
    if (subscription) {
      await api.removePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }
    return;
  }
  if (!publicKey) throw new Error("Máy chủ chưa cấu hình PWA push.");
  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Bạn cần cho phép thông báo trên trình duyệt để bật PWA push.");
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(publicKey) });
  const json = subscription.toJSON();
  if (!json.keys?.p256dh || !json.keys.auth) throw new Error("Trình duyệt không tạo được khóa push hợp lệ.");
  await api.registerPushSubscription({ endpoint: subscription.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
}

export function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [pushPublicKey, setPushPublicKey] = useState<string | null>(null);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.getNotificationEmailPreferences(), api.getPushNotificationStatus()])
      .then(([saved, push]) => {
        if (!active) return;
        setPreferences({ chatMode: saved.chatMode, claimMode: saved.claimMode, categories: saved.categories,
          quietHoursStart: saved.quietHoursStart, quietHoursEnd: saved.quietHoursEnd, timezone: saved.timezone });
        setPushConfigured(push.enabled && browserSupportsPush());
        setPushPublicKey(push.publicKey);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Không thể tải cài đặt thông báo."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function setCategory(category: NotificationCategory, update: Partial<NotificationChannelPreferences[NotificationCategory]>) {
    setPreferences((current) => ({ ...current, categories: {
      ...current.categories, [category]: { ...current.categories[category], ...update }
    } }));
  }

  function enableQuietHours(enabled: boolean) {
    setPreferences((current) => ({
      ...current,
      quietHoursStart: enabled ? current.quietHoursStart ?? "22:00" : null,
      quietHoursEnd: enabled ? current.quietHoursEnd ?? "07:00" : null
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const wantsPush = Object.values(preferences.categories).some((category) => category.pushEnabled);
      if (wantsPush && !pushConfigured) throw new Error("PWA push chưa khả dụng trên máy chủ hoặc trình duyệt này.");
      if (wantsPush) await updateBrowserSubscription(true, pushPublicKey);
      const payload = { ...preferences, chatMode: preferences.categories.CHAT.emailMode, claimMode: preferences.categories.CLAIM.emailMode };
      const saved = await api.updateNotificationEmailPreferences(payload);
      if (!wantsPush) await updateBrowserSubscription(false, pushPublicKey);
      setPreferences({ chatMode: saved.chatMode, claimMode: saved.claimMode, categories: saved.categories,
        quietHoursStart: saved.quietHoursStart, quietHoursEnd: saved.quietHoursEnd, timezone: saved.timezone });
      setNotice("Đã lưu các kênh thông báo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu cài đặt.");
    } finally {
      setSaving(false);
    }
  }

  const wantsPush = Object.values(preferences.categories).some((category) => category.pushEnabled);
  return <section className="notification-preferences-page">
    <header className="notification-preferences-heading">
      <BellRing />
      <div><p className="eyebrow">THÔNG BÁO</p><h1>Kênh thông báo</h1><p>Chọn kênh riêng cho từng loại sự kiện. Email chỉ chứa thông báo khái quát, không có nội dung chat hay thông tin claim nhạy cảm.</p></div>
    </header>
    <form className="notification-preferences-card" onSubmit={save}>
      {loading ? <p>Đang tải cài đặt...</p> : <>
        <div className="notification-channel-grid" role="table" aria-label="Tùy chọn kênh thông báo">
          <div className="notification-channel-row notification-channel-row--heading" role="row">
            <span role="columnheader">Loại thông báo</span><span role="columnheader">Trong ứng dụng</span><span role="columnheader">PWA push</span><span role="columnheader">Email</span>
          </div>
          {categories.map(({ key, label, description }) => <div className="notification-channel-row" role="row" key={key}>
            <div className="notification-channel-label"><strong>{label}</strong><small>{description}</small></div>
            <label className="notification-channel-check"><span className="sr-only">{label}: trong ứng dụng</span><input type="checkbox" checked={preferences.categories[key].inAppEnabled} onChange={(event) => setCategory(key, { inAppEnabled: event.target.checked })} /></label>
            <label className="notification-channel-check"><span className="sr-only">{label}: PWA push</span><input type="checkbox" checked={preferences.categories[key].pushEnabled} disabled={!pushConfigured && !preferences.categories[key].pushEnabled} onChange={(event) => setCategory(key, { pushEnabled: event.target.checked })} /></label>
            <label className="notification-channel-email"><span className="sr-only">{label}: email</span><select value={preferences.categories[key].emailMode} onChange={(event) => setCategory(key, { emailMode: event.target.value as NotificationEmailMode })}>{modes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
          </div>)}
        </div>
        {!pushConfigured && <p className="notification-security-note">PWA push cần trình duyệt hỗ trợ và máy chủ được cấu hình VAPID. Các kênh trong ứng dụng và email vẫn dùng được.</p>}
        {pushConfigured && <p className="notification-security-note">{wantsPush ? "Push đang bật cho ít nhất một loại thông báo trên trình duyệt này." : "Bật một ô PWA push để trình duyệt hỏi quyền nhận thông báo."}</p>}
        <fieldset className="quiet-hours-panel">
          <legend><Clock3 size={18} /> Giờ yên lặng cho email</legend>
          <label className="toggle-line"><input type="checkbox" checked={preferences.quietHoursStart !== null} onChange={(event) => enableQuietHours(event.target.checked)} /> Tạm hoãn email trong khung giờ này</label>
          {preferences.quietHoursStart !== null && <div className="quiet-hours-inputs">
            <label>Bắt đầu<input type="time" value={preferences.quietHoursStart} onChange={(event) => setPreferences({ ...preferences, quietHoursStart: event.target.value })} required /></label>
            <label>Kết thúc<input type="time" value={preferences.quietHoursEnd ?? ""} onChange={(event) => setPreferences({ ...preferences, quietHoursEnd: event.target.value })} required /></label>
            <label>Múi giờ<input value={preferences.timezone} maxLength={64} onChange={(event) => setPreferences({ ...preferences, timezone: event.target.value })} required /></label>
          </div>}
        </fieldset>
        <p className="notification-security-note">Email OTP và đặt lại mật khẩu là thông báo bảo mật bắt buộc, không bị ảnh hưởng bởi các cài đặt này.</p>
        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-note">{notice}</p>}
        <button className="primary-button" disabled={saving}><Save size={17} /> {saving ? "Đang lưu" : "Lưu cài đặt"}</button>
      </>}
    </form>
  </section>;
}
