import { BellRing, Clock3, MailCheck, Save } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { api, type NotificationEmailMode, type NotificationEmailPreferences } from "../services/api";

const modes: Array<{ value: NotificationEmailMode; label: string; detail: string; }> = [
  { value: "IMMEDIATE", label: "Gửi ngay", detail: "Gửi email thông báo chung ngay khi có sự kiện." },
  { value: "DELAYED_UNREAD", label: "Khi chưa đọc", detail: "Chỉ gửi nếu thông báo vẫn chưa đọc sau thời gian chờ." },
  { value: "DIGEST", label: "Bản tổng hợp", detail: "Gộp các thông báo đủ điều kiện vào một email." },
  { value: "DISABLED", label: "Tắt email", detail: "Vẫn nhận thông báo trong ứng dụng." }
];

function initialPreferences(): Omit<NotificationEmailPreferences, "userId" | "updatedAt"> {
  return {
    chatMode: "DELAYED_UNREAD",
    claimMode: "IMMEDIATE",
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh"
  };
}

export function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.getNotificationEmailPreferences()
      .then((result) => { if (active) setPreferences({ chatMode: result.chatMode, claimMode: result.claimMode, quietHoursStart: result.quietHoursStart, quietHoursEnd: result.quietHoursEnd, timezone: result.timezone }); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Không thể tải cài đặt email."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

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
      const saved = await api.updateNotificationEmailPreferences(preferences);
      setPreferences({ chatMode: saved.chatMode, claimMode: saved.claimMode, quietHoursStart: saved.quietHoursStart, quietHoursEnd: saved.quietHoursEnd, timezone: saved.timezone });
      setNotice("Đã lưu cài đặt email thông báo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu cài đặt.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="notification-preferences-page">
    <header className="notification-preferences-heading">
      <BellRing />
      <div><p className="eyebrow">NOTIFICATION EMAIL</p><h1>Thông báo qua email</h1><p>Chọn cách nhận email cho claim và trao đổi riêng. Nội dung nhạy cảm không bao giờ xuất hiện trong email.</p></div>
    </header>
    <form className="notification-preferences-card" onSubmit={save}>
      {loading ? <p>Đang tải cài đặt...</p> : <>
        <fieldset>
          <legend><MailCheck size={18} /> Tin nhắn trong trao đổi riêng</legend>
          <div className="notification-mode-grid">{modes.map((mode) => <label key={`chat-${mode.value}`} className={preferences.chatMode === mode.value ? "selected" : ""}>
            <input type="radio" name="chatMode" value={mode.value} checked={preferences.chatMode === mode.value} onChange={() => setPreferences({ ...preferences, chatMode: mode.value })} />
            <strong>{mode.label}</strong><small>{mode.detail}</small>
          </label>)}</div>
        </fieldset>
        <fieldset>
          <legend><MailCheck size={18} /> Cập nhật trạng thái claim</legend>
          <div className="notification-mode-grid">{modes.map((mode) => <label key={`claim-${mode.value}`} className={preferences.claimMode === mode.value ? "selected" : ""}>
            <input type="radio" name="claimMode" value={mode.value} checked={preferences.claimMode === mode.value} onChange={() => setPreferences({ ...preferences, claimMode: mode.value })} />
            <strong>{mode.label}</strong><small>{mode.detail}</small>
          </label>)}</div>
        </fieldset>
        <fieldset className="quiet-hours-panel">
          <legend><Clock3 size={18} /> Giờ yên lặng</legend>
          <label className="toggle-line"><input type="checkbox" checked={preferences.quietHoursStart !== null} onChange={(event) => enableQuietHours(event.target.checked)} /> Không gửi email tùy chọn trong khung giờ này</label>
          {preferences.quietHoursStart !== null && <div className="quiet-hours-inputs">
            <label>Bắt đầu<input type="time" value={preferences.quietHoursStart} onChange={(event) => setPreferences({ ...preferences, quietHoursStart: event.target.value })} required /></label>
            <label>Kết thúc<input type="time" value={preferences.quietHoursEnd ?? ""} onChange={(event) => setPreferences({ ...preferences, quietHoursEnd: event.target.value })} required /></label>
            <label>Múi giờ<input value={preferences.timezone} maxLength={64} onChange={(event) => setPreferences({ ...preferences, timezone: event.target.value })} required /></label>
          </div>}
        </fieldset>
        <p className="notification-security-note">Mã OTP đăng ký và đặt lại mật khẩu là email bảo mật bắt buộc, không bị ảnh hưởng bởi các cài đặt này.</p>
        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-note">{notice}</p>}
        <button className="primary-button" disabled={saving}><Save size={17} /> {saving ? "Đang lưu" : "Lưu cài đặt"}</button>
      </>}
    </form>
  </section>;
}
