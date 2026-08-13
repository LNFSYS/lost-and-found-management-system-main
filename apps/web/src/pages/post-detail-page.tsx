import { ArrowLeft, ArrowRight, CalendarClock, Clock3, Eye, LockKeyhole, MapPin, PackageCheck, Tag, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
  const [post, setPost] = useState<PostSummary | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<PostSummary[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  }, [postId]);

  if (loading) return <section className="post-detail-page"><div className="post-detail-loading"><i /><div><span /><span /><span /></div></div></section>;
  if (error || !post) return <section className="post-detail-page"><div className="posts-state is-error"><PackageCheck /><h1>Không mở được bài đăng</h1><p>{error || "Bài đăng không tồn tại hoặc bạn không có quyền xem."}</p><Link to="/posts"><ArrowLeft /> Quay lại bảng tin</Link></div></section>;

  const location = [post.location.building?.name, post.location.roomText, post.location.area?.name, post.location.customLocation].filter(Boolean).join(" · ");
  return <main className="post-detail-page">
    <Link className="post-detail-back" to="/posts"><ArrowLeft /> Quay lại bài đăng</Link>
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

        {post.handoverPoint && <section className="post-handover"><span><PackageCheck /></span><div><p className="eyebrow">Điểm bàn giao</p><h2>{post.handoverPoint.name}</h2><p>{post.handoverPoint.address ?? "Địa chỉ đang được cập nhật"}</p></div></section>}

        <footer className="post-detail-owner"><span><UserRound /></span><div><small>Người đăng</small><strong>{post.owner.fullName}</strong><p><Clock3 /> Bài được tạo lúc {formatDate(post.createdAt)}</p></div></footer>
      </section>
    </div>

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
