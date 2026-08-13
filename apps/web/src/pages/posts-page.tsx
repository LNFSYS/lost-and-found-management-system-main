import { ArrowLeft, ArrowRight, CalendarClock, Files, ImageOff, LockKeyhole, MapPin, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, type PostCatalog, type PostListFilters, type PostListResponse, type PostSummary } from "../services/api";

type BoardTab = "explore" | "mine";

const statusLabels: Record<PostSummary["status"], string> = {
  OPEN: "Đang mở",
  MATCHED: "Có gợi ý",
  RESOLVED: "Đã hoàn trả",
  CLOSED: "Đã đóng",
  EXPIRED: "Hết hạn",
  HIDDEN: "Đã ẩn"
};

function formatDate(value: string | null) {
  if (!value) return "Chưa rõ thời gian";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function itemLocation(post: PostSummary) {
  return [post.location.building?.name, post.location.roomText, post.location.area?.name, post.location.customLocation]
    .filter(Boolean)
    .join(" · ") || post.handoverPoint?.name || "Chưa công khai vị trí";
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

export function PostImage({ post, detail = false }: { post: PostSummary; detail?: boolean }) {
  const media = post.media.find((item) => item.mediaKind === "ITEM");
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setSource(null);
    if (!media) return () => { active = false; };
    api.getPostMedia(media.url)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setSource(objectUrl);
      })
      .catch(() => { if (active) setSource(""); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [media?.url]);

  return <div className={`${detail ? "post-detail__media" : "post-card__media"} post-card__media--${post.type.toLowerCase()}`}>
    {source ? <img src={source} alt={`Ảnh ${post.title}`} /> : <div className="post-card__placeholder"><ImageOff /><span>{source === "" ? "Không tải được ảnh" : media ? "Đang tải ảnh" : "Chưa có ảnh"}</span></div>}
    <span className={`post-type post-type--${post.type.toLowerCase()}`}>{post.type}</span>
    {post.visibilityMode === "PRIVATE_DETAILS" && <span className="post-private" title="Chi tiết được bảo vệ"><LockKeyhole /></span>}
  </div>;
}

export function PostCard({ post }: { post: PostSummary }) {
  return <article className="post-card">
    <Link className="post-card__image-link" to={`/posts/${post.id}`} aria-label={`Xem chi tiết ${post.title}`}><PostImage post={post} /></Link>
    <div className="post-card__body">
      <div className="post-card__title"><h2><Link to={`/posts/${post.id}`}>{post.title}</Link></h2>{post.category?.name && <span>{post.category.name}</span>}</div>
      <div className="post-card__facts">
        <p><MapPin /> {itemLocation(post)}</p>
        <p><CalendarClock /> {formatDate(post.lostFoundAt)}</p>
      </div>
      <p className="post-card__description">{post.description ?? "Chi tiết nhận dạng được giữ riêng để hỗ trợ xác minh quyền sở hữu."}</p>
      <footer>
        <div className="post-owner"><span>{initials(post.owner.fullName)}</span><strong>{post.owner.fullName}</strong></div>
        <Link className="post-detail-link" to={`/posts/${post.id}`}>Xem chi tiết <ArrowRight /></Link>
      </footer>
    </div>
  </article>;
}

export function PostsPage() {
  const initialQuery = useMemo(() => new URLSearchParams(window.location.search), []);
  const [tab, setTab] = useState<BoardTab>("explore");
  const [catalog, setCatalog] = useState<PostCatalog | null>(null);
  const [result, setResult] = useState<PostListResponse | null>(null);
  const [filters, setFilters] = useState<PostListFilters>({
    page: 1,
    pageSize: 9,
    sort: "newest",
    type: (initialQuery.get("type") as PostListFilters["type"]) || undefined,
    categoryId: initialQuery.get("categoryId") || undefined
  });
  const [searchDraft, setSearchDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const leafCategories = useMemo(() => catalog?.categories.filter((category) => category.parentId !== null) ?? [], [catalog]);
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 9)));

  useEffect(() => { api.getPostCatalog().then(setCatalog).catch(() => undefined); }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const request = tab === "mine" ? api.listMyPosts(filters) : api.listPosts(filters);
    request.then((value) => { if (active) setResult(value); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab, filters]);

  function changeTab(nextTab: BoardTab) {
    setTab(nextTab);
    setFilters({ page: 1, pageSize: 9, sort: "newest" });
    setSearchDraft("");
  }

  function search(event: FormEvent) {
    event.preventDefault();
    setFilters((current) => ({ ...current, q: searchDraft.trim() || undefined, page: 1 }));
  }

  function updateFilter<K extends keyof PostListFilters>(key: K, value: PostListFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }));
  }

  return <section className="posts-page" aria-labelledby="posts-title">
    <header className="posts-heading">
      <div><p className="eyebrow">Bảng tin campus</p><h1 id="posts-title">Bài đăng</h1><p>Tìm báo cáo thất lạc, theo dõi vật phẩm bạn đã đăng và xem trạng thái xử lý.</p></div>
      <Link className="posts-create" to="/home#two-sides"><Plus /> Tạo bài đăng</Link>
    </header>

    <div className="posts-tabs" role="tablist" aria-label="Phạm vi bài đăng">
      <button role="tab" aria-selected={tab === "explore"} className={tab === "explore" ? "active" : ""} onClick={() => changeTab("explore")}><Search /> Khám phá bài đăng</button>
      <button role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "active" : ""} onClick={() => changeTab("mine")}><Files /> Bài đăng của tôi</button>
    </div>

    <div className="posts-toolbar">
      <form onSubmit={search} className="posts-search"><Search /><input aria-label="Tìm kiếm bài đăng" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Tìm theo tên đồ vật, từ khóa..." /><button type="submit">Tìm</button></form>
      <label><span className="sr-only">Loại bài</span><select aria-label="Loại bài" value={filters.type ?? ""} onChange={(event) => updateFilter("type", event.target.value as PostListFilters["type"])}><option value="">Tất cả loại</option><option value="LOST">Đồ bị mất</option><option value="FOUND">Đồ nhặt được</option></select></label>
      <label><span className="sr-only">Danh mục</span><select aria-label="Danh mục" value={filters.categoryId ?? ""} onChange={(event) => updateFilter("categoryId", event.target.value)}><option value="">Tất cả danh mục</option>{leafCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
      {tab === "mine" && <label><span className="sr-only">Trạng thái</span><select aria-label="Trạng thái" value={filters.status ?? ""} onChange={(event) => updateFilter("status", event.target.value as PostListFilters["status"])}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
      <label className="posts-sort"><SlidersHorizontal /><span className="sr-only">Sắp xếp</span><select aria-label="Sắp xếp" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value as PostListFilters["sort"])}><option value="newest">Mới đăng</option><option value="incident_newest">Mới xảy ra</option><option value="incident_oldest">Cũ nhất theo sự việc</option><option value="oldest">Cũ nhất</option></select></label>
    </div>

    <div className="posts-result-meta"><strong>{result?.total ?? 0}</strong><span>{tab === "mine" ? "bài đăng của bạn" : "bài đang hiển thị trên bảng tin"}</span></div>

    {loading ? <div className="post-grid" aria-label="Đang tải bài đăng">{Array.from({ length: 6 }, (_, index) => <div className="post-skeleton" key={index}><i /><span /><span /><span /></div>)}</div>
      : error ? <div className="posts-state is-error"><Files /><h2>Không tải được bài đăng</h2><p>{error}</p><button onClick={() => setFilters((current) => ({ ...current }))}>Thử lại</button></div>
      : !result?.items.length ? <div className="posts-state"><Search /><h2>{tab === "mine" ? "Bạn chưa có bài đăng phù hợp" : "Không tìm thấy bài đăng phù hợp"}</h2><p>{tab === "mine" ? "Tạo một báo cáo LOST hoặc FOUND để bắt đầu theo dõi hành trình vật phẩm." : "Hãy đổi từ khóa hoặc bộ lọc để xem thêm kết quả."}</p>{tab === "mine" && <Link to="/home#two-sides">Tạo bài đầu tiên</Link>}</div>
      : <div className="post-grid">{result.items.map((post) => <PostCard post={post} key={post.id} />)}</div>}

    {!loading && !error && totalPages > 1 && <nav className="posts-pagination" aria-label="Phân trang bài đăng"><button disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) - 1 }))}><ArrowLeft /> Trước</button><span>Trang <strong>{filters.page ?? 1}</strong> / {totalPages}</span><button disabled={(filters.page ?? 1) >= totalPages} onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))}>Sau <ArrowRight /></button></nav>}
  </section>;
}
