import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  Hand,
  LoaderCircle,
  MapPin,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  X
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
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

function MatchCandidateCard({ result, rank, weights, onClaim, claiming, canMessage }: { result: PostMatchResult; rank: number; weights: PostMatchesResponse["weights"]; onClaim: () => void; claiming?: boolean; canMessage: boolean }) {
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
      <button className="match-claim-button" type="button" disabled={claiming || !canMessage} onClick={onClaim}><MessageCircle /> {claiming ? "Đang mở phòng chat..." : canMessage ? "Nhắn tin với người đăng" : "Không thể nhắn tin với bài này"}</button>
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
  const [keepItemConfirmed, setKeepItemConfirmed] = useState(false);
  const [custodyModalOpen, setCustodyModalOpen] = useState(false);
  const [handoverPoints, setHandoverPoints] = useState<Array<{ id: string; name: string; address?: string | null }>>([]);
  const [selectedHandoverPointId, setSelectedHandoverPointId] = useState("");
  const [custodyReason, setCustodyReason] = useState("");
  const [loadingCustodyOptions, setLoadingCustodyOptions] = useState(false);
  const [submittingCustody, setSubmittingCustody] = useState(false);
  const [custodyNotice, setCustodyNotice] = useState("");
  const [custodyError, setCustodyError] = useState("");
  const [physicalCustody, setPhysicalCustody] = useState(false);
  const [custodyChecked, setCustodyChecked] = useState(false);
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

  useEffect(() => {
    let active = true;
    setCustodyChecked(false);
    setPhysicalCustody(false);
    setKeepItemConfirmed(false);
    if (data?.source.type === "FOUND" && data.source.canEdit) void api.getMyCustodyRequestByPost(postId)
      .then(result => { if (active) { setPhysicalCustody(Boolean(result.warehouseItem) || result.request?.status === "INTAKED"); setCustodyChecked(true); } })
      .catch(() => { if (active) setCustodyError("Chưa xác minh được nơi đang giữ vật phẩm. Vui lòng thử lại."); });
    return () => { active = false; };
  }, [postId, data?.source.id, data?.source.type]);

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

  async function openCustodyModal() {
    setCustodyError("");
    setCustodyNotice("");
    setLoadingCustodyOptions(true);
    try {
      const points = await api.listPublicHandoverPoints();
      setHandoverPoints(points.handoverPoints);
      setSelectedHandoverPointId(points.handoverPoints[0]?.id ?? "");
      {
        const existing = await api.getMyCustodyRequestByPost(postId);
        setPhysicalCustody(Boolean(existing.warehouseItem) || existing.request?.status === "INTAKED");
        setCustodyChecked(true);
        if (existing.warehouseItem) {
          setCustodyNotice(["RETURNED", "DISPOSED", "DONATED", "TRANSFERRED"].includes(existing.warehouseItem.status)
            ? "Vật phẩm đã kết thúc luồng lưu kho; không thể yêu cầu bàn giao lại."
            : "Vật phẩm đã được Staff tiếp nhận vào kho.");
          return;
        }
        if (existing.request && ["PENDING", "ACCEPTED", "INTAKED"].includes(existing.request.status)) {
          setCustodyNotice(existing.request.status === "INTAKED"
            ? "Vật phẩm đã được Staff tiếp nhận vào kho."
            : existing.request.status === "ACCEPTED"
              ? "Yêu cầu custody đã được Staff chấp nhận. Hãy mang vật phẩm đến điểm bàn giao đã chọn."
              : "Bạn đã có yêu cầu custody đang chờ Staff xử lý.");
          return;
        }
      }
      setCustodyModalOpen(true);
    } catch (reason) {
      setCustodyError(reason instanceof Error ? reason.message : "Không thể tải điểm bàn giao.");
    } finally {
      setLoadingCustodyOptions(false);
    }
  }

  async function submitCustodyRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !selectedHandoverPointId) return;
    setSubmittingCustody(true);
    setCustodyError("");
    try {
      await api.createCustodyRequest({
        postId: data.source.id,
        handoverPointId: selectedHandoverPointId,
        reason: custodyReason || "Bàn giao vật phẩm bài nhặt được cho quầy Staff",
        intakeType: "CUSTODY_TRANSFER"
      });
      setCustodyModalOpen(false);
      setCustodyReason("");
      setCustodyNotice("Đã gửi yêu cầu custody. Vui lòng chờ Staff phản hồi trước khi mang vật phẩm đến quầy.");
    } catch (reason) {
      setCustodyError(reason instanceof Error ? reason.message : "Không thể gửi yêu cầu custody.");
    } finally {
      setSubmittingCustody(false);
    }
  }

  async function openConversation(result: PostMatchResult) {
    if (!data) return;
    setClaimingMatchId(result.matchId);
    const source = data.source.type === "FOUND" && result.candidate.type === "LOST" ? `&sourceFoundPostId=${encodeURIComponent(data.source.id)}` : "";
    try {
      if (source) { navigate(`/claims?composePostId=${encodeURIComponent(result.candidate.id)}${source}`); return; }
      const existing = await api.findConversationByPost(result.candidate.id);
      if (existing) {
        navigate(`/claims/${existing.id}`);
        return;
      }
      navigate(`/claims?composePostId=${encodeURIComponent(result.candidate.id)}${source}`);
    } catch {
      // Fall back to compose when the conversation lookup is unavailable.
      navigate(`/claims?composePostId=${encodeURIComponent(result.candidate.id)}${source}`);
    } finally {
      setClaimingMatchId(null);
    }
  }

  if (loading) return <section className="matches-page"><div className="matches-loading"><ScanSearch /><h1>Đang đọc kết quả matching đã lưu...</h1><span /><span /><span /></div></section>;
  if (error && !data) return <section className="matches-page"><div className="posts-state is-error"><AlertTriangle /><h1>Không mở được kết quả matching</h1><p>{error}</p><Link to="/my-posts"><ArrowLeft /> Quay lại bài của tôi</Link></div></section>;
  if (!data) return null;

  const visibleResults = data.results.filter((result) => !(result.candidate.type === "LOST" && result.candidate.canEdit));
  const hiddenOwnedLostCount = data.results.length - visibleResults.length;
  const actionableCount = visibleResults.filter((result) => result.totalScore >= data.thresholds.suggestion).length;
  const topScore = visibleResults[0]?.totalScore ?? null;
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
      <div className="matches-hero__actions">
        <dl>
          <div><dt>Kết quả hiển thị</dt><dd>{visibleResults.length}</dd></div>
          <div><dt>Đạt ngưỡng gợi ý</dt><dd>{actionableCount}</dd></div>
          <div><dt>Điểm cao nhất</dt><dd>{topScore === null ? "—" : percentage(topScore)}</dd></div>
        </dl>
        {data.source.type === "FOUND" && data.source.canEdit && <section className="found-item-choice" aria-labelledby="found-item-choice-title">
          <div className="found-item-choice__heading">
            <span className="found-item-choice__badge"><PackageCheck /></span>
            <div><p className="eyebrow">BƯỚC TIẾP THEO</p><h2 id="found-item-choice-title">Bạn muốn giữ vật phẩm ở đâu?</h2></div>
          </div>
          <div className="found-item-choice__buttons">
            <button className={`found-item-choice__option found-item-choice__option--keep${keepItemConfirmed ? " is-selected" : ""}`} type="button" disabled={physicalCustody || !custodyChecked || !["OPEN","MATCHED"].includes(data.source.status)} onClick={() => setKeepItemConfirmed(true)}>
              <Hand /> <span><strong>{physicalCustody ? "Vật phẩm đã bàn giao" : keepItemConfirmed ? "Bạn sẽ tự giữ vật phẩm" : "Tôi tự giữ"}</strong><small>{physicalCustody ? "Xem tình trạng hồ sơ custody" : "Vật phẩm tiếp tục ở chỗ bạn"}</small></span>
            </button>
            <button className="found-item-choice__option found-item-choice__option--custody" type="button" disabled={loadingCustodyOptions} onClick={() => void openCustodyModal()}>
              {loadingCustodyOptions ? <LoaderCircle className="spin-icon" /> : <PackageCheck />}<span><strong>{loadingCustodyOptions ? "Đang tải điểm bàn giao..." : "Gửi tại quầy DVSV"}</strong><small>Gửi yêu cầu bàn giao custody</small></span>
            </button>
          </div>
          <p className="found-item-choice__hours">Giờ làm việc Phòng DVSV: thứ Hai–thứ Sáu, buổi sáng 08:00/08:15–12:00 và buổi chiều 13:30–17:00, trừ ngày nghỉ lễ.</p>
          {keepItemConfirmed && <p className="found-item-choice__status" role="status">Vật phẩm vẫn do bạn giữ; bài FOUND tiếp tục mở và các kết quả matching không thay đổi.</p>}
          {custodyNotice && <p className="found-item-choice__status" role="status">{custodyNotice}</p>}
          {custodyError && <p className="found-item-choice__error" role="alert">{custodyError}</p>}
        </section>}
      </div>
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
    {visibleResults.length ? <section className="match-analysis-list" aria-label="Danh sách ứng viên matching">
      {visibleResults.map((result, index) => <MatchCandidateCard key={result.matchId} result={result} rank={index + 1} weights={data.weights} onClaim={() => void openConversation(result)} canMessage={!result.candidate.canEdit && ["OPEN", "MATCHED"].includes(result.candidate.status)} claiming={claimingMatchId === result.matchId} />)}
    </section> : <section className="matches-empty">
      <ScanSearch />
      <p className="eyebrow">Lượt quét đã hoàn tất</p>
      <h2>{hiddenOwnedLostCount ? "Không có bài đối ứng để hiển thị" : "Chưa có bài đối ứng vượt ngưỡng 45%"}</h2>
      <p>{hiddenOwnedLostCount ? "Các bài LOST do bạn đăng được ẩn khỏi kết quả matching. Những bài đối ứng khác, kể cả bài đã đóng, vẫn được hiển thị." : "Bài vẫn ở trạng thái mở. Bạn có thể tính lại khi có báo cáo mới hoặc bổ sung mô tả rõ hơn cho bài đăng."}</p>
      <div><Link to={`/posts/${data.source.id}`}>Xem bài của tôi</Link><Link to="/posts">Mở bảng tin</Link></div>
    </section>}

    <aside className="matching-safety-note"><ShieldCheck /><div><strong>Human verification required</strong><p>Điểm cao không tự động đổi trạng thái bài, chấp nhận claim hay cho phép nhận đồ.</p></div></aside>

    {custodyModalOpen && <div className="custody-modal-overlay" onClick={() => setCustodyModalOpen(false)}>
      <section className="custody-modal" role="dialog" aria-modal="true" aria-labelledby="matches-custody-title" onClick={(event) => event.stopPropagation()}>
        <div className="custody-modal__header">
          <span className="modal-badge modal-badge--blue"><PackageCheck size={20} /></span>
          <div>
            <h3 id="matches-custody-title">Yêu cầu bàn giao cho Phòng DVSV</h3>
            <p>Chọn quầy tiếp nhận cho vật phẩm <strong>{data.source.title}</strong>.</p>
            <p className="custody-hours-note">Giờ làm việc: thứ Hai–thứ Sáu, 08:00/08:15–12:00 và 13:30–17:00, trừ ngày nghỉ lễ.</p>
          </div>
          <button type="button" className="close-btn" aria-label="Đóng" onClick={() => setCustodyModalOpen(false)}><X size={18} /></button>
        </div>
        <form className="admin-form modal-form" onSubmit={(event) => void submitCustodyRequest(event)}>
          <label className="input-field">
            <span>Điểm quầy nhận bàn giao <strong className="required-star">*</strong></span>
            <select value={selectedHandoverPointId} onChange={(event) => setSelectedHandoverPointId(event.target.value)} required>
              <option value="">-- Chọn điểm quầy bàn giao --</option>
              {handoverPoints.map((point) => <option key={point.id} value={point.id}>{point.name}{point.address ? ` - ${point.address}` : ""}</option>)}
            </select>
          </label>
          <label className="input-field">
            <span>Ghi chú cho Staff</span>
            <textarea value={custodyReason} onChange={(event) => setCustodyReason(event.target.value)} rows={3} placeholder="Thời gian dự kiến hoặc lưu ý khi bàn giao" />
          </label>
          {custodyError && <p className="found-item-choice__error" role="alert">{custodyError}</p>}
          <div className="custody-modal-actions">
            <button className="primary-button" disabled={submittingCustody || !selectedHandoverPointId}>
              {submittingCustody ? <LoaderCircle className="spin-icon" size={17} /> : <CheckCircle2 size={17} />}
              <span>{submittingCustody ? "Đang gửi..." : "Gửi yêu cầu custody"}</span>
            </button>
            <button type="button" className="secondary-button" onClick={() => setCustodyModalOpen(false)}>Hủy</button>
          </div>
        </form>
      </section>
    </div>}
  </main>;
}
