import {
  Activity,
  BadgeCheck,
  Camera,
  History,
  Mail,
  MessageSquare,
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
import { api, type ProfileActivitySummary, type ReturnFeedbackEligibility } from "../services/api";

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
  const [feedbackAppointmentId, setFeedbackAppointmentId] = useState("");
  const [feedbackEligibility, setFeedbackEligibility] = useState<ReturnFeedbackEligibility | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState("");
  const [feedbackError, setFeedbackError] = useState("");

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName,
      studentCode: user.studentCode ?? "",
      phoneNumber: user.phoneNumber ?? ""
    });
  }, [user]);

  useEffect(() => {
    if (!user?.avatar?.hasAvatar) {
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
  }, [user?.avatar?.hasAvatar, user?.avatar?.updatedAt]);

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

  async function checkFeedbackEligibility(event: FormEvent) {
    event.preventDefault();
    setFeedbackBusy(true);
    setFeedbackError("");
    setFeedbackNotice("");
    setFeedbackEligibility(null);
    try {
      setFeedbackEligibility(await api.getReturnFeedbackEligibility(feedbackAppointmentId.trim()));
    } catch (reason) {
      setFeedbackError(reason instanceof Error ? reason.message : "Không thể kiểm tra quyền gửi feedback.");
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function submitReturnFeedback(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setFeedbackBusy(true);
    setFeedbackError("");
    setFeedbackNotice("");
    try {
      const currentUserId = user.id;
      const idempotencyKey = `feedback-${feedbackAppointmentId.trim()}-${currentUserId}`;
      const result = await api.submitReturnFeedback(feedbackAppointmentId.trim(), {
        rating: feedbackRating,
        comment: feedbackComment || null,
        idempotencyKey
      });
      setFeedbackNotice(result.idempotent ? "Feedback đã được ghi nhận trước đó." : "Đã gửi feedback và cập nhật điểm uy tín.");
      setFeedbackEligibility(await api.getReturnFeedbackEligibility(feedbackAppointmentId.trim()));
      await loadActivity();
    } catch (reason) {
      setFeedbackError(reason instanceof Error ? reason.message : "Không thể gửi feedback.");
    } finally {
      setFeedbackBusy(false);
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

      <section className="profile-activity-panel return-feedback-panel">
        <div className="profile-panel-heading">
          <div>
            <p className="eyebrow">FEEDBACK</p>
            <h2>Feedback sau hoàn trả</h2>
          </div>
        </div>

        <form className="return-feedback-check" onSubmit={checkFeedbackEligibility}>
          <label className="input-field">
            <span>Mã lịch hoàn trả</span>
            <input value={feedbackAppointmentId} onChange={(event) => setFeedbackAppointmentId(event.target.value)} placeholder="UUID appointment" required />
          </label>
          <button type="submit" className="secondary-button" disabled={feedbackBusy || !feedbackAppointmentId.trim()}>
            <MessageSquare size={17} /> Kiểm tra
          </button>
        </form>

        {feedbackEligibility && (
          <div className="return-feedback-status">
            <strong>{feedbackEligibility.eligible ? "Bạn có thể gửi feedback" : "Chưa đủ điều kiện gửi feedback"}</strong>
            <span>{feedbackEligibility.reason ?? `Return đã hoàn tất, ${feedbackEligibility.feedbackCount} feedback đã ghi nhận.`}</span>
          </div>
        )}

        {feedbackEligibility?.eligible && (
          <form className="return-feedback-form" onSubmit={submitReturnFeedback}>
            <label className="input-field">
              <span>Đánh giá</span>
              <select value={feedbackRating} onChange={(event) => setFeedbackRating(Number(event.target.value))}>
                {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}/5</option>)}
              </select>
            </label>
            <label className="input-field">
              <span>Bình luận</span>
              <textarea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} maxLength={500} placeholder="Không nhập thông tin liên hệ, bằng chứng riêng tư hoặc dữ liệu nhạy cảm." />
            </label>
            <button className="primary-button" disabled={feedbackBusy}><Save size={17} /> Gửi feedback</button>
          </form>
        )}

        {feedbackEligibility?.currentUserFeedback && (
          <div className="return-feedback-status is-done">
            <strong>Bạn đã gửi {feedbackEligibility.currentUserFeedback.rating}/5</strong>
            <span>{feedbackEligibility.currentUserFeedback.comment ?? "Không có bình luận."}</span>
          </div>
        )}
        {feedbackNotice && <p className="form-note">{feedbackNotice}</p>}
        {feedbackError && <p className="form-error">{feedbackError}</p>}
      </section>
    </section>
  );
}
