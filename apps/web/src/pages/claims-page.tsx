import { AlertTriangle, ArrowLeft, Check, Clock3, ImagePlus, LockKeyhole, MessageCircle, RefreshCw, Send, ShieldCheck, Upload, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { api, type ClaimEvidence, type ClaimMessage, type ClaimRecord, type ClaimStatus } from "../services/api";

const statusLabels: Record<ClaimStatus, string> = {
  PENDING: "Đang chờ Finder phản hồi",
  CONVERSATION_OPEN: "Đang trao đổi riêng",
  NEED_MORE_INFO: "Cần bổ sung thông tin",
  ACCEPTED: "Đã xác nhận",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã rút yêu cầu"
};

function formatDate(value: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function claimTitle(claim: ClaimRecord) {
  return claim.posts.lost?.title ?? "Yêu cầu xác minh vật phẩm";
}

function EvidenceImage({ evidence }: { evidence: ClaimEvidence }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    api.getClaimEvidenceMedia(evidence.url).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setSource(objectUrl);
    }).catch(() => { if (active) setSource(""); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [evidence.url]);
  return <div className="claim-evidence-image">
    {source ? <img src={source} alt={evidence.description || "Private evidence"} /> : <span>{source === "" ? "Không tải được ảnh" : "Đang tải ảnh..."}</span>}
  </div>;
}

function ClaimList({ claims, selectedId, onSelect }: { claims: ClaimRecord[]; selectedId?: string; onSelect: (id: string) => void }) {
  if (!claims.length) return <div className="claim-list-empty"><MessageCircle /><strong>Chưa có yêu cầu xác minh</strong><span>Khi matching gợi ý một cặp phù hợp, bạn có thể mở trao đổi riêng tại đây.</span></div>;
  return <div className="claim-list">{claims.map((claim) => <button className={`claim-list-item ${selectedId === claim.id ? "active" : ""}`} key={claim.id} onClick={() => onSelect(claim.id)}>
    <span className={`claim-status-dot claim-status-dot--${claim.status.toLowerCase()}`} />
    <span><strong>{claimTitle(claim)}</strong><small>{statusLabels[claim.status]}</small></span>
    <Clock3 />
  </button>)}</div>;
}

function MessageBubble({ message, own }: { message: ClaimMessage; own: boolean }) {
  return <div className={`claim-message ${own ? "own" : ""}`}>
    {!own && <small>{message.sender.fullName}</small>}
    <p>{message.content}</p>
    <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
  </div>;
}

export function ClaimsPage() {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [claim, setClaim] = useState<ClaimRecord | null>(null);
  const [messages, setMessages] = useState<ClaimMessage[]>([]);
  const [evidence, setEvidence] = useState<ClaimEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomLoading, setRoomLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [decision, setDecision] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.listClaims().then((result) => {
      if (!active) return;
      setClaims(result.items);
      if (!claimId && result.items[0]) navigate(`/claims/${result.items[0].id}`, { replace: true });
    }).catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [claimId, navigate]);

  async function loadClaimRoom(id: string, silent = false) {
    if (!silent) setRoomLoading(true);
    setError("");
    try {
      const current = await api.getClaim(id);
      if (silent) setClaim(current); else setClaim(current);
      if (!current.canSend) {
        setMessages([]);
        setEvidence([]);
        return;
      }
      const [messageResult, evidenceResult] = await Promise.all([api.listClaimMessages(id), api.listClaimEvidence(id)]);
      setMessages(messageResult.items);
      setEvidence(evidenceResult.items);
    } catch (reason) {
      if (!silent) setError(reason instanceof Error ? reason.message : "Không thể mở trao đổi riêng");
    } finally {
      if (!silent) setRoomLoading(false);
    }
  }

  useEffect(() => {
    if (!claimId) return;
    void loadClaimRoom(claimId);
  }, [claimId]);

  useEffect(() => {
    if (!claimId || !claim?.canSend) return;
    const timer = window.setInterval(() => { void loadClaimRoom(claimId, true); }, 10_000);
    return () => window.clearInterval(timer);
  }, [claimId, claim?.canSend]);

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    const content = messageDraft.trim();
    if (!content || !claimId) return;
    setSending(true);
    setError("");
    try {
      const sent = await api.sendClaimMessage(claimId, content);
      setMessages((current) => [...current, sent]);
      setMessageDraft("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi tin nhắn");
    } finally { setSending(false); }
  }

  async function respond(nextDecision: "ACCEPT" | "DECLINE" | "REQUEST_MORE_INFO") {
    if (!claimId) return;
    setDecision(true);
    setError("");
    try {
      const updated = await api.decideClaim(claimId, nextDecision, decisionNote.trim() || undefined);
      setClaim(updated);
      setDecisionNote("");
      await loadClaimRoom(claimId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật yêu cầu");
    } finally { setDecision(false); }
  }

  async function withdraw() {
    if (!claimId) return;
    setWithdrawing(true);
    setError("");
    try {
      await api.withdrawClaim(claimId);
      await loadClaimRoom(claimId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể rút yêu cầu");
    } finally { setWithdrawing(false); }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setUploadError("");
  }

  async function uploadEvidence(event: FormEvent) {
    event.preventDefault();
    if (!claimId || !selectedFile) return;
    setUploading(true);
    setUploadError("");
    try {
      const uploaded = await api.uploadClaimEvidence(claimId, selectedFile, evidenceDescription.trim() || undefined);
      setEvidence((current) => [...current, uploaded]);
      setSelectedFile(null);
      setEvidenceDescription("");
      if (fileInput.current) fileInput.current.value = "";
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : "Không thể tải evidence");
    } finally { setUploading(false); }
  }

  const canDecide = Boolean(claim && user?.id === claim.finderId && claim.finderDecision === "PENDING" && claim.status === "PENDING");

  return <main className="claims-page">
    <header className="claims-heading">
      <div><p className="eyebrow">XÁC MINH PEER-TO-PEER</p><h1>Trao đổi riêng</h1><p>Chỉ claimant và Finder của từng cặp matching mới có thể xem tin nhắn và evidence.</p></div>
      <Link className="claims-back" to="/posts"><ArrowLeft /> Quay lại bài đăng</Link>
    </header>
    {error && <div className="claim-alert"><AlertTriangle /> {error}</div>}
    {loading ? <div className="claim-loading"><RefreshCw /><span>Đang tải các yêu cầu riêng...</span></div> : <section className="claims-layout">
      <aside className="claims-sidebar"><div className="claims-sidebar__title"><span><MessageCircle /> Yêu cầu của tôi</span><strong>{claims.length}</strong></div><ClaimList claims={claims} selectedId={claimId} onSelect={(id) => navigate(`/claims/${id}`)} /></aside>
      {!claimId ? <section className="claim-welcome"><ShieldCheck /><h2>Chọn một yêu cầu để mở phòng riêng</h2><p>Phòng trao đổi không xuất hiện trong bảng tin công khai và không cho phép người ngoài truy cập.</p></section>
        : roomLoading ? <section className="claim-welcome"><RefreshCw className="is-spinning" /><h2>Đang mở phòng riêng...</h2></section>
          : claim ? <section className="claim-room">
            {claim.claimantId === user?.id && ["PENDING", "CONVERSATION_OPEN", "NEED_MORE_INFO"].includes(claim.status) && <button className="claim-withdraw-button" type="button" disabled={withdrawing} onClick={() => void withdraw()}><X /> {withdrawing ? "Đang rút..." : "Rút yêu cầu"}</button>}
            <header className="claim-room__header"><div><span className={`claim-status claim-status--${claim.status.toLowerCase()}`}>{statusLabels[claim.status]}</span><h2>{claimTitle(claim)}</h2><p>FOUND: {claim.posts.found.title} · Cập nhật {formatDate(claim.updatedAt)}</p></div><LockKeyhole /></header>
            <div className="claim-participants"><span><UserRound /> Claimant: <strong>{claim.claimant.fullName}</strong></span><span><UserRound /> Finder: <strong>{claim.finder.fullName}</strong></span></div>
            {canDecide && <section className="claim-decision"><div><strong>Finder, bạn có muốn mở trao đổi với claimant này?</strong><p>Bạn có thể chấp nhận, yêu cầu thêm thông tin hoặc từ chối. Mỗi claimant có một phòng riêng.</p></div><textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} maxLength={2000} placeholder="Ghi chú tùy chọn..." /><div className="claim-decision__actions"><button disabled={decision} onClick={() => void respond("ACCEPT")}><Check /> Chấp nhận</button><button disabled={decision} onClick={() => void respond("REQUEST_MORE_INFO")}><MessageCircle /> Yêu cầu thêm thông tin</button><button className="danger" disabled={decision} onClick={() => void respond("DECLINE")}><X /> Từ chối</button></div></section>}
            {!claim.canSend ? <div className="claim-pending"><Clock3 /><strong>{claim.finderDecision === "DECLINED" ? "Finder đã từ chối yêu cầu này." : "Phòng riêng chưa mở."}</strong><span>{claim.finderDecision === "PENDING" ? "Bạn sẽ có thể nhắn tin và chia sẻ ảnh sau khi Finder chấp nhận." : "Bạn không thể gửi thêm nội dung trong yêu cầu này."}</span></div> : <>
              <div className="claim-room__body"><div className="claim-messages">{messages.length ? messages.map((message) => <MessageBubble key={message.id} message={message} own={message.sender.id === user?.id} />) : <div className="claim-messages__empty"><MessageCircle /><span>Chưa có tin nhắn. Hãy bắt đầu trao đổi riêng.</span></div>}</div>
                <form className="claim-message-form" onSubmit={submitMessage}><textarea aria-label="Tin nhắn riêng" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={5000} placeholder="Nhập câu hỏi hoặc thông tin xác minh..." /><button disabled={sending || !messageDraft.trim()}><Send /> {sending ? "Đang gửi..." : "Gửi"}</button></form>
              </div>
              <section className="claim-evidence"><header><div><p className="eyebrow">PRIVATE EVIDENCE</p><h3>Ảnh và thuộc tính chỉ trong phòng này</h3></div><ImagePlus /></header><div className="claim-evidence-grid">{evidence.map((item) => <article key={item.id}><EvidenceImage evidence={item} /><div><strong>{item.uploadedBy.fullName}</strong><span>{item.description || "Ảnh xác minh"}</span><small>{formatDate(item.createdAt)}</small></div></article>)}{!evidence.length && <p className="claim-evidence-empty">Chưa có ảnh evidence được chia sẻ.</p>}</div>
                <form className="claim-upload" onSubmit={uploadEvidence}><label className="claim-file-input"><Upload /><span>{selectedFile ? selectedFile.name : "Chọn ảnh JPEG, PNG hoặc WEBP (tối đa 10 MB)"}</span><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} /></label><input value={evidenceDescription} onChange={(event) => setEvidenceDescription(event.target.value)} maxLength={255} placeholder="Mô tả ngắn (không bắt buộc)" /><button disabled={!selectedFile || uploading}><Upload /> {uploading ? "Đang tải..." : "Chia sẻ ảnh riêng"}</button>{uploadError && <div className="claim-upload-error"><AlertTriangle /> {uploadError} {selectedFile && <button type="button" onClick={() => void uploadEvidence(new Event("submit") as unknown as FormEvent)}>Thử lại</button>}</div>}</form>
              </section>
            </>}
            <footer className="claim-privacy-note"><ShieldCheck /><span>Media được tải qua endpoint private có authorization và không được đưa vào API bảng tin.</span></footer>
          </section> : <section className="claim-welcome"><AlertTriangle /><h2>Không mở được yêu cầu</h2><p>Yêu cầu không tồn tại hoặc tài khoản này không thuộc participant set.</p></section>}
    </section>}
  </main>;
}
