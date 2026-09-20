import { ArrowDown, ArrowRight, CalendarCheck, Check, Clock3, Image, LoaderCircle, MapPin, MessageCircle, RotateCcw, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StoryPostForm, type StoryPostCreatedEvent } from "../components/story-post-form";
import { api, type ImageAnalysisResult, type PostMatchResult, type PostSummary } from "../services/api";
import heroCampusImage from "../assets/fptu-da-nang-campus.jpg";

type StorySide = "LOST" | "FOUND";
type StageAlign = "left" | "center" | "right";
type ConnectorDirection = "left-right" | "right-left" | "left-center" | "center-right" | "right-center";
type WorkflowPhase = "idle" | "analyzing" | "draft-ready" | "searching" | "results" | "no-results";

const storyCopy: Record<StorySide, { label: string; title: string; description: string; item: string; time: string }> = {
  LOST: { label: "Tôi làm mất đồ", title: "Gửi đi một dấu hiệu", description: "Mô tả điều bạn còn nhớ. Hệ thống sẽ lưu lại và tìm trong các báo nhặt được đang mở.", item: "Vật phẩm thất lạc", time: "Thông tin do người dùng nhập" },
  FOUND: { label: "Tôi nhặt được đồ", title: "Trao lại một cơ hội", description: "Ghi nhận món đồ, thời gian và nơi nhặt được để chủ sở hữu có cơ hội tìm thấy.", item: "Vật phẩm nhặt được", time: "Thông tin do người dùng nhập" }
};

const connectorPaths: Record<ConnectorDirection, string> = {
  "left-right": "M25 0 C25 56 75 44 75 100",
  "right-left": "M75 0 C75 56 25 44 25 100",
  "left-center": "M25 0 C25 54 50 46 50 100",
  "center-right": "M50 0 C50 54 75 46 75 100",
  "right-center": "M75 0 C75 54 50 46 50 100"
};

const stageMotion = {
  initial: { opacity: 0.72, y: 34 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.14 },
  transition: { duration: 0.68, ease: [0.22, 1, 0.36, 1] as const }
};

function StageMarker({ number, label, align = "left", dark = false }: { number: string; label: string; align?: StageAlign; dark?: boolean }) {
  return <motion.div
    className={`story-stage-marker story-stage-marker--${align} ${dark ? "story-stage-marker--dark" : ""}`}
    initial={{ opacity: 0, y: 14 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.8 }}
    transition={{ duration: 0.45 }}
  >
    <motion.span initial={{ scale: 0.65 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>{number}</motion.span>
    <strong>{label}</strong>
  </motion.div>;
}

function StoryConnector({ direction, dark = false }: { direction: ConnectorDirection; dark?: boolean }) {
  const path = connectorPaths[direction];
  return <div className={`story-connector ${dark ? "story-connector--dark" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <path className="story-connector-base" d={path} />
      <motion.path className="story-connector-active" d={path} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.65 }} transition={{ duration: 0.9, ease: "easeInOut" }} />
      <motion.circle cx={direction.endsWith("right") ? 75 : direction.endsWith("left") ? 25 : 50} cy="100" r="2.6" initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.72, type: "spring" }} />
    </svg>
    <motion.span className="story-connector-mobile" initial={{ scaleY: 0.18 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }} />
  </div>;
}

function StoryStage({ children, className, id }: { children: ReactNode; className: string; id?: string }) {
  return <motion.section id={id} className={`story-stage ${className}`} {...stageMotion}>{children}</motion.section>;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function postLocation(post: PostSummary) {
  return [
    post.location.building?.name,
    post.location.area?.name,
    post.location.roomText,
    post.location.customLocation
  ].filter(Boolean).join(" · ") || "Chưa công khai vị trí";
}

function WorkflowPostImage({ post }: { post: PostSummary }) {
  const mediaPath = post.media[0]?.url;
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaPath) {
      setSource(null);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    api.getPostMedia(mediaPath)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => { if (active) setSource(null); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaPath]);

  return source
    ? <img src={source} alt="" loading="lazy" decoding="async" />
    : <span className="workflow-result-image__fallback"><Image aria-hidden="true" /></span>;
}

function WorkflowResultCard({ match }: { match: PostMatchResult }) {
  const post = match.candidate;
  return <Link className="workflow-result-card" to={`/posts/${post.id}`}>
    <span className="workflow-result-image"><WorkflowPostImage post={post} /></span>
    <span className="workflow-result-card__copy">
      <small>{post.type} · {post.category?.name ?? "Chưa phân loại"}</small>
      <strong>{post.title}</strong>
      <span>{postLocation(post)}</span>
      <span className="workflow-result-score">{Math.round(match.totalScore * 100)}% tương đồng</span>
      <em>Xem chi tiết <ArrowRight size={15} /></em>
    </span>
  </Link>;
}

function ActiveImageAnalysisPanel({
  phase,
  previewUrls,
  result,
  onReviewDraft,
  onReset
}: {
  phase: "analyzing" | "draft-ready";
  previewUrls: string[];
  result: ImageAnalysisResult | null;
  onReviewDraft: () => void;
  onReset: () => void;
}) {
  const isReady = phase === "draft-ready" && result;
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    setActiveImageIndex(0);
    if (phase !== "analyzing") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const imageTimer = previewUrls.length > 1
      ? window.setInterval(() => setActiveImageIndex((current) => (current + 1) % previewUrls.length), 1350)
      : null;
    return () => {
      if (imageTimer) window.clearInterval(imageTimer);
    };
  }, [phase, previewUrls.length]);

  return <div className="analysis-layout workflow-analysis-layout" aria-busy={!isReady}>
    <div className="story-heading story-heading--left stage-copy-card">
      <p className="story-index">{isReady ? "Bản nháp từ ảnh đã sẵn sàng" : "Hệ thống đang phân tích ảnh"}</p>
      <h2>{isReady ? "Những chi tiết nhìn thấy đã được đưa vào form." : "Ảnh đang được phân tích để tạo bản nháp."}</h2>
      <p>{isReady
        ? "Tên, mô tả và danh mục là gợi ý từ ảnh. Bạn vẫn là người kiểm tra, bổ sung vị trí, thời gian và quyết định đăng."
        : "Hệ thống chỉ nhận diện các đặc điểm nhìn thấy trong ảnh. Vị trí, thời gian và quyền sở hữu do người dùng bổ sung và kiểm tra."}</p>
      <div className="workflow-analysis-actions">
        {isReady && <button type="button" onClick={onReviewDraft}>Kiểm tra bản nháp <ArrowRight size={17} /></button>}
        <button type="button" className="is-secondary" onClick={onReset}><RotateCcw size={16} /> Kết thúc phiên</button>
      </div>
    </div>
    <div className={`workflow-image-scanner ${isReady ? "is-complete" : "is-scanning"}`} role="status" aria-live="polite">
      <div className="workflow-image-scanner__visual">
        <div className="workflow-image-scanner__media">
          {previewUrls.length
            ? previewUrls.map((url, index) => <img className={index === activeImageIndex ? "is-active" : ""} src={url} alt={`Góc chụp vật phẩm ${index + 1}`} loading={index === activeImageIndex ? "eager" : "lazy"} decoding="async" key={url} />)
            : <span><Image /></span>}
        </div>
        {!isReady && <div className="workflow-image-scanner__beam" aria-hidden="true"><i /></div>}
        <span className="workflow-image-scanner__corner is-top-left" />
        <span className="workflow-image-scanner__corner is-top-right" />
        <span className="workflow-image-scanner__corner is-bottom-left" />
        <span className="workflow-image-scanner__corner is-bottom-right" />
        <strong className="workflow-image-scanner__status">
          {isReady ? <><Check /> Đã phân tích {result.imageCount || previewUrls.length} ảnh</> : <><LoaderCircle /> Đang phân tích {previewUrls.length} ảnh</>}
        </strong>
        {previewUrls.length > 1 && <div className="workflow-image-scanner__filmstrip" aria-hidden="true">
          {previewUrls.map((url, index) => <span className={index === activeImageIndex ? "is-active" : ""} key={url}><img src={url} alt="" loading="lazy" decoding="async" /><i>{index + 1}</i></span>)}
        </div>}
      </div>
      {isReady && <div className="workflow-analysis-readout" aria-live="polite">
        <>
          <span><small>Tên gợi ý</small><strong>{result.title}</strong></span>
          <span><small>Danh mục</small><strong>{result.suggestedCategory?.name ?? "Cần người dùng chọn"}</strong></span>
          <span><small>Đặc điểm nhìn thấy</small><strong>{result.visualAttributes.slice(0, 3).join(", ") || "Chưa nhận diện rõ"}</strong></span>
          <span><small>Chữ nhìn thấy</small><strong>{result.visibleText.slice(0, 3).join(", ") || "Không nhận diện được"}</strong></span>
          <span><small>Nguyên tắc</small><strong>Người dùng kiểm tra lại</strong></span>
        </>
      </div>}
    </div>
  </div>;
}

function ActiveSearchPanel({
  phase,
  storySide,
  createdPost,
  suggestions,
  error,
  onReset
}: {
  phase: "searching" | "results" | "no-results";
  storySide: StorySide;
  createdPost: StoryPostCreatedEvent["post"] | null;
  suggestions: PostMatchResult[];
  error: string;
  onReset: () => void;
}) {
  const searching = phase === "searching";
  const oppositeType = storySide === "LOST" ? "FOUND" : "LOST";
  return <div className="processing-inner">
    <div className="processing-copy">
      <p className="story-index">{searching ? "Đang đối chiếu dữ liệu thật" : "Đã hoàn tất lượt quét"}</p>
            <h2>{searching ? `Đang chấm điểm các bài ${oppositeType} có khả năng liên quan.` : suggestions.length ? `Tìm thấy ${suggestions.length} ứng viên vượt ngưỡng lưu.` : "Chưa có ứng viên vượt ngưỡng matching."}</h2>
      <p>Hệ thống so sánh mô tả, danh mục, vị trí, thời gian, tín hiệu ảnh và OCR. Điểm số chỉ là gợi ý; sau đó hai bên có thể mở claim và trao đổi riêng để xác minh.</p>
      <div className="processing-stats">
        <span><strong>{createdPost ? "1" : "0"}</strong><small>bài vừa đăng</small></span>
        <span><strong>{oppositeType}</strong><small>loại đang tìm</small></span>
        <span><strong>{searching ? "..." : suggestions.length}</strong><small>ứng viên</small></span>
      </div>
      {error && <div className="workflow-search-error">{error}</div>}
      {!searching && <button type="button" className="workflow-reset-button" onClick={onReset}><RotateCcw size={16} /> Kết thúc phiên</button>}
    </div>
    <div className={`scan-board workflow-scan-board ${searching ? "is-searching" : "is-complete"}`}>
      <div className="scan-status">
        {searching ? <LoaderCircle size={14} /> : <Check size={14} />}
        <span>{searching ? "Đang quét báo cáo trong hệ thống" : "Đã hoàn tất lượt quét hiện tại"}</span>
      </div>
      {searching && <div className="workflow-scan-beam" aria-hidden="true"><i /></div>}
      {searching ? <div className="workflow-no-candidates">
        <LoaderCircle className="is-spinning" />
        <strong>Đang tải kết quả matching</strong>
        <span>Ứng viên sẽ hiển thị sau khi API hoàn tất đối chiếu dữ liệu.</span>
      </div> : suggestions.slice(0, 3).map((item, index) => <article className={index === 0 ? "is-candidate" : ""} key={item.matchId}>
          <small>{item.candidate.type} · {item.candidate.category?.name ?? "Chưa phân loại"}</small>
          <strong>{item.candidate.title}</strong>
          <span>{postLocation(item.candidate)}</span>
          {index === 0 && <b>{Math.round(item.totalScore * 100)}% · ứng viên cao nhất</b>}
        </article>)}
      {!searching && suggestions.length === 0 && <div className="workflow-no-candidates">
        <ScanSearch />
        <strong>Chưa tìm thấy ứng viên</strong>
        <span>Bài của bạn vẫn ở trạng thái mở và có thể được đối chiếu khi có báo cáo mới.</span>
      </div>}
    </div>
  </div>;
}

export function HomePage() {
  const navigate = useNavigate();
  const [storySide, setStorySide] = useState<StorySide>("LOST");
  const [workflowPhase, setWorkflowPhase] = useState<WorkflowPhase>("idle");
  const [workflowSession, setWorkflowSession] = useState(0);
  const [analysisFiles, setAnalysisFiles] = useState<File[]>([]);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [createdPost, setCreatedPost] = useState<StoryPostCreatedEvent["post"] | null>(null);
  const [suggestions, setSuggestions] = useState<PostMatchResult[]>([]);
  const [workflowError, setWorkflowError] = useState("");
  const workflowRequest = useRef(0);
  const selected = storyCopy[storySide];
  const analysisPreviewUrls = useMemo(
    () => analysisFiles.map((file) => URL.createObjectURL(file)),
    [analysisFiles]
  );

  useEffect(() => () => {
    analysisPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [analysisPreviewUrls]);

  function scrollToStage(selector: string, delay = 0) {
    window.setTimeout(() => {
      document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, delay);
  }

  function resetWorkflow() {
    workflowRequest.current += 1;
    setWorkflowPhase("idle");
    setAnalysisFiles([]);
    setAnalysisResult(null);
    setCreatedPost(null);
    setSuggestions([]);
    setWorkflowError("");
    setWorkflowSession((current) => current + 1);
  }

  function chooseStory(side: StorySide) {
    resetWorkflow();
    setStorySide(side);
    scrollToStage("#quick-story");
  }

  function startImageAnalysis(files: File[]) {
    workflowRequest.current += 1;
    setAnalysisFiles(files);
    setAnalysisResult(null);
    setCreatedPost(null);
    setSuggestions([]);
    setWorkflowError("");
    setWorkflowPhase("analyzing");
    scrollToStage("#system-analysis", 60);
  }

  function completeImageAnalysis(result: ImageAnalysisResult) {
    setAnalysisResult(result);
    setWorkflowPhase("draft-ready");
    scrollToStage("#quick-story", 650);
  }

  function failImageAnalysis(message: string) {
    setWorkflowError(message);
    setWorkflowPhase("idle");
    setAnalysisFiles([]);
  }

  function resetImageAnalysis() {
    workflowRequest.current += 1;
    setWorkflowPhase("idle");
    setAnalysisFiles([]);
    setAnalysisResult(null);
    setWorkflowError("");
  }

  async function handlePostCreated(event: StoryPostCreatedEvent) {
    const requestId = ++workflowRequest.current;
    setCreatedPost(event.post);
    setSuggestions([]);
    setWorkflowError("");
    setWorkflowPhase("searching");
    scrollToStage("#matching-search", 80);

    try {
      const [response] = await Promise.all([
        api.getPostMatches(event.post.id),
        wait(1600)
      ]);
      if (requestId !== workflowRequest.current) return;
      const items = response.results;
      setSuggestions(items);
      setWorkflowPhase(items.length ? "results" : "no-results");
      window.setTimeout(() => {
        if (requestId === workflowRequest.current) navigate(`/posts/${event.post.id}/matches`);
      }, 650);
    } catch (reason) {
      if (requestId !== workflowRequest.current) return;
      setWorkflowError(reason instanceof Error ? reason.message : "Không thể tải gợi ý lúc này.");
      setWorkflowPhase("no-results");
    }
  }

  return <div className="home-page">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="hero-grid" id="journey-start">
        <div className="hero-copy">
          <p className="story-kicker"><span /> FPTU Lost &amp; Found</p>
          <h1 id="home-title">Đồ thất lạc,<br /><em>có đường về.</em></h1>
          <p className="hero-lead">Hệ thống giúp kết nối người mất và người nhặt bằng thông tin, hình ảnh và phòng trao đổi riêng tư.</p>
          <div className="campus-strip" aria-label="Thông tin campus">
            <span><MapPin size={16} /> FPTU Đà Nẵng</span>
            <span><Clock3 size={16} /> 8:00 - 17:30</span>
            <span><ShieldCheck size={16} /> Điểm tiếp nhận</span>
          </div>
          <div className="hero-actions">
            <button className="journey-button journey-button--orange" onClick={() => chooseStory("LOST")}>Báo mất đồ <ArrowRight size={18} /></button>
            <button className="journey-button journey-button--ghost" onClick={() => chooseStory("FOUND")}>Đăng đồ nhặt được</button>
          </div>
          <div className="hero-stats" aria-label="Thống kê nhanh">
            <span><strong>LOST</strong><small>Báo mất đồ</small></span>
            <span><strong>FOUND</strong><small>Báo nhặt được</small></span>
            <span><strong>CLAIM</strong><small>Yêu cầu xác minh</small></span>
            <span><strong>CHAT</strong><small>Trao đổi riêng</small></span>
          </div>
          <a className="scroll-cue" href="#two-sides"><ArrowDown size={16} /> Cuộn để theo dấu món đồ</a>
        </div>
        <div className="hero-stage">
          <figure className="hero-campus-photo">
            <img src={heroCampusImage} alt="FPT University Đà Nẵng campus với tòa Alpha và cầu nối màu cam" decoding="async" />
          </figure>
          <div className="hero-workflow" aria-label="Quy trình xử lý nhanh">
            <span><ScanSearch size={15} /> Báo tin</span><i /><span><Sparkles size={15} /> Gợi ý trùng khớp</span><i /><span><MessageCircle size={15} /> Trao đổi riêng</span>
          </div>
        </div>
      </div>
    </section>

    <div className="story-journey">
      <StoryStage className="story-section two-sides story-stage--report" id="two-sides">
        <StageMarker number="01" label="Báo tin" align="left" />
        <div className="story-heading">
          <p className="story-index">Bắt đầu</p>
          <h2>Chọn câu chuyện gần với bạn nhất</h2>
          <p>Mỗi món đồ thường bắt đầu từ một trong hai tình huống. Hãy chọn hướng phù hợp để tiếp tục hành trình tìm lại hoặc trao trả vật phẩm.</p>
        </div>
        <div className="choice-grid">
          <button type="button" aria-pressed={storySide === "LOST"} className={`choice-panel choice-panel--lost ${storySide === "LOST" ? "is-selected" : ""}`} onClick={() => chooseStory("LOST")}>
            <span className="choice-topline"><span className="choice-code">LOST / 01</span><span className="choice-check"><Check size={14} /> Đang chọn</span></span>
            <span className="choice-icon"><ScanSearch /></span>
            <span className="choice-copy"><span className="choice-title">Tôi làm mất đồ</span><span className="choice-description">Mô tả vật phẩm, thời gian và địa điểm bạn nhớ để hệ thống tìm các báo cáo phù hợp.</span></span>
            <span className="choice-meta"><span>Vật phẩm đã mất</span><span>Vị trí gần nhất</span><span>Gợi ý phù hợp</span></span>
            <strong className="choice-action">Bắt đầu báo mất <ArrowRight size={17} /></strong>
          </button>
          <button type="button" aria-pressed={storySide === "FOUND"} className={`choice-panel choice-panel--found ${storySide === "FOUND" ? "is-selected" : ""}`} onClick={() => chooseStory("FOUND")}>
            <span className="choice-topline"><span className="choice-code">FOUND / 02</span><span className="choice-check"><Check size={14} /> Đang chọn</span></span>
            <span className="choice-icon"><Sparkles /></span>
            <span className="choice-copy"><span className="choice-title">Tôi nhặt được đồ</span><span className="choice-description">Gửi thông tin món đồ nhặt được để chủ sở hữu có cơ hội nhận lại an toàn.</span></span>
            <span className="choice-meta"><span>Món đồ tìm thấy</span><span>Điểm giao nộp</span><span>Staff xác minh</span></span>
            <strong className="choice-action">Bắt đầu báo nhặt <ArrowRight size={17} /></strong>
          </button>
        </div>
        <StoryConnector direction="left-right" />
      </StoryStage>

      <StoryStage className="story-section quick-story story-stage--describe" id="quick-story">
        <StageMarker number="02" label="Mô tả nhanh" align="right" />
        <div className="input-story">
          <div className="story-heading story-heading--left stage-copy-card"><p className="story-index">Thông tin ban đầu</p><h2>{selected.title}</h2><p>{selected.description}</p><div className="stage-benefits"><span><Check size={15} /> Nhập nhanh trong vài phút</span><span><Check size={15} /> Có thể thêm ảnh minh chứng</span><span><Check size={15} /> Dữ liệu được chuyển sang bước so sánh</span></div></div>
          <StoryPostForm
            key={`${storySide}-${workflowSession}`}
            type={storySide}
            onAnalysisStart={startImageAnalysis}
            onAnalysisComplete={completeImageAnalysis}
            onAnalysisError={failImageAnalysis}
            onAnalysisReset={resetImageAnalysis}
            onPostCreated={handlePostCreated}
            onSessionReset={resetWorkflow}
          />
        </div>
        <div className="data-bridge" aria-hidden="true"><span>{selected.item}</span><span>Tòa Alpha</span><span>{selected.time}</span><i /></div>
        <StoryConnector direction="right-left" />
      </StoryStage>

      <StoryStage className="story-section analysis-story story-stage--analysis" id="system-analysis">
        <StageMarker number="03" label="Hệ thống xử lý" align="left" />
        {workflowPhase === "analyzing" || workflowPhase === "draft-ready"
          ? <ActiveImageAnalysisPanel
              phase={workflowPhase}
              previewUrls={analysisPreviewUrls}
              result={analysisResult}
              onReviewDraft={() => scrollToStage("#quick-story")}
              onReset={resetWorkflow}
            />
          : <div className="analysis-layout">
          <div className="story-heading story-heading--left stage-copy-card"><p className="story-index">Dữ liệu đi vào hệ thống</p><h2>Những chi tiết rời rạc được sắp xếp lại.</h2><p>Thông tin được chuẩn hóa thành các dấu hiệu có thể so sánh. Đây là bước chuẩn bị dữ liệu, chưa phải kết luận matching.</p><div className="stage-note"><Sparkles size={18} /><span>Mục tiêu là biến mô tả tự do thành các tín hiệu rõ ràng: tên đồ, nơi xảy ra, thời gian và đặc điểm nhận dạng.</span></div></div>
          <div className="analysis-pipeline">
            {[
              { title: "Chuẩn hóa thông tin", desc: "Làm sạch tên đồ, thời gian, địa điểm." },
              { title: "Phân tích mô tả", desc: "Nhận diện màu sắc, chất liệu, dấu hiệu riêng." },
              { title: "Trích xuất dấu hiệu", desc: "Tạo bộ tín hiệu dùng để đối chiếu." },
              { title: "Sẵn sàng so sánh", desc: "Đưa vào hàng chờ tìm báo cáo phù hợp." }
            ].map((step, index) => <motion.article key={step.title} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.11 }}><span>0{index + 1}</span><strong>{step.title}</strong><small>{step.desc}</small><i><Check size={15} /></i></motion.article>)}
          </div>
        </div>}
        <StoryConnector direction="left-right" />
      </StoryStage>

      <StoryStage className="processing-story story-stage--search" id="matching-search">
        <StageMarker number="04" label="Tìm kiếm và so sánh" align="right" dark />
        {workflowPhase === "searching" || workflowPhase === "results" || workflowPhase === "no-results"
          ? <ActiveSearchPanel
              phase={workflowPhase}
              storySide={storySide}
              createdPost={createdPost}
              suggestions={suggestions}
              error={workflowError}
              onReset={resetWorkflow}
            />
          : <div className="processing-inner">
          <div className="processing-copy"><p className="story-index">Hệ thống tiếp nhận</p><h2>Matching sẽ hiển thị khi có dữ liệu thật.</h2><p>Thông tin được kiểm tra, phân loại và so sánh với các báo cáo đang mở. Điểm tương đồng chỉ là gợi ý để người dùng xem lại và mở claim khi phù hợp.</p><div className="processing-stats"><span><strong>LOST / FOUND</strong><small>loại bài được đối chiếu</small></span><span><strong>Matching</strong><small>gợi ý theo nhiều tín hiệu</small></span><span><strong>Claim</strong><small>trao đổi riêng sau matching</small></span></div><div className="signal-list"><span><Check /> Mô tả &amp; OCR</span><span><Check /> Danh mục &amp; ảnh</span><span><Check /> Gần thời gian</span><span><Check /> Cùng khu vực</span></div></div>
          <div className="scan-board">
            <div className="scan-status"><ScanSearch size={14} /><span>Chờ dữ liệu matching thực tế</span></div>
            <div className="workflow-no-candidates"><ScanSearch /><strong>Chưa có ứng viên để hiển thị</strong><span>Kết quả sẽ được lấy từ các bài đăng đang mở sau khi người dùng hoàn tất báo mất hoặc báo nhặt.</span></div>
          </div>
        </div>}
        <StoryConnector direction="right-left" dark />
      </StoryStage>

      <StoryStage className="match-moment story-stage--match" id="potential-match">
        <StageMarker number="05" label="Gợi ý phù hợp" align="left" />
        {workflowPhase === "results" ? <>
          <div className="match-copy workflow-match-copy">
            <p className="story-index">Kết quả từ dữ liệu đang mở</p>
            <h2>Có {suggestions.length} bài {storySide === "LOST" ? "FOUND" : "LOST"} đạt ngưỡng matching để bạn đối chiếu.</h2>
            <p>Mỗi ứng viên có tổng điểm, sáu điểm thành phần và lý do cụ thể. Hệ thống không kết luận quyền sở hữu và không tự động trao đồ.</p>
            {createdPost && <Link className="workflow-created-post" to={`/posts/${createdPost.id}`}>
              <span>Bài vừa đăng</span><strong>{createdPost.title}</strong><ArrowRight size={17} />
            </Link>}
          </div>
          <div className="workflow-results-grid">
            {suggestions.map((match) => <WorkflowResultCard key={match.matchId} match={match} />)}
          </div>
          <div className="match-alert"><MessageCircle size={18} /><span>Mọi ứng viên cần được người dùng xem lại trước khi mở claim và trao đổi riêng.</span></div>
          <button type="button" className="workflow-reset-button workflow-reset-button--light" onClick={resetWorkflow}><RotateCcw size={16} /> Kết thúc phiên và trở về storytelling</button>
        </> : workflowPhase === "no-results" ? <>
          <div className="match-copy workflow-match-copy">
            <p className="story-index">Chưa có ứng viên trong lượt quét này</p>
            <h2>Bài đã được đăng và vẫn tiếp tục ở trạng thái mở.</h2>
            <p>Khi có bài {storySide === "LOST" ? "FOUND" : "LOST"} cùng danh mục xuất hiện, bạn có thể xem lại trong bảng tin. Không có kết quả lúc này không đồng nghĩa món đồ không còn trong hệ thống.</p>
          </div>
          <div className="workflow-empty-match">
            <ScanSearch />
            <strong>0 ứng viên vượt ngưỡng matching</strong>
            <span>{workflowError || "Bạn có thể tiếp tục theo dõi bài trong mục Bài đăng của tôi."}</span>
            <Link to={createdPost ? `/posts/${createdPost.id}/matches` : "/my-posts"}>Mở kết quả matching <ArrowRight size={16} /></Link>
          </div>
          <button type="button" className="workflow-reset-button workflow-reset-button--light" onClick={resetWorkflow}><RotateCcw size={16} /> Kết thúc phiên</button>
        </> : workflowPhase === "searching" ? <div className="workflow-match-waiting">
          <LoaderCircle />
          <p className="story-index">Lượt quét đang chạy</p>
          <h2>Kết quả sẽ xuất hiện tại đây.</h2>
          <p>Hệ thống đang chấm điểm bài đối ứng theo mô tả, danh mục, vị trí, thời gian, tag ảnh và OCR.</p>
        </div> : <>
          <div className="match-copy"><p className="story-index">Gợi ý phù hợp</p><h2>Kết quả matching sẽ xuất hiện sau khi có bài đăng đối ứng.</h2><p>Hệ thống không tự tạo ứng viên hoặc khẳng định quyền sở hữu. Khi có kết quả thật, người dùng có thể xem lại và mở claim để trao đổi riêng.</p></div>
          <div className="workflow-empty-match"><ScanSearch /><strong>Chưa có kết quả matching</strong><span>Hãy hoàn tất một bài LOST hoặc FOUND để hệ thống bắt đầu đối chiếu.</span></div>
          <div className="match-alert"><MessageCircle size={18} /><span>Khi có ứng viên phù hợp, claimant và Finder có thể mở phòng trao đổi riêng để xác minh thông tin.</span></div>
        </>}
        <StoryConnector direction="left-center" />
      </StoryStage>

      <StoryStage className="story-section human-review story-stage--review" id="human-review">
        <StageMarker number="06" label="Trao đổi trực tiếp" align="center" />
        <div className="review-visual"><div className="review-sheet"><span className="review-status"><MessageCircle size={17} /> PHÒNG TRAO ĐỔI RIÊNG</span><div className="review-handoff"><span>Claim được mở</span><ArrowDown size={16} /><strong>Hai bên nhắn tin trực tiếp</strong></div><h3>Trao đổi và xác minh</h3><p>Claimant và Finder trao đổi trong phòng riêng để làm rõ thông tin vật phẩm và bằng chứng.</p><ul><li><Check /> Chỉ hai bên tham gia phòng chat</li><li><Check /> Nhắn tin trao đổi trực tiếp</li><li><Check /> Chia sẻ evidence riêng tư</li></ul><div className="review-stamp">TRAO ĐỔI RIÊNG</div></div></div>
        <div className="story-heading story-heading--left stage-copy-card"><p className="story-index">Trao đổi trực tiếp</p><h2>Hai bên xác minh thông tin trong phòng riêng.</h2><p>Sau khi mở claim, người mất và người nhặt có thể nhắn tin trực tiếp, đặt câu hỏi và chia sẻ evidence riêng tư. Bước này không phải Staff xác nhận thay cho hai bên.</p><div className="stage-benefits"><span><Check size={15} /> Phòng chat riêng tư</span><span><Check size={15} /> Trao đổi giữa claimant và Finder</span><span><Check size={15} /> Evidence chỉ participant xem được</span></div></div>
        <StoryConnector direction="center-right" />
      </StoryStage>

      <StoryStage className="handover-story story-stage--handover" id="handover">
        <StageMarker number="07" label="Bàn giao" align="right" dark />
        <div className="story-heading"><p className="story-index">Đoạn đường cuối</p><h2>Giờ chỉ còn đưa món đồ về đúng người.</h2></div>
        <div className="handover-summary"><span><CalendarCheck size={18} /> Bước bàn giao</span><strong>Thực hiện sau khi hai bên thống nhất</strong></div>
        <div className="handover-track"><div><span>01</span><strong>Người nhặt</strong><small>Giữ và trao đổi thông tin</small></div><motion.i initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} /><div className="handover-point"><span><CalendarCheck /></span><strong>Điểm bàn giao</strong><small>Hai bên thống nhất sau trao đổi</small></div><motion.i initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} /><div><span>03</span><strong>Chủ sở hữu</strong><small>Nhận lại an toàn</small></div></div>
        <div className="journey-progress"><span className="is-done">Lost</span><span className="is-done">Found</span><span className="is-done">Matched</span><span className="is-done">Verified</span><span className="is-current">Returned</span></div>
      </StoryStage>
    </div>

    <section className="closing-story"><p className="story-index">Hành trình khép lại</p><h2>Một món đồ thất lạc.<br />Hai người xa lạ.<br /><em>Một cái kết đúng chủ.</em></h2><p>Hồ sơ của bạn đã sẵn sàng cho những luồng Lost &amp; Found tiếp theo.</p><div className="hero-actions"><button className="journey-button journey-button--orange" onClick={() => chooseStory("LOST")}>Xem luồng báo mất</button><button className="journey-button journey-button--ghost-light" onClick={() => chooseStory("FOUND")}>Xem luồng báo nhặt</button><Link className="profile-link" to="/profile">Quản lý hồ sơ <ArrowRight size={17} /></Link></div></section>
  </div>;
}
