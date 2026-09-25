import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, HelpCircle, LockKeyhole, ShieldAlert, ShieldCheck, X, XCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
  onVerificationChange: (value: ClaimVerificationState) => void;
  onClaimChange: (value: ClaimRecord) => void;
  onDecisionMessage: (value: ClaimMessage) => void;
}

export function ClaimVerificationPanel({ claim, verification, onVerificationChange, onClaimChange, onDecisionMessage }: Props) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [correctionMode, setCorrectionMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const retry = useRef<{ decision: Decision; key: string } | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
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

  function openDecision(value: Decision) {
    if (value === "VERIFY_FOR_MEETUP" && !verification?.policy.readyForDecision) return;
    setDecision(value);
    setReason("");
    setError("");
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
    setBusy(true);
    setError("");
    if (retry.current?.decision !== decision) retry.current = { decision, key: crypto.randomUUID() };
    try {
      const result = await api.decideClaimVerification(claim.id, {
        decision,
        reason: reason.trim(),
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

  if (!verification) return <section className="review-panel review-panel--loading"><Clock3 /> Đang tải trạng thái xác minh...</section>;

  const accepted = verification.appointmentEligible;
  const custody = Boolean(verification.roomEscalation);
  const lastReason = metadataText(latestDecision?.metadata ?? null, "reason");
  const selectedDecision = decisionLabel(latestDecision?.metadata?.decision);
  const showActions = finder && (active || correctionMode);

  return <>
    <section className={`review-panel review-panel--${accepted ? "eligible" : custody ? "custody" : verification.status.toLowerCase()}`}>
      <header><span>OWNERSHIP REVIEW</span>{accepted ? <CheckCircle2 /> : <ShieldCheck />}</header>
      <div className="review-progress">
        <strong>{accepted ? "✓ " : ""}{verification.policy.answeredCount} / {verification.policy.minimumAnswers} câu trả lời tối thiểu</strong>
        <span className={accepted ? "success" : "pending"}>{accepted ? "Đủ điều kiện đặt lịch" : verification.policy.readyForDecision ? "Có thể đưa ra quyết định" : "Chưa đủ điều kiện đặt lịch"}</span>
      </div>

      {accepted && latestDecision && <div className="review-outcome">
        <strong>Finder đã chọn: {selectedDecision ?? "Đề xuất gặp mặt"}</strong>
        <dl><div><dt>Quyết định bởi</dt><dd>{actorName(latestDecision.actorId)}</dd></div><div><dt>Thời gian</dt><dd>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(latestDecision.createdAt))}</dd></div>{lastReason && <div><dt>Lý do</dt><dd>{lastReason}</dd></div>}</dl>
        <div className="review-appointment"><span>APPOINTMENT</span><button type="button" disabled title="Appointment thuộc LNFS-54"><CalendarDays /> Tạo lịch hẹn</button></div>
        {finder && !custody && <button type="button" className="review-correct" onClick={toggleCorrection}>{correctionMode ? "Ẩn lựa chọn quyết định" : "Điều chỉnh quyết định"}</button>}
      </div>}

      {!accepted && !active && <div className="review-outcome"><strong>{selectedDecision ? `Finder đã chọn: ${selectedDecision}` : verification.status === "PENDING" ? "Chờ Finder mở conversation" : custody ? "Đã chuyển sang custody" : verification.status === "REJECTED" ? "Claim đã bị từ chối" : "Conversation đã đóng"}</strong>{lastReason && <p>{lastReason}</p>}{finder && latestDecision && !custody && <button type="button" className="review-correct" onClick={toggleCorrection}>{correctionMode ? "Ẩn lựa chọn quyết định" : "Điều chỉnh quyết định"}</button>}</div>}

      {finder && (active || correctionMode) && <div ref={actionsRef} className="review-actions">
        <span>Bạn muốn thực hiện quyết định nào?</span>
        {(Object.keys(decisionContent) as Decision[]).map((value) => {
          const item = decisionContent[value];
          const Icon = item.icon;
          const disabled = value === "VERIFY_FOR_MEETUP" && !verification.policy.readyForDecision;
          return <button type="button" key={value} className={`review-action review-action--${value.toLowerCase()}`} disabled={disabled} onClick={() => openDecision(value)} title={disabled ? "Claim chưa đủ minimum answers" : item.label}><Icon /><span>{item.label}</span>{disabled && <LockKeyhole />}</button>;
        })}
      </div>}
    </section>

    {decision && <div className="decision-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDecision(null); }}>
      <section className="decision-modal" role="dialog" aria-modal="true" aria-labelledby="decision-modal-title">
        <header><div><span>Xác nhận quyết định</span><h3 id="decision-modal-title">{decisionContent[decision].title}</h3></div><button type="button" onClick={() => setDecision(null)} disabled={busy} title="Đóng"><X /></button></header>
        <p>{decision === "VERIFY_FOR_MEETUP" ? "Bạn đang xác nhận claim đã đủ điều kiện để tiến tới meetup." : "Quyết định sẽ cập nhật trạng thái claim trên server."}</p>
        <label>Lý do / nhận xét<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={1000} autoFocus required /></label>
        <div className="decision-audit-note"><LockKeyhole /> Quyết định này sẽ được ghi vào audit.</div>
        {error && <div className="decision-modal-error"><AlertTriangle /> {error}</div>}
        <footer><button type="button" className="secondary" onClick={() => setDecision(null)} disabled={busy}>Hủy</button><button type="button" onClick={() => void confirmDecision()} disabled={busy || !reason.trim()}>{busy ? "Đang ghi..." : "Xác nhận quyết định"}</button></footer>
      </section>
    </div>}
  </>;
}
