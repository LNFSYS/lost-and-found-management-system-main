import { AlertTriangle, Clock3, FileCheck2, Image, LockKeyhole, MessageCircle, Plus, RefreshCw, Search, Send, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ClaimEvidencePanel } from "../components/claim-evidence-panel";
import { ClaimItemPanel } from "../components/claim-item-panel";
import { ClaimVerificationPanel } from "../components/claim-verification-panel";
import { ClaimVerificationQuestionModal } from "../components/claim-verification-question-modal";
import { useAuth } from "../context/auth-context";
import {
  api, type ClaimEvidence, type ClaimMessage, type ClaimRecord, type ClaimStatus, type VerificationTemplatesResponse,
  type ClaimVerificationState
} from "../services/api";

const statusLabels: Record<ClaimStatus, string> = {
  PENDING: "Chờ Finder",
  CONVERSATION_OPEN: "Đang trao đổi riêng",
  NEED_MORE_INFO: "Cần thêm thông tin",
  ACCEPTED: "Đủ điều kiện gặp mặt",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã đóng"
};

type ConversationFilter = "ALL" | "UNREAD" | "ACTIVE";
type MessageCursor = { before: string; beforeId: string };

function formatTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function mergeMessages(current: ClaimMessage[], incoming: ClaimMessage[]) {
  const messages = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => messages.set(message.id, message));
  return [...messages.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

function claimTitle(claim: ClaimRecord) {
  return claim.item?.title ?? claim.posts.found.title;
}

function counterpartName(claim: ClaimRecord, userId?: string) {
  return claim.finderId === userId ? claim.claimant.fullName : claim.finder.fullName;
}

function conversationStatus(claim: ClaimRecord) {
  if (claim.conversation?.custodyEscalated) return { label: "Custody", tone: "custody" };
  if (claim.status === "ACCEPTED") return { label: "Đã đề xuất gặp mặt", tone: "eligible" };
  if (claim.status === "NEED_MORE_INFO") return { label: "Cần thêm thông tin", tone: "verification" };
  if (claim.status === "REJECTED") return { label: "Đã bị từ chối", tone: "declined" };
  if (claim.status === "CANCELLED") return { label: "Closed", tone: "closed" };
  return { label: "Verification", tone: "verification" };
}

function ClaimList({ claims, selectedId, userId, onSelect }: { claims: ClaimRecord[]; selectedId?: string; userId?: string; onSelect: (id: string) => void }) {
  if (!claims.length) return <div className="claim-list-empty"><MessageCircle /><strong>Không có conversation phù hợp</strong></div>;
  return <div className="claim-list">{claims.map((claim) => {
    const status = conversationStatus(claim);
    return <button className={`claim-list-item ${selectedId === claim.id ? "active" : ""}`} key={claim.id} onClick={() => onSelect(claim.id)}>
      <span className={`conversation-avatar conversation-avatar--${status.tone}`}>{counterpartName(claim, userId).slice(0, 1).toUpperCase()}</span>
      <span className="conversation-copy">
        <span className="conversation-person"><strong>{counterpartName(claim, userId)}</strong><time>{formatTime(claim.conversation?.lastMessageAt ?? claim.updatedAt)}</time></span>
        <b>{claimTitle(claim)}</b>
        <small>“{claim.conversation?.lastMessage ?? claim.description ?? "Chưa có tin nhắn"}”</small>
        <span className={`conversation-status conversation-status--${status.tone}`}><i />{status.label}</span>
      </span>
      {(claim.conversation?.unreadCount ?? 0) > 0 && <span className="conversation-unread">{claim.conversation!.unreadCount}</span>}
    </button>;
  })}</div>;
}

function MessageBubble({ message, own, user, onReplyQuestion }: { message: ClaimMessage; own: boolean; user?: { id: string }; onReplyQuestion?: (question: string) => void }) {
  const isDecisionNotification = message.content?.startsWith("⚖️ ");
  const isVerificationQuestion = message.content?.startsWith("🔍 Câu hỏi xác minh:") && !message.content?.includes("✏️ Câu trả lời:");
  const shouldShowReply = isVerificationQuestion && !own && user && message.sender.id !== user.id;

  if (isDecisionNotification) return <div className="claim-message claim-message--system" role="status"><p>{message.content}</p><time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time></div>;
  
  return <div className={`claim-message ${own ? "own" : ""}`}>
    {!own && <small>{message.sender.fullName}</small>}
    <p>{message.content}</p>
    <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
    {shouldShowReply && onReplyQuestion && <button type="button" className="claim-reply-question" onClick={() => onReplyQuestion(message.content ?? "")}><MessageCircle /> Trả lời câu hỏi</button>}
  </div>;
}

export function ClaimsPage() {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [claimPage, setClaimPage] = useState(1);
  const [claimHasMore, setClaimHasMore] = useState(false);
  const [loadingMoreClaims, setLoadingMoreClaims] = useState(false);
  const [claim, setClaim] = useState<ClaimRecord | null>(null);
  const [messages, setMessages] = useState<ClaimMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<MessageCursor | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [evidence, setEvidence] = useState<ClaimEvidence[]>([]);
  const [verification, setVerification] = useState<ClaimVerificationState | null>(null);
  const [verificationTemplates, setVerificationTemplates] = useState<VerificationTemplatesResponse | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roomLoading, setRoomLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [replyingToQuestion, setReplyingToQuestion] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [openingConversation, setOpeningConversation] = useState(false);
  const [openingReason, setOpeningReason] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConversationFilter>("ALL");
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const roomRequest = useRef<{ generation: number; controller: AbortController | null }>({ generation: 0, controller: null });
  const selectedClaimId = useRef<string | undefined>(claimId);
  const messageCursorRef = useRef<MessageCursor | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingMessage = useRef<{ content: string; clientMessageId: string } | null>(null);
  const pendingOpenDecision = useRef<{ decision: "ACCEPT" | "DECLINE" | "REQUEST_MORE_INFO"; key: string } | null>(null);
  const pendingWithdrawal = useRef<string | null>(null);
  const pollInFlight = useRef(false);

  const visibleClaims = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return claims.filter((item) => {
      if (filter === "UNREAD" && !(item.conversation?.unreadCount)) return false;
      if (filter === "ACTIVE" && !["PENDING", "CONVERSATION_OPEN", "NEED_MORE_INFO"].includes(item.status)) return false;
      if (!query) return true;
      return [counterpartName(item, user?.id), claimTitle(item), item.conversation?.lastMessage ?? ""].some((value) => value.toLocaleLowerCase("vi").includes(query));
    }).sort((left, right) => 
      (right.conversation?.lastMessageAt ?? "").localeCompare(left.conversation?.lastMessageAt ?? "") || 
      right.id.localeCompare(left.id)
    );
  }, [claims, filter, search, user?.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.listClaims({ page: 1, pageSize: 50 }).then((result) => {
      if (!active) return;
      const sortedClaims = result.items.sort((left, right) => 
        (right.conversation?.lastMessageAt ?? "").localeCompare(left.conversation?.lastMessageAt ?? "") || 
        right.id.localeCompare(left.id)
      );
      setClaims(sortedClaims);
      setClaimPage(result.page);
      setClaimHasMore(result.hasMore);
      if (!claimId && sortedClaims[0]) navigate(`/claims/${sortedClaims[0].id}`, { replace: true });
    }).catch((failure: Error) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [claimId, navigate]);

  async function loadMoreClaims() {
    if (loadingMoreClaims || !claimHasMore) return;
    setLoadingMoreClaims(true);
    try {
      const result = await api.listClaims({ page: claimPage + 1, pageSize: 50 });
      setClaims((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        result.items.forEach((item) => byId.set(item.id, item));
        return [...byId.values()].sort((left, right) => 
          (right.conversation?.lastMessageAt ?? "").localeCompare(left.conversation?.lastMessageAt ?? "") || 
          right.id.localeCompare(left.id)
        );
      });
      setClaimPage(result.page);
      setClaimHasMore(result.hasMore);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải thêm conversation");
    } finally {
      setLoadingMoreClaims(false);
    }
  }

  function updateMessageCursor(cursor: MessageCursor | null) {
    messageCursorRef.current = cursor;
    setMessageCursor(cursor);
  }

  async function loadClaimRoom(id: string, silent = false) {
    roomRequest.current.controller?.abort();
    const controller = new AbortController();
    const generation = roomRequest.current.generation;
    roomRequest.current.controller = controller;
    const isCurrent = () => roomRequest.current.generation === generation && selectedClaimId.current === id;
    if (!silent) setRoomLoading(true);
    setError("");
    try {
      const current = await api.getClaim(id, controller.signal);
      if (!isCurrent()) return;
      setClaim(current);
      const verificationResult = await api.getClaimVerification(id, controller.signal);
      if (!isCurrent()) return;
      setVerification(verificationResult);
      if (!current.canSend) {
        setMessages([]);
        setEvidence([]);
        setVerificationTemplates(null);
        updateMessageCursor(null);
        return;
      }
      const [messageResult, evidenceResult, templateResult] = await Promise.all([
        api.listClaimMessages(id, undefined, controller.signal),
        api.listClaimEvidence(id, controller.signal),
        verificationResult.participantRole === "FINDER" ? api.getClaimVerificationTemplates(id, controller.signal) : Promise.resolve(null)
      ]);
      if (!isCurrent()) return;
      setMessages((existing) => silent ? mergeMessages(existing, messageResult.items) : messageResult.items);
      if (!silent || !messageCursorRef.current) updateMessageCursor(messageResult.nextCursor);
      setEvidence(evidenceResult.items);
      setVerificationTemplates(templateResult);
      setClaims((items) => items.map((item) => item.id === id && item.conversation ? { ...item, conversation: { ...item.conversation, unreadCount: 0 } } : item));
    } catch (failure) {
      if (!isCurrent() || (failure instanceof Error && failure.name === "AbortError")) return;
      setClaim(null);
      setMessages([]);
      setEvidence([]);
      setVerification(null);
      setVerificationTemplates(null);
      updateMessageCursor(null);
      setError(failure instanceof Error ? failure.message : "Không thể mở conversation");
    } finally {
      if (isCurrent() && !silent) setRoomLoading(false);
    }
  }

  useEffect(() => {
    selectedClaimId.current = claimId;
    roomRequest.current.generation += 1;
    roomRequest.current.controller?.abort();
    roomRequest.current.controller = null;
    setClaim(null);
    setMessages([]);
    setEvidence([]);
    setVerification(null);
    setVerificationTemplates(null);
    updateMessageCursor(null);
    setMessageDraft("");
    setAttachmentMenu(false);
    pendingMessage.current = null;
    if (claimId) void loadClaimRoom(claimId);
    return () => roomRequest.current.controller?.abort();
  }, [claimId, user?.id]);

  useEffect(() => {
    if (!claimId || !claim?.canSend) return;
    const timer = window.setInterval(() => {
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      void loadClaimRoom(claimId, true).finally(() => { pollInFlight.current = false; });
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [claimId, claim?.canSend]);

  // Refresh verification periodically to update answeredCount
  useEffect(() => {
    if (!claimId || !claim?.canSend) return;
    const timer = window.setInterval(() => {
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      api.getClaimVerification(claimId).then(setVerification).catch(() => {}).finally(() => { pollInFlight.current = false; });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [claimId, claim?.canSend]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadOlderMessages() {
    if (!claimId || !messageCursorRef.current || loadingOlder) return;
    const cursor = messageCursorRef.current;
    const generation = roomRequest.current.generation;
    setLoadingOlder(true);
    try {
      const result = await api.listClaimMessages(claimId, cursor);
      if (selectedClaimId.current !== claimId || roomRequest.current.generation !== generation) return;
      setMessages((current) => mergeMessages(current, result.items));
      updateMessageCursor(result.nextCursor);
    } catch (failure) {
      if (failure instanceof Error && failure.name === "AbortError") return;
      if (selectedClaimId.current === claimId) setError(failure instanceof Error ? failure.message : "Không thể tải tin nhắn cũ");
    } finally {
      setLoadingOlder(false);
    }
  }

  function handleReplyQuestion(messageContent: string) {
    // Extract the question from the message content
    const questionText = messageContent.replace("🔍 Câu hỏi xác minh:\n", "").trim();
    setReplyingToQuestion(questionText);
    // Focus on the textarea
    const textarea = document.querySelector('textarea[aria-label="Tin nhắn riêng"]') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  }

  function cancelReplyQuestion() {
    setReplyingToQuestion(null);
  }

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    const content = messageDraft.trim();
    if (!content || !claimId) return;
    setSending(true);
    setError("");
    
    // Format message if replying to a question
    let finalContent = content;
    if (replyingToQuestion) {
      finalContent = `🔍 Câu hỏi xác minh:\n${replyingToQuestion}\n\n✏️ Câu trả lời: ${content}`;
    }
    
    const retry = pendingMessage.current?.content === finalContent ? pendingMessage.current : { content: finalContent, clientMessageId: crypto.randomUUID() };
    pendingMessage.current = retry;
    try {
      const sent = await api.sendClaimMessage(claimId, finalContent, retry.clientMessageId);
      setMessages((current) => [...current, sent]);
      setClaims((items) => items.map((item) => item.id === claimId ? { ...item, conversation: { lastMessage: finalContent, lastMessageAt: sent.createdAt, unreadCount: 0, custodyEscalated: item.conversation?.custodyEscalated } } : item));
      setMessageDraft("");
      setReplyingToQuestion(null);
      if (pendingMessage.current?.clientMessageId === retry.clientMessageId) pendingMessage.current = null;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể gửi tin nhắn");
    } finally { setSending(false); }
  }

  async function withdraw() {
    if (!claimId) return;
    setWithdrawing(true);
    setError("");
    try {
      pendingWithdrawal.current ??= crypto.randomUUID();
      await api.withdrawClaim(claimId, pendingWithdrawal.current);
      pendingWithdrawal.current = null;
      await loadClaimRoom(claimId);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể đóng claim");
    } finally { setWithdrawing(false); }
  }

  function applyClaimUpdate(updated: ClaimRecord) {
    setClaim(updated);
    setClaims((current) => current.map((item) => item.id === updated.id ? {
      ...item,
      ...updated,
      conversation: updated.conversation ?? item.conversation
    } : item));
  }

  async function decideConversation(decision: "ACCEPT" | "DECLINE" | "REQUEST_MORE_INFO") {
    if (!claimId || !openingReason.trim()) return;
    setOpeningConversation(true);
    setError("");
    const retry = pendingOpenDecision.current?.decision === decision ? pendingOpenDecision.current : { decision, key: crypto.randomUUID() };
    pendingOpenDecision.current = retry;
    try {
      const updated = await api.decideClaim(claimId, decision, openingReason.trim(), retry.key);
      pendingOpenDecision.current = null;
      setOpeningReason("");
      applyClaimUpdate(updated);
      await loadClaimRoom(claimId);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể lưu quyết định");
    } finally { setOpeningConversation(false); }
  }

  function jumpTo(sectionId: string) {
    setAttachmentMenu(false);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const sensitiveDocument = /thẻ|giấy|cccd|cmnd|bằng lái|ngân hàng/i.test(claim?.item?.categoryName ?? "");

  return <main className="claims-page">
    {error && <div className="claim-alert"><AlertTriangle /> {error}</div>}
    {loading ? <div className="claim-loading"><RefreshCw /><span>Đang tải conversations...</span></div> : <section className="claims-layout">
      <aside className="claims-sidebar">
        <header><span>CONVERSATION</span><strong>{claims.length}</strong></header>
        <label className="conversation-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm cuộc trò chuyện..." /></label>
        <div className="conversation-filters" role="tablist">{(["ALL", "UNREAD", "ACTIVE"] as ConversationFilter[]).map((value) => <button type="button" role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value === "ALL" ? "Tất cả" : value === "UNREAD" ? "Chưa đọc" : "Đang xử lý"}</button>)}</div>
        <ClaimList claims={visibleClaims} selectedId={claimId} userId={user?.id} onSelect={(id) => navigate(`/claims/${id}`)} />
        {claimHasMore && <button className="claim-load-older claim-load-claims" type="button" disabled={loadingMoreClaims} onClick={() => void loadMoreClaims()}><RefreshCw className={loadingMoreClaims ? "is-spinning" : ""} /> {loadingMoreClaims ? "Đang tải..." : "Xem thêm"}</button>}
      </aside>

      {!claimId ? <section className="claim-workspace-state"><MessageCircle /><h2>Chọn một conversation</h2></section>
        : roomLoading ? <section className="claim-workspace-state"><RefreshCw className="is-spinning" /><h2>Đang mở conversation...</h2></section>
          : claim ? <>
            <section className="claim-chat">
              <header className="claim-chat-header">
                <div><strong>{counterpartName(claim, user?.id)}</strong><span><i /> {claim.canSend ? "Đang hoạt động" : statusLabels[claim.status]}</span><small>{claimTitle(claim)}</small></div>
                {claim.claimantId === user?.id && ["PENDING", "CONVERSATION_OPEN", "NEED_MORE_INFO"].includes(claim.status) && <button type="button" className="claim-close-button" disabled={withdrawing} onClick={() => void withdraw()} title="Đóng claim"><X /></button>}
              </header>

              {!claim.canSend ? claim.finderId === user?.id && claim.status === "PENDING" ? <section className="claim-open-decision">
                <div><Clock3 /><strong>Mở conversation xác minh</strong></div>
                <textarea value={openingReason} onChange={(event) => setOpeningReason(event.target.value)} minLength={3} maxLength={1000} placeholder="Lý do quyết định" />
                <div><button type="button" disabled={openingConversation || !openingReason.trim()} onClick={() => void decideConversation("ACCEPT")}><MessageCircle /> Mở conversation</button><button type="button" disabled={openingConversation || !openingReason.trim()} onClick={() => void decideConversation("REQUEST_MORE_INFO")}><Clock3 /> Yêu cầu bổ sung</button><button type="button" className="danger" disabled={openingConversation || !openingReason.trim()} onClick={() => void decideConversation("DECLINE")}><X /> Từ chối</button></div>
              </section> : <div className="claim-pending"><Clock3 /><strong>{claim.status === "ACCEPTED" ? "Finder đã đưa ra quyết định" : claim.status === "NEED_MORE_INFO" ? "Finder đã yêu cầu thêm thông tin" : claim.finderDecision === "DECLINED" ? "Claim đã bị từ chối" : "Đang chờ Finder mở conversation"}</strong></div> : <>
                <div className="claim-chat-scroll">
                  <div className="claim-messages">
                    {messageCursor && <button className="claim-load-older" type="button" disabled={loadingOlder} onClick={() => void loadOlderMessages()}><RefreshCw className={loadingOlder ? "is-spinning" : ""} /> {loadingOlder ? "Đang tải..." : "Tin nhắn cũ hơn"}</button>}
                    {messages.length ? messages.map((message) => <MessageBubble key={message.id} message={message} own={message.sender.id === user?.id} user={user ?? undefined} onReplyQuestion={handleReplyQuestion} />) : <div className="claim-messages__empty"><MessageCircle /><span>Chưa có tin nhắn.</span></div>}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                <form className="claim-message-form" onSubmit={submitMessage}>
                  {replyingToQuestion && <div className="claim-reply-tag"><span>Đang trả lời: {replyingToQuestion}</span><button type="button" onClick={cancelReplyQuestion} title="Hủy trả lời"><X /></button></div>}
                  <div className="input-row">
                    <div className="message-attachment"><button type="button" onClick={() => setAttachmentMenu((value) => !value)} title="Thêm"><Plus /></button>{attachmentMenu && <div className="message-attachment-menu"><button type="button" onClick={() => jumpTo("private-evidence")}><Image /> Ảnh</button><button type="button" onClick={() => jumpTo("private-evidence")}><FileCheck2 /> Evidence</button></div>}</div>
                    <textarea aria-label="Tin nhắn riêng" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={5000} placeholder={replyingToQuestion ? "Nhập câu trả lời..." : "Nhập tin nhắn hoặc câu hỏi..."} />
                    <div className="message-actions">
                      {verification?.participantRole === "FINDER" && claim.canSend && <button type="button" className="verification-button" onClick={() => setShowVerificationModal(true)} title="Gửi câu hỏi xác minh"><ShieldCheck /></button>}
                      <button type="submit" disabled={sending || !messageDraft.trim()} title="Gửi tin nhắn"><Send /></button>
                    </div>
                  </div>
                </form>
                {showVerificationModal && verification && verificationTemplates && <ClaimVerificationQuestionModal claim={claim} verification={verification} templates={verificationTemplates} onClose={() => setShowVerificationModal(false)} onSuccess={setVerification} />}
              </>}
            </section>

            <aside className="claim-inspector">
              <ClaimItemPanel claim={claim} />
              <ClaimEvidencePanel claimId={claim.id} evidence={evidence} sensitiveDocument={sensitiveDocument} canUpload={Boolean(claim.canSend && verification?.participantRole === "CLAIMANT")} onEvidenceAdded={(item) => setEvidence((current) => [...current, item])} />
              <ClaimVerificationPanel claim={claim} verification={verification} onVerificationChange={setVerification} onClaimChange={applyClaimUpdate} onDecisionMessage={(message) => setMessages((current) => mergeMessages(current, [message]))} />
            </aside>
          </> : <section className="claim-workspace-state"><AlertTriangle /><h2>Không mở được conversation</h2></section>}
    </section>}
  </main>;
}
