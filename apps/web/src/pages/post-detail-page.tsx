import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Clock3, Eye, FileWarning, Inbox, LoaderCircle, LockKeyhole, MapPin, MessageCircle, PackageCheck, ScanSearch, ShieldAlert, Tag, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useNetworkStatus } from "../hooks/use-network-status.js";
import { useStaleDataNotice } from "../hooks/use-stale-data-notice.js";
import { PostCard, PostImage } from "./posts-page.js";
import { api, type CustodyReason, type PostCatalog, type PostSummary } from "../services/api.js";

const statusLabels: Record<PostSummary["status"] | "IN_CUSTODY", string> = {
  OPEN: "Đang mở",
  MATCHED: "Có gợi ý",
  RESOLVED: "Đã hoàn trả",
  CLOSED: "Đã đóng",
  EXPIRED: "Hết hạn",
  HIDDEN: "Đã ẩn",
  IN_CUSTODY: "Đang gửi tại kho trường"
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
  const [notice, setNotice] = useState("");
  const { online } = useNetworkStatus();
  const { stale, clearStale } = useStaleDataNotice(useCallback((path) => path.startsWith(`/posts/${postId}`), [postId]));

  // Custody escalation modal state
  const [custodyModalOpen, setCustodyModalOpen] = useState(false);
  const [submittingCustody, setSubmittingCustody] = useState(false);
  const [postCatalog, setPostCatalog] = useState<PostCatalog | null>(null);
  const [custodyForm, setCustodyForm] = useState<{
    reason: CustodyReason;
    reasonNotes: string;
    proposedHandoverPointId: string;
  }>({
    reason: "VOLUNTARY",
    reasonNotes: "",
    proposedHandoverPointId: ""
  });

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

  async function openCustodyModal() {
    if (!postCatalog) {
      try {
        const cat = await api.getPostCatalog();
        setPostCatalog(cat);
        setCustodyForm((prev) => ({
          ...prev,
          proposedHandoverPointId: prev.proposedHandoverPointId || cat.handoverPoints[0]?.id || ""
        }));
      } catch {
        // ignore
      }
    }
    setCustodyModalOpen(true);
  }

  async function handleCustodySubmit(e: FormEvent) {
    e.preventDefault();
    if (!post) return;
    setSubmittingCustody(true);
    setError("");
    try {
      await api.createCustodyRequest({
        postId: post.id,
        reason: custodyForm.reason,
        reasonNotes: custodyForm.reasonNotes || null,
        proposedHandoverPointId: custodyForm.proposedHandoverPointId || null,
        idempotencyKey: `custody-req-${post.id}`
      });
      setNotice("Đã gửi yêu cầu chuyển giao Custody thành công! Vui lòng chờ Staff xét duyệt.");
      setCustodyModalOpen(false);
    } catch (err: any) {
      setError(err?.message || "Không thể gửi yêu cầu chuyển giao");
    } finally {
      setSubmittingCustody(false);
    }
  }

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
  if (error && !post) return <section className="post-detail-page"><div className="posts-state is-error"><PackageCheck /><h1>Không mở được bài đăng</h1><p>{error || "Bài đăng không tồn tại hoặc bạn không có quyền xem."}</p><Link to="/posts"><ArrowLeft /> Quay lại bảng tin</Link></div></section>;
  if (!post) return null;

  const location = [post.location.building?.name, post.location.roomText, post.location.area?.name, post.location.customLocation].filter(Boolean).join(" · ");
  return <main className="post-detail-page">
    <div className="post-detail-topline">
      <Link className="post-detail-back" to="/posts"><ArrowLeft /> Quay lại bài đăng</Link>
      <div className="post-detail-actions">
        {post.canEdit && <Link className="post-detail-matches" to={`/posts/${post.id}/matches`}><ScanSearch /> Xem phân tích matching</Link>}
        {post.canEdit && post.type === "FOUND" && post.status !== "RESOLVED" && post.status !== "CLOSED" && (
          <button type="button" className="post-detail-matches" onClick={openCustodyModal}>
            <Inbox size={17} /> Chuyển giao cho Staff (Custody)
          </button>
        )}
        {!post.canEdit && <Link className="post-detail-matches" to={`/reports?targetType=POST&targetId=${post.id}`}><FileWarning /> Báo cáo bài đăng</Link>}
      </div>
    </div>
    {notice && (
      <div className="alert alert-success" style={{ margin: "1rem 0" }}>
        <CheckCircle2 size={18} /> {notice}
      </div>
    )}
    {error && (
      <div className="alert alert-danger" style={{ margin: "1rem 0" }}>
        <ShieldAlert size={18} /> {error}
      </div>
    )}
    {(!online || stale) && <div className="pwa-data-state" role="status">
      <strong>{online ? "Đang hiển thị dữ liệu lưu tạm" : "Bạn đang offline"}</strong>
      <span>{online ? "Kết nối đã khôi phục, hãy làm mới nếu cần dữ liệu mới nhất." : "Chi tiết bài có thể là dữ liệu cũ; thao tác cập nhật cần kết nối mạng."}</span>
    </div>}
    <div className="post-detail-grid">
      <section className="post-detail-visual" aria-label="Ảnh vật phẩm"><PostImage post={post} detail /></section>
      <section className="post-detail-content">
        <div className="post-detail-heading">
          <div className="post-detail-badges"><span className={`post-type-inline post-type-inline--${post.type.toLowerCase()}`}>{post.type}</span><span className={`post-status post-status--${post.status.toLowerCase()}`}>{statusLabels[post.status as keyof typeof statusLabels] ?? post.status}</span>{post.visibilityMode === "PRIVATE_DETAILS" && <span className="post-protected"><LockKeyhole /> Chi tiết được bảo vệ</span>}</div>
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

        {!post.canEdit && ["OPEN", "MATCHED"].includes(post.status) && <div className="post-detail-claim"><button className="post-claim-button post-claim-button--detail" type="button" onClick={claimAndChat}><MessageCircle /> Nhắn tin với người đăng</button><p>Nếu đã từng nhắn, hệ thống sẽ mở lại toàn bộ lịch sử; nếu chưa, cuộc trò chuyện chỉ được lưu sau tin nhắn đầu tiên.</p></div>}

        {post.handoverPoint && <section className="post-handover"><span><PackageCheck /></span><div><p className="eyebrow">Điểm bàn giao</p><h2>{post.handoverPoint.name}</h2><p>{post.handoverPoint.address ?? "Địa chỉ đang được cập nhật"}</p></div></section>}

        <footer className="post-detail-owner"><span><UserRound /></span><div><small>Người đăng</small><strong>{post.owner.fullName}</strong><p><Clock3 /> Bài được tạo lúc {formatDate(post.createdAt)}</p></div></footer>
      </section>
    </div>

    {/* Custody Request Modal */}
    {custodyModalOpen && (
      <div className="modal-overlay" onClick={() => setCustodyModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Chuyển giao cho Staff (Custody)</h2>
            <p>Nếu bạn không thể tiếp tục giữ đồ vật hoặc có lý do an toàn/tranh chấp, bạn có thể chuyển giao trách nhiệm bảo quản cho văn phòng trường.</p>
            <button type="button" className="modal-close" onClick={() => setCustodyModalOpen(false)}><X size={20} /></button>
          </div>
          <form className="modal-body" onSubmit={handleCustodySubmit}>
            <div className="form-group">
              <label>Lý do chuyển giao *</label>
              <select
                value={custodyForm.reason}
                onChange={(e) => setCustodyForm({ ...custodyForm, reason: e.target.value as CustodyReason })}
              >
                <option value="VOLUNTARY">Tự nguyện chuyển giao cho nhà trường</option>
                <option value="INACTIVITY">Không hoạt động quá lâu / Không có người liên hệ</option>
                <option value="SAFETY_CONCERN">Có vấn đề an toàn / Nghi ngờ lừa đảo</option>
                <option value="DISPUTE">Có tranh chấp giữa các bên</option>
                <option value="SENSITIVE_ITEM">Đồ vật giá trị cao / Nhạy cảm</option>
              </select>
            </div>
            <div className="form-group">
              <label>Ghi chú thêm</label>
              <textarea
                rows={3}
                placeholder="Mô tả lý do hoặc tình huống cụ thể..."
                value={custodyForm.reasonNotes}
                onChange={(e) => setCustodyForm({ ...custodyForm, reasonNotes: e.target.value })}
              />
            </div>
            {postCatalog && postCatalog.handoverPoints.length > 0 && (
              <div className="form-group">
                <label>Đề xuất điểm bàn giao</label>
                <select
                  value={custodyForm.proposedHandoverPointId}
                  onChange={(e) => setCustodyForm({ ...custodyForm, proposedHandoverPointId: e.target.value })}
                >
                  {postCatalog.handoverPoints.map((hp) => (
                    <option key={hp.id} value={hp.id}>{hp.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setCustodyModalOpen(false)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={submittingCustody}>
                {submittingCustody ? <LoaderCircle className="spin" size={16} /> : <Inbox size={16} />}
                Gửi yêu cầu
              </button>
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
