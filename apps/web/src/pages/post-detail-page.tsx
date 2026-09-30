import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Clock3, Eye, FileWarning, LoaderCircle, LockKeyhole, MapPin, MessageCircle, PackageCheck, ScanSearch, Tag, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useNetworkStatus } from "../hooks/use-network-status";
import { useStaleDataNotice } from "../hooks/use-stale-data-notice";
import { PostCard, PostImage } from "./posts-page";
import { api, type PostSummary } from "../services/api";

const statusLabels: Record<PostSummary["status"], string> = {
  OPEN: "Đang mở", MATCHED: "Có gợi ý", RESOLVED: "Đã hoàn trả",
  CLOSED: "Đã đóng", EXPIRED: "Hết hạn", HIDDEN: "Đã ẩn"
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeStyle: "short" }).format(new Date(value)) : "Chưa cập nhật";
}

export function PostDetailPage() {
  const { postId = "" } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<PostSummary | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<PostSummary[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { online } = useNetworkStatus();
  const { stale, clearStale } = useStaleDataNotice(useCallback((path) => path.startsWith(`/posts/${postId}`), [postId]));

  const [custodyModalOpen, setCustodyModalOpen] = useState(false);
  const [handoverPoints, setHandoverPoints] = useState<Array<{ id: string; name: string; address?: string | null }>>([]);
  const [selectedHpId, setSelectedHpId] = useState("");
  const [custodyReason, setCustodyReason] = useState("");
  const [submittingCustody, setSubmittingCustody] = useState(false);
  const [custodyNotice, setCustodyNotice] = useState("");
  const [custodyError, setCustodyError] = useState("");

  async function openCustodyModal() {
    setCustodyError("");
    try {
      const res = await api.listPublicHandoverPoints();
      setHandoverPoints(res.handoverPoints);
      if (res.handoverPoints.length > 0) {
        setSelectedHpId(res.handoverPoints[0].id);
      }
      setCustodyModalOpen(true);
    } catch (err) {
      setCustodyError(err instanceof Error ? err.message : "Không thể tải danh sách điểm bàn giao");
    }
  }

  async function submitCustodyRequest(e: FormEvent) {
    e.preventDefault();
    if (!post || !selectedHpId) return;
    setSubmittingCustody(true);
    setCustodyError("");
    setCustodyNotice("");
    try {
      await api.createCustodyRequest({
        postId: post.id,
        handoverPointId: selectedHpId,
        reason: custodyReason || "Bàn giao vật phẩm bài nhặt được cho quầy Staff",
        intakeType: "CUSTODY_TRANSFER"
      });
      setCustodyNotice("Đã gửi Yêu cầu Bàn giao cho Staff thành công! Hãy mang tài sản đến quầy theo lịch hẹn.");
      setCustodyModalOpen(false);
      setCustodyReason("");
    } catch (err) {
      setCustodyError(err instanceof Error ? err.message : "Không thể gửi yêu cầu bàn giao");
    } finally {
      setSubmittingCustody(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setRelatedPosts([]);
    setRelatedLoading(false);
    api.getPost(postId)
      .then(async (value) => {
        if (!active) return;
        setPost(value);
        if (online) clearStale();
        if (value.type === "FOUND" && value.canEdit) {
          try {
            const res = await api.getMyCustodyRequestByPost(value.id);
            if (active && res.request) {
              if (res.request.status === "INTAKED") {
                setCustodyNotice("Vật phẩm đã được tiếp nhận và lưu kho bởi Staff.");
              } else {
                setCustodyNotice("Đã gửi Yêu cầu Bàn giao cho Staff thành công! Hãy mang tài sản đến quầy theo lịch hẹn.");
              }
            }
          } catch {
            // ignore
          }
        }
        if (!value.category?.id) return;
        setRelatedLoading(true);
        try {
          const related = await api.listPosts({
            type: value.type === "LOST" ? "FOUND" : "LOST",
            categoryId: value.category.id,
            page: 1,
            pageSize: 3,
            sort: "newest"
          });
          if (active) setRelatedPosts(related.items.filter((item) => item.id !== value.id));
        } catch {
          if (active) setRelatedPosts([]);
        } finally {
          if (active) setRelatedLoading(false);
        }
      })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [postId, online, clearStale]);

  async function claimAndChat() {
    if (!post) return;
    try {
      const existing = await api.findConversationByPost(post.id);
      if (existing) {
        navigate(`/claims/${existing.id}`);
        return;
      }
    } catch {
      // Fall back to compose when the conversation lookup is unavailable.
    }
    navigate(`/claims?composePostId=${encodeURIComponent(post.id)}`);
  }

  if (loading) return <section className="post-detail-page"><div className="post-detail-loading"><i /><div><span /><span /><span /></div></div></section>;
  if (error || !post) return <section className="post-detail-page"><div className="posts-state is-error"><PackageCheck /><h1>Không mở được bài đăng</h1><p>{error || "Bài đăng không tồn tại hoặc bạn không có quyền xem."}</p><Link to="/posts"><ArrowLeft /> Quay lại bảng tin</Link></div></section>;

  const location = [post.location.building?.name, post.location.roomText, post.location.area?.name, post.location.customLocation].filter(Boolean).join(" · ");
  return <main className="post-detail-page">
    <div className="post-detail-topline">
      <Link className="post-detail-back" to="/posts"><ArrowLeft /> Quay lại bài đăng</Link>
      <div className="post-detail-actions">{post.canEdit && <Link className="post-detail-matches" to={`/posts/${post.id}/matches`}><ScanSearch /> Xem phân tích matching</Link>}{!post.canEdit && <Link className="post-detail-matches" to={`/reports?targetType=POST&targetId=${post.id}`}><FileWarning /> Báo cáo bài đăng</Link>}</div>
    </div>
    {(!online || stale) && <div className="pwa-data-state" role="status">
      <strong>{online ? "Đang hiển thị dữ liệu lưu tạm" : "Bạn đang offline"}</strong>
      <span>{online ? "Kết nối đã khôi phục, hãy làm mới nếu cần dữ liệu mới nhất." : "Chi tiết bài có thể là dữ liệu cũ; thao tác cập nhật cần kết nối mạng."}</span>
    </div>}
    <div className="post-detail-grid">
      <section className="post-detail-visual" aria-label="Ảnh vật phẩm"><PostImage post={post} detail /></section>
      <section className="post-detail-content">
        <div className="post-detail-heading">
          <div className="post-detail-badges"><span className={`post-type-inline post-type-inline--${post.type.toLowerCase()}`}>{post.type}</span><span className={`post-status post-status--${post.status.toLowerCase()}`}>{statusLabels[post.status]}</span>{post.visibilityMode === "PRIVATE_DETAILS" && <span className="post-protected"><LockKeyhole /> Chi tiết được bảo vệ</span>}</div>
          <h1>{post.title}</h1>
          <p>Đăng bởi <strong>{post.owner.fullName}</strong> · {formatDate(post.createdAt)}</p>
        </div>

        <dl className="post-detail-facts">
          <div><dt><Tag /> Danh mục</dt><dd>{post.category?.name ?? "Chưa phân loại"}</dd></div>
          <div><dt><CalendarClock /> Thời điểm sự việc</dt><dd>{formatDate(post.lostFoundAt)}</dd></div>
          <div><dt><MapPin /> Vị trí</dt><dd>{location || "Chưa công khai vị trí"}</dd></div>
          <div><dt><Eye /> Phạm vi thông tin</dt><dd>{post.visibilityMode === "PUBLIC" ? "Công khai" : "Một phần thông tin được giữ riêng"}</dd></div>
        </dl>

        <section className="post-detail-description"><p className="eyebrow">Mô tả nhận dạng</p><h2>Thông tin vật phẩm</h2><p>{post.description ?? "Người đăng giữ riêng các dấu hiệu nhận dạng. Thông tin này chỉ hỗ trợ quá trình xác minh phù hợp."}</p></section>

        {/* Finder Transfer to Custody Action Banner */}
        {post.type === "FOUND" && post.canEdit && (
          <div className="post-custody-banner" style={{ margin: "1.25rem 0", padding: "1rem 1.25rem", borderRadius: "12px", background: custodyNotice ? "rgba(34, 197, 94, 0.08)" : "rgba(59, 130, 246, 0.08)", border: custodyNotice ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(59, 130, 246, 0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <strong style={{ display: "block", color: custodyNotice ? "#15803d" : "#1e40af", fontSize: "0.95rem" }}>
                  {custodyNotice ? (custodyNotice.includes("lưu kho") ? "✅ Đã bàn giao vào kho Staff" : "✅ Đã gửi Yêu cầu Bàn giao Custody") : "📦 Gửi đồ vào Quầy Lost & Found (Custody)"}
                </strong>
                <span style={{ fontSize: "0.85rem", color: "#4b5563" }}>
                  {custodyNotice ? custodyNotice : "Bạn có thể mang tài sản đến gửi tại Quầy Staff để nhân viên lưu kho & quản lý an toàn."}
                </span>
              </div>
              {!custodyNotice && (
                <button
                  type="button"
                  className="primary-button"
                  style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                  onClick={openCustodyModal}
                >
                  <PackageCheck size={16} /> Gửi vào kho Staff
                </button>
              )}
            </div>
            {custodyError && <p style={{ margin: "0.5rem 0 0", color: "#dc2626", fontSize: "0.85rem" }}>{custodyError}</p>}
          </div>
        )}

        {!post.canEdit && ["OPEN", "MATCHED"].includes(post.status) && <div className="post-detail-claim"><button className="post-claim-button post-claim-button--detail" type="button" onClick={claimAndChat}><MessageCircle /> Nhắn tin với người đăng</button><p>Nếu đã từng nhắn, hệ thống sẽ mở lại toàn bộ lịch sử; nếu chưa, cuộc trò chuyện chỉ được lưu sau tin nhắn đầu tiên.</p></div>}

        {post.handoverPoint && <section className="post-handover"><span><PackageCheck /></span><div><p className="eyebrow">Điểm bàn giao</p><h2>{post.handoverPoint.name}</h2><p>{post.handoverPoint.address ?? "Địa chỉ đang được cập nhật"}</p></div></section>}

        <footer className="post-detail-owner"><span><UserRound /></span><div><small>Người đăng</small><strong>{post.owner.fullName}</strong><p><Clock3 /> Bài được tạo lúc {formatDate(post.createdAt)}</p></div></footer>
      </section>
    </div>

    {/* Modal Custody Transfer Request */}
    {custodyModalOpen && (
      <div className="custody-modal-overlay" onClick={() => setCustodyModalOpen(false)}>
        <div className="custody-modal" onClick={(e) => e.stopPropagation()}>
          <div className="custody-modal__header">
            <span className="modal-badge modal-badge--blue"><PackageCheck size={20} /></span>
            <div>
              <h3>Yêu cầu Bàn giao cho Quầy Staff (Custody)</h3>
              <p>Chuyển giao vật phẩm bài đăng <strong>{post.title}</strong> cho nhân viên lưu kho.</p>
            </div>
            <button type="button" className="close-btn" onClick={() => setCustodyModalOpen(false)}><X size={18} /></button>
          </div>

          <form className="admin-form modal-form" onSubmit={submitCustodyRequest}>
            <label className="input-field">
              <span>Điểm quầy nhận bàn giao <strong className="required-star">*</strong></span>
              <select value={selectedHpId} onChange={(e) => setSelectedHpId(e.target.value)} required>
                <option value="">-- Chọn điểm quầy bàn giao --</option>
                {handoverPoints.map((point) => (
                  <option key={point.id} value={point.id}>{point.name} - {point.address}</option>
                ))}
              </select>
            </label>

            <label className="input-field">
              <span>Ghi chú / Lời nhắn cho Staff</span>
              <textarea
                value={custodyReason}
                onChange={(e) => setCustodyReason(e.target.value)}
                rows={2}
                placeholder="Ví dụ: Tôi sẽ mang chìa khóa đến quầy vào giờ ra ra chơi 10h sáng..."
              />
            </label>

            <div className="custody-modal-actions">
              <button className="primary-button" disabled={submittingCustody || !selectedHpId}>
                {submittingCustody ? <LoaderCircle className="spin-icon" size={17} /> : <CheckCircle2 size={17} />}
                <span>Gửi Yêu cầu Bàn giao</span>
              </button>
              <button type="button" className="secondary-button" onClick={() => setCustodyModalOpen(false)}>Đóng</button>
            </div>
          </form>
        </div>
      </div>
    )}

    <section className="related-posts" aria-labelledby="related-posts-title">
      <header>
        <div><p className="eyebrow">Cùng danh mục</p><h2 id="related-posts-title">{post.type === "LOST" ? "Đồ nhặt được có thể liên quan" : "Bài báo mất có thể liên quan"}</h2><p>Hiển thị các bài {post.type === "LOST" ? "FOUND" : "LOST"} cùng danh mục, không giới hạn địa điểm. Đây là gợi ý tham khảo và vẫn cần xác minh.</p></div>
        <Link to={`/posts?type=${post.type === "LOST" ? "FOUND" : "LOST"}&categoryId=${post.category?.id ?? ""}`}>Xem tất cả <ArrowRight /></Link>
      </header>
      {relatedLoading ? <div className="post-grid" aria-label="Đang tải bài liên quan">{Array.from({ length: 3 }, (_, index) => <div className="post-skeleton" key={index}><i /><span /><span /><span /></div>)}</div>
        : relatedPosts.length ? <div className="post-grid">{relatedPosts.map((item) => <PostCard post={item} key={item.id} />)}</div>
        : <div className="related-posts__empty"><PackageCheck /><div><h3>Chưa có bài đối ứng cùng danh mục</h3><p>Hệ thống sẽ hiển thị tại đây khi có bài {post.type === "LOST" ? "FOUND" : "LOST"} phù hợp về danh mục.</p></div></div>}
    </section>
  </main>;
}
