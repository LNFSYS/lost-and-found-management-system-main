import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Database,
  MapPin,
  MessageCircle,
  RefreshCw,
  ScanSearch,
  ShieldCheck
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PostImage } from "./posts-page";
import {
  api,
  type MatchExplanation,
  type MatchTier,
  type PostMatchResult,
  type PostMatchesResponse
} from "../services/api";

const tierLabels: Record<MatchTier, string> = {
  WEAK: "Tín hiệu yếu",
  SUGGESTION: "Gợi ý",
  NOTIFY: "Nên chú ý",
  HIGH_CONFIDENCE: "Tương đồng cao"
};

const scoreLabels: Array<{ key: keyof PostMatchResult["scores"]; label: string }> = [
  { key: "text", label: "Mô tả" },
  { key: "category", label: "Danh mục" },
  { key: "location", label: "Vị trí" },
  { key: "time", label: "Thời gian" },
  { key: "image", label: "Ảnh / tag" },
  { key: "ocr", label: "OCR / chữ" }
];

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null) {
  if (!value) return "Chưa có lần tính nào";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function candidateLocation(match: PostMatchResult) {
  const post = match.candidate;
  return [post.location.building?.name, post.location.roomText, post.location.area?.name, post.location.customLocation]
    .filter(Boolean).join(" · ") || "Vị trí chưa được công khai";
}

function SignalTokens({ explanation }: { explanation: MatchExplanation | null }) {
  if (!explanation) return null;
  const groups = [
    { label: "Từ khóa trùng", values: explanation.matchedTokens },
    { label: "Dấu hiệu ảnh trùng", values: explanation.matchedImageTags },
    { label: "Chữ/OCR trùng", values: explanation.matchedOcrTokens }
  ].filter((group) => group.values.length > 0);
  if (!groups.length) return <p className="match-token-empty">Chưa có token riêng trùng; điểm hiện dựa nhiều hơn vào danh mục, vị trí hoặc thời gian.</p>;
  return <div className="match-token-groups">{groups.map((group) => <div key={group.label}>
    <small>{group.label}</small>
    <p>{group.values.map((value) => <span key={value}>{value}</span>)}</p>
  </div>)}</div>;
}

function MatchCandidateCard({ result, rank, weights, onClaim, claiming }: { result: PostMatchResult; rank: number; weights: PostMatchesResponse["weights"]; onClaim?: () => void; claiming?: boolean }) {
  const explanation = result.explanation;
  return <article className={`match-analysis-card match-analysis-card--${result.scoreTier.toLowerCase()}`}>
    <header className="match-analysis-card__header">
      <span className="match-rank">#{rank.toString().padStart(2, "0")}</span>
      <div><small>{result.candidate.type} · {result.candidate.category?.name ?? "Chưa phân loại"}</small><h2>{result.candidate.title}</h2><p><MapPin /> {candidateLocation(result)}</p></div>
      <div className="match-overall"><strong>{percentage(result.totalScore)}</strong><span>{tierLabels[result.scoreTier]}</span></div>
    </header>

    <div className="match-analysis-card__content">
      <div className="match-candidate-image"><PostImage post={result.candidate} /></div>
      <div className="match-score-breakdown" aria-label="Điểm thành phần">
        {scoreLabels.map(({ key, label }) => <div className="match-score-row" key={key}>
          <span>{label}<small>trọng số {percentage(weights[key])}</small></span>
          <i><b style={{ width: percentage(result.scores[key]) }} /></i>
          <strong>{percentage(result.scores[key])}</strong>
        </div>)}
      </div>
    </div>

    <div className="match-explanation">
      <p>{explanation?.summary ?? "Kết quả được lưu từ lần chạy matching gần nhất."}</p>
      <div className="match-reason-grid">
        <span><Check /> {explanation?.categoryReason ?? "Chưa có giải thích danh mục"}</span>
        <span><MapPin /> {explanation?.locationReason ?? "Chưa có giải thích vị trí"}</span>
        <span><Clock3 /> {explanation?.daysDiff === null || explanation?.daysDiff === undefined ? "Chưa đủ dữ liệu thời gian" : `Lệch ${explanation.daysDiff < 1 ? `${Math.round(explanation.daysDiff * 24)} giờ` : `${explanation.daysDiff} ngày`}`}</span>
      </div>
      <SignalTokens explanation={explanation} />
      {explanation?.penalties.length ? <div className="match-penalties"><AlertTriangle /> <div>{explanation.penalties.map((penalty) => <span key={penalty}>{penalty}</span>)}</div></div> : null}
    </div>

    <footer>
      {onClaim && <button className="match-claim-button" type="button" disabled={claiming} onClick={onClaim}><MessageCircle /> {claiming ? "\u0110ang t\u1ea1o y\u00eau c\u1ea7u..." : "Y\u00eau c\u1ea7u trao \u0111\u1ed5i ri\u00eang"}</button>}
      <span><Database /> Đã lưu · {formatDate(result.calculatedAt)}</span>
      <Link to={`/posts/${result.candidate.id}`}>Xem bài đối ứng <ArrowRight /></Link>
    </footer>
  </article>;
}

export function PostMatchesPage() {
  const { postId = "" } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PostMatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [claimingMatchId, setClaimingMatchId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.getPostMatches(postId)
      .then((value) => { if (active) setData(value); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [postId]);

  async function recalculate() {
    setRecalculating(true);
    setError("");
    try {
      setData(await api.recalculatePostMatches(postId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tính lại matching lúc này.");
    } finally {
      setRecalculating(false);
    }
  }

  async function requestClaim(result: PostMatchResult) {
    if (!data || data.source.type !== "LOST") return;
    setClaimingMatchId(result.matchId);
    setError("");
    try {
      const claim = await api.createClaim({ lostPostId: data.source.id, foundPostId: result.candidate.id });
      navigate(`/claims/${claim.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "KhÃ´ng thá»ƒ táº¡o yÃªu cáº§u trao Ä‘á»•i.");
    } finally {
      setClaimingMatchId(null);
    }
  }

  if (loading) return <section className="matches-page"><div className="matches-loading"><ScanSearch /><h1>Đang đọc kết quả matching đã lưu...</h1><span /><span /><span /></div></section>;
  if (error && !data) return <section className="matches-page"><div className="posts-state is-error"><AlertTriangle /><h1>Không mở được kết quả matching</h1><p>{error}</p><Link to="/my-posts"><ArrowLeft /> Quay lại bài của tôi</Link></div></section>;
  if (!data) return null;

  const actionableCount = data.results.filter((result) => result.totalScore >= data.thresholds.suggestion).length;
  const topScore = data.results[0]?.totalScore ?? null;
  return <main className="matches-page">
    <div className="matches-page__topline">
      <Link to="/my-posts"><ArrowLeft /> Bài đăng của tôi</Link>
      <button type="button" disabled={recalculating || !["OPEN", "MATCHED"].includes(data.source.status)} onClick={() => void recalculate()}>
        <RefreshCw className={recalculating ? "is-spinning" : ""} /> {recalculating ? "Đang tính lại..." : "Tính lại matching"}
      </button>
    </div>

    <header className="matches-hero">
      <div>
        <p className="eyebrow">Phân tích matching đã lưu</p>
        <h1>So sánh bài “{data.source.title}”</h1>
        <p>Điểm số là gợi ý từ thuật toán hybrid/rule-based. Mọi claim vẫn cần bằng chứng và Staff/Admin xác minh.</p>
      </div>
      <dl>
        <div><dt>Ứng viên lưu</dt><dd>{data.results.length}</dd></div>
        <div><dt>Đạt ngưỡng gợi ý</dt><dd>{actionableCount}</dd></div>
        <div><dt>Điểm cao nhất</dt><dd>{topScore === null ? "—" : percentage(topScore)}</dd></div>
      </dl>
    </header>

    <section className="matching-method" aria-label="Phương pháp matching">
      <span><ScanSearch /></span>
      <div><strong>{data.matcherVersion}</strong><p>TF-IDF tiếng Việt kết hợp danh mục, vị trí, thời gian, tag ảnh và OCR. Ngưỡng hiển thị gợi ý: {percentage(data.thresholds.suggestion)}.</p></div>
      <small><Database /> Cập nhật {formatDate(data.calculatedAt)}</small>
    </section>

    <section className="matching-thresholds" aria-label="Các ngưỡng matching">
      <span><i /> Dưới {percentage(data.thresholds.weak)}: bỏ qua</span>
      <span><i /> {percentage(data.thresholds.weak)}–{percentage(data.thresholds.suggestion - 0.01)}: tín hiệu yếu</span>
      <span><i /> {percentage(data.thresholds.suggestion)}–{percentage(data.thresholds.notification - 0.01)}: gợi ý</span>
      <span><i /> {percentage(data.thresholds.notification)}–{percentage(data.thresholds.highConfidence - 0.01)}: nên chú ý</span>
      <span><i /> Từ {percentage(data.thresholds.highConfidence)}: tương đồng cao</span>
    </section>

    {error && <div className="match-page-warning"><AlertTriangle /> {error}</div>}
    {data.results.length ? <section className="match-analysis-list" aria-label="Danh sách ứng viên matching">
      {data.results.map((result, index) => <MatchCandidateCard key={result.matchId} result={result} rank={index + 1} weights={data.weights} onClaim={data.source.type === "LOST" && result.totalScore >= data.thresholds.suggestion ? () => void requestClaim(result) : undefined} claiming={claimingMatchId === result.matchId} />)}
    </section> : <section className="matches-empty">
      <ScanSearch />
      <p className="eyebrow">Lượt quét đã hoàn tất</p>
      <h2>Chưa có bài đối ứng vượt ngưỡng 45%</h2>
      <p>Bài vẫn ở trạng thái mở. Bạn có thể tính lại khi có báo cáo mới hoặc bổ sung mô tả rõ hơn cho bài đăng.</p>
      <div><Link to={`/posts/${data.source.id}`}>Xem bài của tôi</Link><Link to="/posts">Mở bảng tin</Link></div>
    </section>}

    <aside className="matching-safety-note"><ShieldCheck /><div><strong>Human verification required</strong><p>Điểm cao không tự động đổi trạng thái bài, chấp nhận claim hay cho phép nhận đồ.</p></div></aside>
  </main>;
}
