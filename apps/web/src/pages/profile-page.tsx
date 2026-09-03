import {
  Activity,
  BadgeCheck,
  Camera,
  History,
  Mail,
  PencilLine,
  RefreshCw,
  Save,
  Shield,
  Star,
  UserRound,
  X
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useAuth } from "../context/auth-context";
import { api, type ProfileActivitySummary } from "../services/api";

const avatarTypes = ["image/jpeg", "image/png", "image/webp"];
const avatarMaxBytes = 1 * 1024 * 1024;

function userInitial(name: string) {
  return name.trim().split(/\s+/).at(-1)?.slice(0, 1).toUpperCase() || "U";
}

function roleLabel(roles: string[]) {
  if (roles.includes("ADMIN")) return "Quản trị viên";
  if (roles.includes("STAFF")) return "Nhân viên vận hành";
  if (roles.includes("LECTURER")) return "Giảng viên";
  if (roles.includes("STUDENT")) return "Sinh viên";
  return "Người dùng campus";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function reputationLabel(level: ProfileActivitySummary["reputation"]["level"]) {
  const labels: Record<ProfileActivitySummary["reputation"]["level"], string> = {
    NEW: "Mới",
    TRUSTED: "Đáng tin",
    RELIABLE: "Tin cậy",
    EXCELLENT: "Xuất sắc"
  };
  return labels[level];
}

export function ProfilePage() {
  const { user, updateProfile, updateAvatar } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", studentCode: "", phoneNumber: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [activity, setActivity] = useState<ProfileActivitySummary | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName,
      studentCode: user.studentCode ?? "",
      phoneNumber: user.phoneNumber ?? ""
    });
  }, [user]);

  useEffect(() => {
    if (!user?.avatar.hasAvatar) {
      setAvatarUrl(null);
      return;
    }

    let alive = true;
    let nextUrl: string | null = null;
    api.getProfileAvatar()
      .then((blob) => {
        if (!alive) return;
        nextUrl = URL.createObjectURL(blob);
        setAvatarUrl(nextUrl);
      })
      .catch(() => {
        if (alive) setAvatarUrl(null);
      });

    return () => {
      alive = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [user?.avatar.hasAvatar, user?.avatar.updatedAt]);

  async function loadActivity() {
    setActivityLoading(true);
    setActivityError("");
    try {
      setActivity(await api.getActivitySummary());
    } catch (reason) {
      setActivityError(reason instanceof Error ? reason.message : "Không thể tải hoạt động.");
    } finally {
      setActivityLoading(false);
    }
  }

  useEffect(() => {
    if (user) void loadActivity();
  }, [user?.id]);

  if (!user) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await updateProfile({
        fullName: form.fullName,
        studentCode: form.studentCode || null,
        phoneNumber: form.phoneNumber || null
      });
      setEditing(false);
      setNotice("Đã cập nhật hồ sơ.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật hồ sơ.");
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setNotice("");
    setAvatarError("");
    if (!file) return;
    if (!avatarTypes.includes(file.type)) {
      setAvatarError("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP.");
      return;
    }
    if (file.size > avatarMaxBytes) {
      setAvatarError("Ảnh đại diện không được vượt quá 1MB.");
      return;
    }

    setAvatarBusy(true);
    try {
      await updateAvatar(file);
      setNotice("Đã cập nhật ảnh đại diện.");
    } catch (reason) {
      setAvatarError(reason instanceof Error ? reason.message : "Không thể cập nhật ảnh đại diện.");
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <section className="profile-layout">
      <div className="section-heading">
        <p className="eyebrow">TÀI KHOẢN</p>
        <h1>Hồ sơ cá nhân</h1>
        <p>Thông tin hồ sơ giúp nhà trường xác minh và liên hệ khi cần hỗ trợ trả lại vật phẩm.</p>
      </div>

      <article className="identity-card profile-identity-card">
        <div className="avatar profile-avatar" aria-label="Ảnh đại diện">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{userInitial(user.fullName)}</span>}
        </div>
        <div className="identity-copy">
          <h2>{user.fullName}</h2>
          <p><Mail size={16} /> {user.email}</p>
          <span className="status-chip"><BadgeCheck size={15} /> Email đã xác thực</span>
        </div>
        <div className="profile-actions">
          <label className={`secondary-button avatar-upload-button${avatarBusy ? " is-disabled" : ""}`}>
            <Camera size={17} /> {avatarBusy ? "Đang tải" : "Ảnh đại diện"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadAvatar}
              disabled={avatarBusy}
            />
          </label>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setEditing((current) => !current);
              setNotice("");
              setError("");
            }}
          >
            {editing ? <X size={17} /> : <PencilLine size={17} />} {editing ? "Hủy" : "Chỉnh sửa"}
          </button>
        </div>
      </article>

      {notice && <p className="form-note">{notice}</p>}
      {avatarError && <p className="form-error">{avatarError}</p>}

      {editing && (
        <form className="profile-form" onSubmit={submit}>
          <label className="input-field">
            <span>Họ và tên</span>
            <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
          </label>
          <label className="input-field">
            <span>Mã sinh viên/nhân sự</span>
            <input value={form.studentCode} onChange={(event) => setForm({ ...form, studentCode: event.target.value })} />
          </label>
          <label className="input-field">
            <span>Số điện thoại</span>
            <input value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button"><Save size={17} /> Lưu thay đổi</button>
        </form>
      )}

      <div className="profile-grid">
        <article>
          <UserRound size={21} />
          <p>Vai trò hệ thống</p>
          <strong>{user.roles.join(" · ")}</strong>
        </article>
        <article>
          <Shield size={21} />
          <p>Phân quyền</p>
          <strong>{roleLabel(user.roles)}</strong>
        </article>
        <article>
          <Star size={21} />
          <p>Điểm uy tín</p>
          <strong>{activity ? `${activity.reputation.totalPoints} · ${reputationLabel(activity.reputation.level)}` : "Đang tải"}</strong>
        </article>
        <article>
          <Activity size={21} />
          <p>Hoàn trả thành công</p>
          <strong>{activity ? activity.counts.completedReturns : "Đang tải"}</strong>
        </article>
      </div>

      <section className="profile-activity-panel">
        <div className="profile-panel-heading">
          <div>
            <p className="eyebrow">ACTIVITY</p>
            <h2>Hoạt động & uy tín</h2>
          </div>
          <button type="button" className="secondary-button icon-text-button" onClick={() => void loadActivity()} disabled={activityLoading}>
            <RefreshCw size={17} /> Làm mới
          </button>
        </div>

        {activityError && <p className="form-error">{activityError}</p>}
        <div className="activity-stats">
          <article><span>Bài đăng</span><strong>{activity?.counts.posts ?? 0}</strong></article>
          <article><span>Đang mở</span><strong>{activity?.counts.openPosts ?? 0}</strong></article>
          <article><span>Claim</span><strong>{activity?.counts.claims ?? 0}</strong></article>
          <article><span>Feedback</span><strong>{activity?.counts.receivedFeedback ?? 0}</strong></article>
        </div>

        <div className="activity-list">
          {activityLoading && <p>Đang tải hoạt động...</p>}
          {!activityLoading && activity?.recentEvents.length === 0 && <p>Chưa có hoạt động phù hợp.</p>}
          {activity?.recentEvents.map((event) => (
            <article key={`${event.type}-${event.occurredAt}`}>
              <History size={18} />
              <div>
                <strong>{event.label}</strong>
                <span>{formatDate(event.occurredAt)}</span>
              </div>
              {event.pointsDelta !== undefined && <b>{event.pointsDelta > 0 ? `+${event.pointsDelta}` : event.pointsDelta}</b>}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
