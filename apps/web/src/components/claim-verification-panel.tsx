import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, FileText, HelpCircle, LoaderCircle, LockKeyhole, PackageCheck, RotateCw, ShieldAlert, ShieldCheck, X, XCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ClaimAppointmentDialog } from "./claim-appointment-dialog";
import { useModalFocus } from "../hooks/use-modal-focus";
import { api, type ClaimMessage, type ClaimRecord, type ClaimVerificationState } from "../services/api";

type Decision = "VERIFY_FOR_MEETUP" | "REQUEST_MORE_INFO" | "DECLINE" | "ESCALATE_TO_CUSTODY";

const decisionContent: Record<Decision, { label: string; title: string; icon: typeof HelpCircle }> = {
  VERIFY_FOR_MEETUP: { label: "Đề xuất gặp mặt", title: "ĐỀ XUẤT GẶP MẶT", icon: CalendarDays },
  REQUEST_MORE_INFO: { label: "Yêu cầu thêm thông tin", title: "YÊU CẦU BỔ SUNG THÔNG TIN", icon: HelpCircle },
  DECLINE: { label: "Từ chối", title: "TỪ CHỐI CLAIM", icon: XCircle },
  ESCALATE_TO_CUSTODY: { label: "Chuyển sang custody", title: "CHUYỂN SANG CUSTODY", icon: ShieldAlert }
};

const finalActions = new Set(["VERIFICATION_ACCEPTED", "VERIFICATION_DECLINED", "MORE_INFO_REQUESTED", "CUSTODY_ESCALATED", "VERIFICATION_DECISION_CORRECTED"]);

function decisionLabel(value: unknown) {
  return typeof value === "string" && value in decisionContent
    ? decisionContent[value as Decision].label
    : null;
}

function metadataText(metadata: Record<string, unknown> | null, key: string) {
  return typeof metadata?.[key] === "string" ? metadata[key] as string : null;
}

interface Props {
  claim: ClaimRecord;
  verification: ClaimVerificationState | null;
  loading: boolean;
  loadError: string;
  onRetry: () => void;
  onVerificationChange: (value: ClaimVerificationState) => void;
  onClaimChange: (value: ClaimRecord) => void;
  onDecisionMessage: (value: ClaimMessage) => void;
}

export function ClaimVerificationPanel({ claim, verification, loading, loadError, onRetry, onVerificationChange, onClaimChange, onDecisionMessage }: Props) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [handoverPoints, setHandoverPoints] = useState<Array<{ id: string; name: string; address: string }>>([]);
  const [handoverPointId, setHandoverPointId] = useState("");
  const [loadingHandoverPoints, setLoadingHandoverPoints] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showAppointments, setShowAppointments] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const decisionRef = useRef<HTMLElement>(null);
  const custodyRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLElement>(null);
  useModalFocus(decisionRef, Boolean(decision && decision !== "ESCALATE_TO_CUSTODY"), () => setDecision(null), busy);
  useModalFocus(custodyRef, decision === "ESCALATE_TO_CUSTODY", () => setDecision(null), busy);
  useModalFocus(detailsRef, showDetails && Boolean(verification) && !loadError, () => setShowDetails(false));
  const active = verification?.status === "CONVERSATION_OPEN" || verification?.status === "NEED_MORE_INFO";
  const finder = verification?.participantRole === "FINDER";
  const latestDecision = useMemo(
    () => [...(verification?.history ?? [])].reverse().find((event) => finalActions.has(event.action)) ?? null,
    [verification?.history]
  );

  function actorName(actorId: string) {
    if (actorId === claim.finderId) return claim.finder.fullName;
    if (actorId === claim.claimantId) return claim.claimant.fullName;
    return "System";
  }

  async function openDecision(value: Decision) {
    if (value === "VERIFY_FOR_MEETUP" && !verification?.policy.readyForDecision) return;
    setDecision(value);
    setReason("");
    setError("");
    if (value === "ESCALATE_TO_CUSTODY") {
      setHandoverPoints([]);
      setHandoverPointId("");
      setLoadingHandoverPoints(true);
      try {
        const result = await api.listPublicHandoverPoints();
        const activePoints = result.handoverPoints.filter((point) => point.isActive);
        setHandoverPoints(activePoints);
        setHandoverPointId(activePoints[0]?.id ?? "");
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Không tải được danh sách quầy bàn giao");
      } finally {
        setLoadingHandoverPoints(false);
      }
    }
  }

  function toggleCorrection() {
    setCorrectionMode((current) => {
      const next = !current;
      if (next) window.requestAnimationFrame(() => actionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return next;
    });
  }

  async function confirmDecision() {
    if (!verification || !decision || !reason.trim()) return;
    if (decision === "ESCALATE_TO_CUSTODY" && !handoverPointId) return;
    setBusy(true);
    setError("");
    const fingerprint = JSON.stringify([decision, reason.trim(), handoverPointId, active ? null : latestDecision?.id]);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const result = await api.decideClaimVerification(claim.id, {
        decision,
        reason: reason.trim(),
        handoverPointId: decision === "ESCALATE_TO_CUSTODY" ? handoverPointId : undefined,
        correctsEventId: active ? undefined : latestDecision?.id,
        idempotencyKey: retry.current.key
      });
      retry.current = null;
      setDecision(null);
      setCorrectionMode(false);
      onClaimChange(result.claim);
      onVerificationChange(result.verification);
      if (result.message) onDecisionMessage(result.message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể ghi quyết định");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <section className="review-panel review-panel--error">
    <header><span>Xác minh vật phẩm</span><ShieldAlert /></header>
    <p className="review-load-error" role="alert">Không tải được trạng thái xác minh. {loadError}</p>
    <button type="button" className="review-retry" onClick={onRetry} disabled={loading}><RotateCw />{loading ? "Đang thử lại..." : "Thử lại"}</button>
  </section>;
  if (!verification) return <section className="review-panel review-panel--loading" role="status" aria-busy="true"><Clock3 /> Đang tải trạng thái xác minh...</section>;

  const accepted = verification.appointmentEligible;
  const custody = Boolean(verification.roomEscalation);
  const lastReason = metadataText(latestDecision?.metadata ?? null, "reason");
  const selectedDecision = decisionLabel(latestDecision?.metadata?.decision);
  const showActions = finder && (active || correctionMode) && !custody;
  const canCorrect = finder && latestDecision && !custody && (accepted || !active);
  const outcome = custody ? "Đã gửi yêu cầu chuyển sang custody"
    : selectedDecision ? `Finder đã chọn: ${selectedDecision}`
      : accepted ? "Finder đã đề xuất gặp mặt"
        : verification.status === "PENDING" ? "Chờ Finder mở conversation"
          : verification.status === "REJECTED" ? "Claim đã bị từ chối" : "Conversation đã đóng";
  const detailsActor = custody ? verification.roomEscalation?.escalatedBy : latestDecision?.actorId;
  const detailsTime = custody ? verification.roomEscalation?.escalatedAt : latestDecision?.createdAt;
  const detailsReason = custody ? verification.roomEscalation?.reason : lastReason;

  return <>
    <section className={`review-panel review-panel--${custody ? "custody" : accepted ? "eligible" : verification.status.toLowerCase()}`} aria-label="Xác minh vật phẩm">
      <header><span>Xác minh vật phẩm</span>{custody ? <PackageCheck /> : accepted ? <CheckCircle2 /> : <ShieldCheck />}</header>
      <div className="review-progress">
        <strong>{verification.policy.photoContactEligible ? "Ảnh đã đạt điều kiện trao đổi" : `${accepted ? "✓ " : ""}${verification.policy.answeredCount} / ${verification.policy.minimumAnswers} câu trả lời tối thiểu`}</strong>
        <span className={accepted && !custody ? "success" : "pending"}>{custody ? "Đang chuyển sang kho" : accepted ? "Đủ điều kiện đặt lịch" : verification.policy.readyForDecision ? "Có thể đưa ra quyết định" : "Chưa đủ điều kiện đặt lịch"}</span>
      </div>

      {custody && <div className="review-outcome review-outcome--custody" role="status">
        <strong>Đã gửi yêu cầu chuyển sang custody</strong>
        <p>Yêu cầu đang chờ Staff xử lý. Hai bên vẫn có thể tiếp tục trao đổi.</p>
      </div>}

      {!custody && !active && (!accepted || latestDecision) && <div className="review-outcome"><strong>{outcome}</strong></div>}

      {(custody || latestDecision) && <div className="review-tools">
        <button type="button" className="review-details" onClick={() => setShowDetails(true)}><FileText /> Chi tiết xác minh</button>
        {accepted && latestDecision && <button type="button" className="review-appointment-link" onClick={() => setShowAppointments(true)}><CalendarDays /> Lịch hẹn</button>}
        {canCorrect && <button type="button" className="review-correct" onClick={toggleCorrection}><RotateCw />{correctionMode ? "Ẩn lựa chọn quyết định" : "Điều chỉnh quyết định"}</button>}
      </div>}

      {showActions && <div ref={actionsRef} className="review-actions" role="group" aria-label="Quyết định xác minh">
        {(Object.keys(decisionContent) as Decision[]).map((value) => {
          const item = decisionContent[value];
          const Icon = item.icon;
          const disabled = (value === "VERIFY_FOR_MEETUP" && !verification.policy.readyForDecision) ||
            (value === "ESCALATE_TO_CUSTODY" && correctionMode && verification.status !== "ACCEPTED");
          return <button type="button" key={value} className={`review-action review-action--${value.toLowerCase()}`} disabled={disabled} onClick={() => openDecision(value)} title={disabled ? "Cần trả lời câu hỏi xác minh trước khi đề xuất gặp mặt" : item.label}><Icon /><span>{item.label}</span>{disabled && <LockKeyhole />}</button>;
        })}
      </div>}
    </section>

    {showAppointments && <ClaimAppointmentDialog key={claim.id} claimId={claim.id} canPropose={!custody} onDismiss={() => setShowAppointments(false)}/>}

    {showDetails && <div className="decision-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDetails(false); }}>
      <section ref={detailsRef} tabIndex={-1} className="decision-modal review-details-modal" role="dialog" aria-modal="true" aria-labelledby="review-details-title">
        <header><h3 id="review-details-title">Chi tiết xác minh</h3><button type="button" onClick={() => setShowDetails(false)} aria-label="Đóng chi tiết xác minh"><X /></button></header>
        <p>{outcome}</p>
        {custody && <p>Yêu cầu đang chờ Staff xử lý. Claim vẫn giữ nguyên trạng thái, chưa được chấp nhận hoặc từ chối; hai bên vẫn có thể tiếp tục trao đổi.</p>}
        <dl>
          {detailsActor && <div><dt>Quyết định bởi</dt><dd>{actorName(detailsActor)}</dd></div>}
          {detailsTime && <div><dt>Thời gian</dt><dd>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(detailsTime))}</dd></div>}
          {detailsReason && <div className="review-details-reason"><dt>Lý do</dt><dd>{detailsReason}</dd></div>}
        </dl>
      </section>
    </div>}

    {decision && decision !== "ESCALATE_TO_CUSTODY" && <div className="decision-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDecision(null); }}>
      <section ref={decisionRef} tabIndex={-1} className="decision-modal" role="dialog" aria-modal="true" aria-labelledby="decision-modal-title">
        <header><div><span>Xác nhận quyết định</span><h3 id="decision-modal-title">{decisionContent[decision].title}</h3></div><button type="button" onClick={() => setDecision(null)} disabled={busy} title="Đóng"><X /></button></header>
        <p>{decision === "VERIFY_FOR_MEETUP"
          ? verification.policy.photoContactEligible ? "Đề xuất gặp để đối chiếu trực tiếp. Ảnh tương đồng không xác nhận quyền sở hữu hoặc quyền nhận đồ tại kho." : "Bạn đang xác nhận claim đã đủ điều kiện để tiến tới meetup."
          : "Quyết định sẽ cập nhật trạng thái claim trên server."}</p>
        <label>Lý do / nhận xét<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={1000} autoFocus required /></label>
        <div className="decision-audit-note"><LockKeyhole /> Quyết định này sẽ được ghi vào audit.</div>
        {error && <div className="decision-modal-error"><AlertTriangle /> {error}</div>}
        <footer><button type="button" className="secondary" onClick={() => setDecision(null)} disabled={busy}>Hủy</button><button type="button" onClick={() => void confirmDecision()} disabled={busy || !reason.trim()}>{busy ? "Đang ghi..." : "Xác nhận quyết định"}</button></footer>
      </section>
    </div>}

    {decision === "ESCALATE_TO_CUSTODY" && <div className="custody-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDecision(null); }}>
      <section ref={custodyRef} tabIndex={-1} className="custody-modal custody-modal--claim-transfer" role="dialog" aria-modal="true" aria-labelledby="custody-transfer-title">
        <header className="custody-modal__header">
          <span className="modal-badge modal-badge--blue"><PackageCheck /></span>
          <div>
            <h3 id="custody-transfer-title">Yêu cầu Bàn giao cho Quầy Staff (Custody)</h3>
            <p>Chuyển giao vật phẩm bài đăng <strong>{claim.posts.found.title}</strong> cho nhân viên lưu trữ tại quầy.</p>
          </div>
          <button type="button" className="close-btn" onClick={() => setDecision(null)} disabled={busy} title="Đóng"><X /></button>
        </header>

        <div className="claim-custody-hours"><Clock3 /><p>Giờ làm việc Phòng DVSV: thứ Hai–thứ Sáu, buổi sáng 08:00/08:15–12:00 và buổi chiều 13:30–17:00, trừ ngày nghỉ lễ.</p></div>

        {correctionMode && <p className="claim-custody-reminder">Nếu đã có lịch hẹn, hãy hủy lịch trước khi gửi custody. Xác nhận bàn giao hoặc tranh chấp cần hai bên đối soát trước.</p>}

        <form className="modal-form claim-custody-form" onSubmit={(event) => { event.preventDefault(); void confirmDecision(); }}>
          <label htmlFor="claim-custody-handover-point">Điểm quầy nhận bàn giao <span className="required-star">*</span>
            <select id="claim-custody-handover-point" value={handoverPointId} onChange={(event) => setHandoverPointId(event.target.value)} required disabled={busy || loadingHandoverPoints || handoverPoints.length === 0}>
              <option value="">{loadingHandoverPoints ? "Đang tải danh sách quầy..." : "Chọn quầy bàn giao"}</option>
              {handoverPoints.map((point) => <option key={point.id} value={point.id}>{point.name} - {point.address}</option>)}
            </select>
          </label>
          {!loadingHandoverPoints && handoverPoints.length === 0 && <small className="field-hint">Hiện chưa có quầy bàn giao nào đang hoạt động.</small>}
          <label htmlFor="claim-custody-reason">Ghi chú / Lời nhắn cho Staff
            <textarea id="claim-custody-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={1000} disabled={busy} placeholder="Ví dụ: Tôi sẽ mang chìa khóa đến quầy vào giờ ra chơi 10h sáng..." required />
          </label>
          {loadingHandoverPoints && <small className="field-hint" role="status"><LoaderCircle className="spin-icon" /> Đang tải quầy bàn giao...</small>}
          {error && <div className="decision-modal-error"><AlertTriangle /> {error}</div>}
          <footer className="custody-modal-actions">
            <button className="primary-button" type="submit" disabled={busy || loadingHandoverPoints || !handoverPointId || reason.trim().length < 3}>
              {busy ? <LoaderCircle className="spin-icon" /> : <CheckCircle2 size={18} />}
              {busy ? "Đang gửi yêu cầu..." : "Gửi Yêu cầu Bàn giao"}
            </button>
            <button className="secondary-button" type="button" onClick={() => setDecision(null)} disabled={busy}>Đóng</button>
          </footer>
        </form>
      </section>
    </div>}
  </>;
}
