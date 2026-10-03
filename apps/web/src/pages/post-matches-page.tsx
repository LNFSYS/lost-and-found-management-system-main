import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleHelp, Clock3, Database, EyeOff, MapPin, MessageCircle, RefreshCw, ScanSearch, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PostImage } from "./posts-page";
import { api, type MatchExplanation, type MatchFeedbackValue, type MatchTier, type PostMatchResult, type PostMatchesResponse } from "../services/api";

const tierLabels: Record<MatchTier, string> = { WEAK: "Tín hiệu yếu", SUGGESTION: "Gợi ý", NOTIFY: "Nên chú ý", HIGH_CONFIDENCE: "Tương đồng cao" };
const feedbackLabels: Record<MatchFeedbackValue, string> = { USEFUL: "Hữu ích", IRRELEVANT: "Không liên quan", INCORRECT: "Sai kết quả" };
const scoreLabels: Array<{ key: keyof PostMatchResult["scores"]; label: string }> = [
  { key: "text", label: "Mô tả" }, { key: "category", label: "Danh mục" }, { key: "location", label: "Vị trí" },
  { key: "time", label: "Thời gian" }, { key: "image", label: "Ảnh / tag" }, { key: "ocr", label: "OCR / chữ" }
];

function percentage(value: number) { return `${Math.round(value * 100)}%`; }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Chưa có lần tính nào"; }
function candidateLocation(match: PostMatchResult) {
  const post = match.candidate;
  return [post.location.building?.name, post.location.roomText, post.location.area?.name, post.location.customLocation].filter(Boolean).join(" · ") || "Vị trí chưa được công khai";
}

function SignalTokens({ explanation }: { explanation: MatchExplanation | null }) {
  if (!explanation) return null;
  const groups = [
    { label: "Từ khóa trùng", values: explanation.matchedTokens }, { label: "Dấu hiệu ảnh trùng", values: explanation.matchedImageTags },
    { label: "Chữ/OCR trùng", values: explanation.matchedOcrTokens }
  ].filter((group) => group.values.length > 0);
  if (!groups.length) return <p className="match-token-empty">Điểm hiện dựa nhiều hơn vào danh mục, vị trí hoặc thời gian.</p>;
  return <div className="match-token-groups">{groups.map((group) => <div key={group.label}><small>{group.label}</small><p>{group.values.map((value) => <span key={value}>{value}</span>)}</p></div>)}</div>;
}

interface MatchCardProps {
  result: PostMatchResult; rank: number; weights: PostMatchesResponse["weights"]; claiming: boolean; pending: boolean;
  onClaim?: () => void; onFeedback(value: MatchFeedbackValue): void; onDismiss(): void;
}

function MatchCandidateCard({ result, rank, weights, onClaim, claiming, pending, onFeedback, onDismiss }: MatchCardProps) {
  const explanation = result.explanation;
  return <article className={`match-analysis-card match-analysis-card--${result.scoreTier.toLowerCase()}`}>
    <header className="match-analysis-card__header"><span className="match-rank">#{rank.toString().padStart(2, "0")}</span><div><small>{result.candidate.type} · {result.candidate.category?.name ?? "Chưa phân loại"}</small><h2>{result.candidate.title}</h2><p><MapPin /> {candidateLocation(result)}</p></div><div className="match-overall"><strong>{percentage(result.totalScore)}</strong><span>{tierLabels[result.scoreTier]}</span></div></header>
    <div className="match-analysis-card__content"><div className="match-candidate-image"><PostImage post={result.candidate} /></div><div className="match-score-breakdown" aria-label="Điểm thành phần">{scoreLabels.map(({ key, label }) => <div className="match-score-row" key={key}><span>{label}<small>trọng số {percentage(weights[key])}</small></span><i><b style={{ width: percentage(result.scores[key]) }} /></i><strong>{percentage(result.scores[key])}</strong></div>)}</div></div>
    <div className="match-explanation"><p>{explanation?.summary ?? "Kết quả được lưu từ lần chạy matching gần nhất."}</p><div className="match-reason-grid"><span><Check /> {explanation?.categoryReason ?? "Chưa có giải thích danh mục"}</span><span><MapPin /> {explanation?.locationReason ?? "Chưa có giải thích vị trí"}</span><span><Clock3 /> {explanation?.daysDiff == null ? "Chưa đủ dữ liệu thời gian" : `Lệch ${explanation.daysDiff < 1 ? `${Math.round(explanation.daysDiff * 24)} giờ` : `${explanation.daysDiff} ngày`}`}</span></div><SignalTokens explanation={explanation} />{explanation?.penalties.length ? <div className="match-penalties"><AlertTriangle /><div>{explanation.penalties.map((penalty) => <span key={penalty}>{penalty}</span>)}</div></div> : null}</div>
    <div className="match-feedback" aria-label="Đánh giá gợi ý"><strong>Gợi ý này có chính xác không?</strong>{result.feedback ? <span className={`match-feedback__saved match-feedback__saved--${result.feedback.value.toLowerCase()}`}><Check /> Đã đánh giá: {feedbackLabels[result.feedback.value]}</span> : <div className="match-feedback__options"><button type="button" disabled={pending} onClick={() => onFeedback("USEFUL")}><ThumbsUp /> Hữu ích</button><button type="button" disabled={pending} onClick={() => onFeedback("IRRELEVANT")}><CircleHelp /> Không liên quan</button><button type="button" disabled={pending} onClick={() => onFeedback("INCORRECT")}><ThumbsDown /> Sai kết quả</button></div>}<button className="match-dismiss" type="button" disabled={pending} onClick={onDismiss}><EyeOff /> Ẩn gợi ý</button></div>
    <footer>{onClaim && <button className="match-claim-button" type="button" disabled={claiming} onClick={onClaim}><MessageCircle /> {claiming ? "Đang mở phòng chat..." : "Trao đổi riêng ngay"}</button>}<span><Database /> Đã lưu · {formatDate(result.calculatedAt)}</span><Link to={`/posts/${result.candidate.id}`}>Xem bài đối ứng <ArrowRight /></Link></footer>
  </article>;
}

export function PostMatchesPage() {
  const { postId = "" } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PostMatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [claimingMatchId, setClaimingMatchId] = useState<string | null>(null);
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const requestKeys = useRef(new Map<string, string>());
  function requestKey(action: string) {
    const scope = `${postId}:${action}`;
    if (!requestKeys.current.has(scope)) requestKeys.current.set(scope, crypto.randomUUID());
    return requestKeys.current.get(scope)!;
  }

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    api.getPostMatches(postId, page).then((value) => { if (active) setData(value); }).catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [postId, page]);

  async function recalculate() {
    setRecalculating(true); setError("");
    try { setPage(1); setData(await api.recalculatePostMatches(postId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tính lại matching lúc này."); }
    finally { setRecalculating(false); }
  }

  async function submitFeedback(result: PostMatchResult, value: MatchFeedbackValue) {
    setPendingMatchId(result.matchId); setError("");
    try {
      const feedback = await api.submitMatchFeedback(postId, result.matchId, { value, correlationKey: requestKey(`feedback:${result.matchId}:${value}`) });
      setData((current) => current ? { ...current, results: current.results.map((item) => item.matchId === result.matchId ? { ...item, feedback } : item) } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu đánh giá."); }
    finally { setPendingMatchId(null); }
  }

  async function dismiss(result: PostMatchResult) {
    if (!window.confirm("Ẩn gợi ý này? Gợi ý sẽ không tự xuất hiện lại sau các lượt refresh định kỳ.")) return;
    setPendingMatchId(result.matchId); setError("");
    try {
      await api.dismissMatch(postId, result.matchId, { correlationKey: requestKey(`dismiss:${result.matchId}`) });
      const refreshed = await api.getPostMatches(postId, page);
      if (!refreshed.results.length && page > 1) setPage(page - 1);
      else setData(refreshed);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể ẩn gợi ý."); }
    finally { setPendingMatchId(null); }
  }

  async function openConversation(result: PostMatchResult) {
    if (!data || data.source.type !== "LOST") return;
    setClaimingMatchId(result.matchId);
    try { const existing = await api.findConversationByPost(result.candidate.id); navigate(existing ? `/claims/${existing.id}` : `/claims?composePostId=${encodeURIComponent(result.candidate.id)}`); }
    catch { navigate(`/claims?composePostId=${encodeURIComponent(result.candidate.id)}`); }
  }

  if (loading) return <section className="matches-page"><div className="matches-loading"><ScanSearch /><h1>Đang đọc kết quả matching đã lưu...</h1><span /><span /><span /></div></section>;
  if (error && !data) return <section className="matches-page"><div className="posts-state is-error"><AlertTriangle /><h1>Không mở được kết quả matching</h1><p>{error}</p><Link to="/my-posts"><ArrowLeft /> Quay lại bài của tôi</Link></div></section>;
  if (!data) return null;

  const actionableCount = data.results.filter((result) => result.totalScore >= data.thresholds.suggestion).length;
  const topScore = data.results[0]?.totalScore ?? null;
  return <main className="matches-page">
    <div className="matches-page__topline"><Link to="/my-posts"><ArrowLeft /> Bài đăng của tôi</Link><button type="button" disabled={recalculating || !["OPEN", "MATCHED"].includes(data.source.status)} onClick={() => void recalculate()}><RefreshCw className={recalculating ? "is-spinning" : ""} /> {recalculating ? "Đang tính lại..." : "Tính lại matching"}</button></div>
    <header className="matches-hero"><div><p className="eyebrow">Phân tích matching đã lưu</p><h1>So sánh bài “{data.source.title}”</h1><p>Đánh giá của bạn giúp cải thiện matching nhưng không xác nhận quyền sở hữu.</p></div><dl><div><dt>Ứng viên</dt><dd>{data.total}</dd></div><div><dt>Đạt ngưỡng</dt><dd>{actionableCount}</dd></div><div><dt>Điểm cao nhất</dt><dd>{topScore === null ? "—" : percentage(topScore)}</dd></div></dl></header>
    <section className="matching-method" aria-label="Phương pháp matching"><span><ScanSearch /></span><div><strong>{data.matcherVersion}</strong><p>Đối chiếu định kỳ bằng text, danh mục, vị trí, thời gian và tín hiệu ảnh đã lưu. Ngưỡng gợi ý: {percentage(data.thresholds.suggestion)}.</p></div><small><Database /> Cập nhật {formatDate(data.calculatedAt)}</small></section>
    {error && <div className="match-page-warning"><AlertTriangle /> {error}</div>}
    {data.results.length ? <section className="match-analysis-list" aria-label="Danh sách ứng viên matching">{data.results.map((result, index) => <MatchCandidateCard key={result.matchId} result={result} rank={(data.page - 1) * data.pageSize + index + 1} weights={data.weights} onClaim={data.source.type === "LOST" && result.totalScore >= data.thresholds.suggestion ? () => void openConversation(result) : undefined} claiming={claimingMatchId === result.matchId} pending={pendingMatchId === result.matchId} onFeedback={(value) => void submitFeedback(result, value)} onDismiss={() => void dismiss(result)} />)}</section> : <section className="matches-empty"><ScanSearch /><p className="eyebrow">Lượt quét đã hoàn tất</p><h2>Chưa có gợi ý phù hợp</h2><p>Các gợi ý đã ẩn sẽ không tự xuất hiện lại sau refresh.</p></section>}
    {data.total > data.pageSize && <nav className="match-pagination" aria-label="Phân trang gợi ý matching"><button type="button" disabled={data.page <= 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft /> Trước</button><span>Trang {data.page} / {Math.ceil(data.total / data.pageSize)}</span><button type="button" disabled={!data.hasMore} onClick={() => setPage((value) => value + 1)}>Sau <ArrowRight /></button></nav>}
    <aside className="matching-safety-note"><ShieldCheck /><div><strong>Xác minh bởi con người</strong><p>Refresh và feedback không đổi quyền sở hữu, tạo claim, mở lịch hẹn hay hoàn tất bàn giao.</p></div></aside>
  </main>;
}
