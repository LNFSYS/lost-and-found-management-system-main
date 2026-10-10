import { AlertTriangle, ChevronDown, ChevronUp, Clock3, FileCheck2, FileWarning, Image, LockKeyhole, MessageCircle, Plus, RefreshCw, Search, Send, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ClaimEvidencePanel } from "../components/claim-evidence-panel";
import { ClaimItemPanel } from "../components/claim-item-panel";
import { ClaimVerificationPanel } from "../components/claim-verification-panel";
import { ClaimVerificationQuestionModal } from "../components/claim-verification-question-modal";
import { LostContactPhotoGate } from "../components/lost-contact-photo-gate";
import { ClaimChatImage } from "../components/claim-chat-image";
import { useAuth } from "../context/auth-context";
import {
  api, type ClaimEvidence, type ClaimMessage, type ClaimRecord, type ClaimStatus, type PostSummary, type VerificationTemplatesResponse,
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
    {message.messageType === "IMAGE" && message.mediaUrl && <ClaimChatImage url={message.mediaUrl} />}
    <p>{message.content}</p>
    <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
    {shouldShowReply && onReplyQuestion && <button type="button" className="claim-reply-question" onClick={() => onReplyQuestion(message.content ?? "")}><MessageCircle /> Trả lời câu hỏi</button>}
    {!own && <Link className="claim-report-link" to={`/reports?targetType=MESSAGE&targetId=${message.id}`} title="Báo cáo tin nhắn"><FileWarning /> Báo cáo</Link>}
  </div>;
}

function DirectMessageDraft({ postId, sourceFoundPostId, viewer }: { postId: string; sourceFoundPostId?: string; viewer?: { id: string; fullName: string } }) {
  const navigate = useNavigate();
  const [post, setPost] = useState<PostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [contactCheckId, setContactCheckId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pendingMessage = useRef<{ content: string; clientMessageId: string } | null>(null);
  const draftGeneration = useRef(0);
  const openingContact = useRef(false);
  const contactRequest = useRef<{ checkId: string; key: string; questions: string[] } | null>(null);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  const draftClaim = useMemo<ClaimRecord | null>(() => {
    if (!post) return null;
    const currentUser = viewer ?? { id: "draft-user", fullName: "Bạn" };
    const isFinder = post.type === "LOST";
    const claimant = isFinder ? post.owner : currentUser;
    const finder = isFinder ? currentUser : post.owner;
    const media = post.media.find((item) => item.mediaKind === "ITEM");
    const locationLabel = [post.location.building?.name, post.location.roomText, post.location.area?.name, post.location.customLocation]
      .filter(Boolean).join(" · ") || post.handoverPoint?.name || null;
    return {
      id: `draft:${post.id}`,
      lostPostId: null,
      foundPostId: post.id,
      claimantId: claimant.id,
      finderId: finder.id,
      status: "CONVERSATION_OPEN",
      finderDecision: "ACCEPTED",
      conversationDecision: "OPEN_CONVERSATION",
      appointmentEligible: false,
      description: null,
      approximateLostAt: null,
      approximateLocation: null,
      rejectionReason: null,
      moreInfoRequest: null,
      acceptedAt: null,
      rejectedAt: null,
      cancelledAt: null,
      createdAt: post.createdAt,
      updatedAt: post.createdAt,
      claimant,
      finder,
      posts: { lost: null, found: { id: post.id, title: post.title } },
      roomId: null,
      canSend: true,
      item: {
        postId: post.id,
        title: post.title,
        categoryName: post.category?.name ?? null,
        locationLabel,
        imageUrl: media?.url ?? null
      }
    };
  }, [post, viewer]);

  useEffect(() => {
    let active = true;
    draftGeneration.current += 1;
    setLoading(true);
    setError("");
    setContactCheckId(null);
    pendingMessage.current = null;
    void (async () => {
      try {
        const existing = sourceFoundPostId ? null : await api.findConversationByPost(postId).catch(() => null);
        if (!active) return;
        if (existing) {
          navigate(`/claims/${existing.id}`, { replace: true });
          return;
        }
        const value = await api.getPost(postId);
        if (active) setPost(value);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Không thể tải bài đăng");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; draftGeneration.current += 1; };
  }, [navigate, postId, sourceFoundPostId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !post) return;
    if (post.type === "LOST" && !contactCheckId) { setError("Cần kiểm tra ảnh từ 50% trước khi gửi tin nhắn."); return; }
    setSending(true);
    setError("");
    const retry = pendingMessage.current?.content === content
      ? pendingMessage.current
      : { content, clientMessageId: crypto.randomUUID() };
    pendingMessage.current = retry;
    const generation = draftGeneration.current;
    try {
      const result = await api.createDirectMessage(post.id, content, retry.clientMessageId, sourceFoundPostId, contactCheckId ?? undefined);
      if (generation !== draftGeneration.current) return;
      pendingMessage.current = null;
      navigate(`/claims/${result.claim.id}`, { replace: true });
    } catch (reason) {
      if (generation === draftGeneration.current) setError(reason instanceof Error ? reason.message : "Không thể gửi tin nhắn");
    } finally {
      if (generation === draftGeneration.current) setSending(false);
    }
  }

  async function openContact(checkId: string | null, questions?: string[]) {
    setContactCheckId(checkId);
    if (!checkId || !post || openingContact.current) return;
    const request = contactRequest.current?.checkId === checkId ? contactRequest.current
      : { checkId, key: crypto.randomUUID(), questions: questions ?? [] };
    contactRequest.current = request;
    openingContact.current = true; setSending(true); setError("");
    const generation = draftGeneration.current;
    try {
      const created = await api.createClaim({ postId: post.id, contactCheckId: checkId, requestKey: request.key, sourceFoundPostId });
      if (generation !== draftGeneration.current) return;
      navigate(`/claims/${created.id}`, { replace: true, state: { claimId: created.id, contactQuestions: request.questions, initialDraft: currentDraft.current } });
    } catch (reason) {
      if (generation === draftGeneration.current) setError(reason instanceof Error ? reason.message : "Không thể mở cuộc trò chuyện");
    } finally {
      openingContact.current = false;
      if (generation === draftGeneration.current) setSending(false);
    }
  }

  if (loading) return <section className="claim-workspace-state"><RefreshCw className="is-spinning" /><h2>Đang mở khung soạn tin nhắn...</h2></section>;
  if (!post) return <section className="claim-workspace-state"><AlertTriangle /><h2>Không mở được khung tin nhắn</h2><p>{error || "Bài đăng không tồn tại hoặc bạn không có quyền xem."}</p></section>;
  if (post.canEdit || !["OPEN", "MATCHED"].includes(post.status)) return <section className="claim-workspace-state"><AlertTriangle /><h2>Không thể nhắn tin cho bài đăng này</h2></section>;

  if (!draftClaim) return null;

  return <>
    <section className="claim-chat">
      <header className="claim-chat-header">
        <div><strong>{counterpartName(draftClaim, viewer?.id)}</strong><span><i /> Đang hoạt động</span><small>{claimTitle(draftClaim)}</small></div>
      </header>
      <div className="claim-chat-scroll">
        {post.type === "LOST" && <LostContactPhotoGate key={post.id} postId={post.id} disabled={sending} onReady={(id, questions) => void openContact(id, questions)} />}
        {error && <p className="field-error contact-draft-error" role="alert">{error}</p>}
        {post.type === "LOST" ? <div className="claim-private-banner"><MessageCircle /><div><strong>{sending ? "Đang mở cuộc trò chuyện..." : "Đối chiếu ảnh để mở cuộc trò chuyện"}</strong>{error && contactCheckId && <button type="button" disabled={sending} onClick={() => void openContact(contactCheckId)}>Thử mở lại</button>}</div></div>
          : <div className="claim-private-banner"><MessageCircle /><div><strong>Cuộc trò chuyện chưa được lưu</strong><span>Chỉ khi bạn gửi tin nhắn đầu tiên, cuộc trò chuyện mới xuất hiện trong danh sách.</span></div></div>}
        <div className="claim-messages"><div className="claim-messages__empty"><MessageCircle /><span>Chưa có tin nhắn.</span></div></div>
      </div>
      <form className="claim-message-form claim-message-form--draft" onSubmit={submit}>
        <div className="input-row">
          <textarea aria-label="Tin nhắn riêng" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5000} placeholder="Nhập tin nhắn hoặc câu hỏi..." />
          <div className="message-actions"><button type="submit" disabled={sending || !draft.trim() || (post.type === "LOST" && !contactCheckId)} title="Gửi tin nhắn"><Send /></button></div>
        </div>
      </form>
    </section>
    <aside className="claim-inspector claim-draft-inspector">
      <ClaimItemPanel claim={draftClaim} />
      {post.type === "FOUND" && <section><p className="eyebrow">LƯU Ý</p><span>Rời khỏi trang này khi chưa gửi tin nhắn sẽ không tạo cuộc trò chuyện.</span></section>}
    </aside>
  </>;
}

export function ClaimsPage() {
  const location = useLocation();
  const { claimId } = useParams();
  const [searchParams] = useSearchParams();
  const composePostId = searchParams.get("composePostId") ?? undefined;
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
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState("");
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
  const [showMobileConversations, setShowMobileConversations] = useState(false);
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatPreview, setChatPreview] = useState("");
  const [checkedQuestions, setCheckedQuestions] = useState<{ claimId: string; questions: string[] } | null>(null);
  const [questionsExpanded, setQuestionsExpanded] = useState(true);
  const questionToggle = useRef<HTMLButtonElement>(null);
  const [evidenceUploadRequest, setEvidenceUploadRequest] = useState(0);
  const chatFileInput = useRef<HTMLInputElement>(null);
  const pendingImage = useRef<{ file: File; content: string; key: string } | null>(null);
  const pendingQuestion = useRef<{ question: string; key: string } | null>(null);
  const sendInFlight = useRef(false);
  const roomRequest = useRef<{ generation: number; controller: AbortController | null }>({ generation: 0, controller: null });
  const verificationRequest = useRef<{ controller: AbortController | null; blocked: boolean }>({ controller: null, blocked: false });
  const selectedClaimId = useRef<string | undefined>(claimId);
  const messageCursorRef = useRef<MessageCursor | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingMessage = useRef<{ content: string; clientMessageId: string } | null>(null);
  const pendingOpenDecision = useRef<{ decision: "ACCEPT" | "DECLINE" | "REQUEST_MORE_INFO"; key: string } | null>(null);
  const pendingWithdrawal = useRef<string | null>(null);
  const pollInFlight = useRef(false);

  function isCurrentRoom(id: string, generation: number) {
    return selectedClaimId.current === id && roomRequest.current.generation === generation;
  }

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
      if (!claimId && !composePostId && sortedClaims[0]) navigate(`/claims/${sortedClaims[0].id}`, { replace: true });
    }).catch((failure: Error) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [claimId, composePostId, navigate]);

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

  async function loadVerification(id: string, retry = false) {
    if (selectedClaimId.current !== id || verificationRequest.current.controller || (verificationRequest.current.blocked && !retry)) return;
    const controller = new AbortController();
    const generation = roomRequest.current.generation;
    verificationRequest.current.controller = controller;
    const isCurrent = () => selectedClaimId.current === id && roomRequest.current.generation === generation
      && verificationRequest.current.controller === controller;
    setVerificationLoading(true);
    if (retry) {
      verificationRequest.current.blocked = false;
    }
    try {
      const result = await api.getClaimVerification(id, controller.signal);
      if (!isCurrent()) return;
      setVerification(result);
      setVerificationError("");
      const templates = result.participantRole === "FINDER"
        ? await api.getClaimVerificationTemplates(id, controller.signal).catch(() => null)
        : null;
      if (isCurrent()) setVerificationTemplates(templates);
    } catch (failure) {
      if (!isCurrent() || (failure instanceof Error && failure.name === "AbortError")) return;
      verificationRequest.current.blocked = true;
      setVerificationTemplates(null);
      setVerificationError(failure instanceof Error ? failure.message : "Không thể tải trạng thái xác minh");
    } finally {
      if (isCurrent()) {
        verificationRequest.current.controller = null;
        setVerificationLoading(false);
      }
    }
  }

  async function loadClaimRoom(id: string, silent = false) {
    if (selectedClaimId.current !== id) return;
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
      if (!current.canSend) {
        setMessages([]);
        setEvidence([]);
        setVerificationTemplates(null);
        updateMessageCursor(null);
        return;
      }
      const [messageResult, evidenceResult] = await Promise.all([
        api.listClaimMessages(id, undefined, controller.signal),
        api.listClaimEvidence(id, controller.signal)
      ]);
      if (!isCurrent()) return;
      setMessages((existing) => silent ? mergeMessages(existing, messageResult.items) : messageResult.items);
      if (!silent || !messageCursorRef.current) updateMessageCursor(messageResult.nextCursor);
      setEvidence(evidenceResult.items);
      setClaims((items) => {
        if (!items.some(item => item.id === id)) {
          const latest = mergeMessages([], messageResult.items).at(-1);
          return [{ ...current, conversation: { lastMessage: latest?.content ?? "", lastMessageAt: latest?.createdAt ?? current.updatedAt, unreadCount: 0 } }, ...items];
        }
        return items.map(item => item.id === id && item.conversation ? { ...item, conversation: { ...item.conversation, unreadCount: 0 } } : item);
      });

      // Verification failures must not hide the chat or erase a sent message.
      if (!silent) void loadVerification(id);
    } catch (failure) {
      if (!isCurrent() || (failure instanceof Error && failure.name === "AbortError")) return;
      setClaim(null);
      setMessages([]);
      setEvidence([]);
      setVerification(null);
      verificationRequest.current.controller?.abort();
      verificationRequest.current.controller = null;
      setVerificationLoading(false);
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
    verificationRequest.current.controller?.abort();
    verificationRequest.current = { controller: null, blocked: false };
    setClaim(null);
    setMessages([]);
    setEvidence([]);
    setVerification(null);
    setVerificationLoading(false);
    setVerificationError("");
    setVerificationTemplates(null);
    updateMessageCursor(null);
    setMessageDraft(location.state?.claimId === claimId ? location.state?.initialDraft ?? "" : "");
    setChatFile(null); setEvidenceUploadRequest(0);
    setCheckedQuestions(null);
    setQuestionsExpanded(true);
    setShowMobileConversations(false);
    pendingImage.current = null; pendingQuestion.current = null; sendInFlight.current = false;
    setReplyingToQuestion(null);
    setShowVerificationModal(false);
    setSending(false);
    setWithdrawing(false);
    setOpeningConversation(false);
    setOpeningReason("");
    setLoadingOlder(false);
    setAttachmentMenu(false);
    pendingMessage.current = null;
    pendingOpenDecision.current = null;
    pendingWithdrawal.current = null;
    if (claimId) void loadClaimRoom(claimId);
    return () => {
      roomRequest.current.generation += 1;
      selectedClaimId.current = undefined;
      roomRequest.current.controller?.abort();
      verificationRequest.current.controller?.abort();
    };
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

  // Stop automatic retries after a failure; the panel offers an explicit retry.
  useEffect(() => {
    if (!claimId || !claim?.canSend || verificationError) return;
    const timer = window.setInterval(() => {
      void loadVerification(claimId);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [claimId, claim?.canSend, verificationError]);

  useEffect(() => {
    const messagePane = messagesEndRef.current?.closest(".claim-chat-scroll");
    messagePane?.scrollTo({ top: messagePane.scrollHeight, behavior: "smooth" });
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
      if (isCurrentRoom(claimId, generation)) setError(failure instanceof Error ? failure.message : "Không thể tải tin nhắn cũ");
    } finally {
      if (isCurrentRoom(claimId, generation)) setLoadingOlder(false);
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

  useEffect(() => {
    if (!chatFile) { setChatPreview(""); return; }
    const url = URL.createObjectURL(chatFile); setChatPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [chatFile]);

  async function sendSuggestedQuestion(question: string) {
    if (!claimId || !claim?.canSend || claim.finderId !== user?.id || sendInFlight.current) return;
    const generation = roomRequest.current.generation;
    const retry = pendingQuestion.current?.question === question ? pendingQuestion.current : { question, key: crypto.randomUUID() };
    pendingQuestion.current = retry; sendInFlight.current = true; setSending(true); setError("");
    setQuestionsExpanded(false);
    questionToggle.current?.focus();
    try {
      const sent = await api.sendClaimMessage(claimId, question, retry.key);
      if (!isCurrentRoom(claimId, generation)) return;
      setMessages(current => mergeMessages(current, [sent])); pendingQuestion.current = null;
    } catch (reason) {
      if (isCurrentRoom(claimId, generation)) {
        setError(reason instanceof Error ? reason.message : "Không thể gửi câu hỏi");
        setQuestionsExpanded(true);
      }
    } finally {
      if (isCurrentRoom(claimId, generation)) { sendInFlight.current = false; setSending(false); }
    }
  }

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    const content = messageDraft.trim();
    if ((!content && !chatFile) || !claimId || sendInFlight.current) return;
    const generation = roomRequest.current.generation;
    setSending(true);
    sendInFlight.current = true;
    setError("");
    
    // Format message if replying to a question
    let finalContent = content;
    if (replyingToQuestion) {
      finalContent = `🔍 Câu hỏi xác minh:\n${replyingToQuestion}\n\n✏️ Câu trả lời: ${content}`;
    }
    
    const retry = pendingMessage.current?.content === finalContent ? pendingMessage.current : { content: finalContent, clientMessageId: crypto.randomUUID() };
    pendingMessage.current = retry;
    try {
      const imageRetry = chatFile ? pendingImage.current?.file === chatFile && pendingImage.current.content === content
        ? pendingImage.current : { file: chatFile, content, key: crypto.randomUUID() } : null;
      if (imageRetry) pendingImage.current = imageRetry;
      const sent = imageRetry ? await api.sendClaimImage(claimId, imageRetry.file, imageRetry.content, imageRetry.key)
        : await api.sendClaimMessage(claimId, finalContent, retry.clientMessageId);
      setClaims((items) => items.map((item) => item.id === claimId ? { ...item, conversation: { lastMessage: finalContent, lastMessageAt: sent.createdAt, unreadCount: 0, custodyEscalated: item.conversation?.custodyEscalated } } : item));
      if (!isCurrentRoom(claimId, generation)) return;
      setMessages((current) => mergeMessages(current, [sent]));
      if (imageRetry) {
        setChatFile(current => current === imageRetry.file ? null : current);
        if (pendingImage.current?.key === imageRetry.key) pendingImage.current = null;
        void api.listClaimEvidence(claimId).then(result => { if (isCurrentRoom(claimId, generation)) setEvidence(result.items); }).catch(() => {});
      }
      setMessageDraft(current => current === content || current.trim() === content ? "" : current);
      setReplyingToQuestion(current => current === replyingToQuestion ? null : current);
      if (pendingMessage.current?.clientMessageId === retry.clientMessageId) pendingMessage.current = null;
    } catch (failure) {
      if (isCurrentRoom(claimId, generation)) setError(failure instanceof Error ? failure.message : "Không thể gửi tin nhắn");
    } finally { if (isCurrentRoom(claimId, generation)) { sendInFlight.current = false; setSending(false); } }
  }

  async function withdraw() {
    if (!claimId) return;
    const generation = roomRequest.current.generation;
    setWithdrawing(true);
    setError("");
    try {
      pendingWithdrawal.current ??= crypto.randomUUID();
      await api.withdrawClaim(claimId, pendingWithdrawal.current);
      if (!isCurrentRoom(claimId, generation)) return;
      pendingWithdrawal.current = null;
      await loadClaimRoom(claimId);
    } catch (failure) {
      if (isCurrentRoom(claimId, generation)) setError(failure instanceof Error ? failure.message : "Không thể đóng claim");
    } finally { if (isCurrentRoom(claimId, generation)) setWithdrawing(false); }
  }

  function applyClaimUpdate(updated: ClaimRecord) {
    if (selectedClaimId.current === updated.id) setClaim(updated);
    setClaims((current) => current.map((item) => item.id === updated.id ? {
      ...item,
      ...updated,
      conversation: updated.conversation ?? item.conversation
    } : item));
  }

  async function decideConversation(decision: "ACCEPT" | "DECLINE" | "REQUEST_MORE_INFO") {
    if (!claimId || !openingReason.trim()) return;
    const generation = roomRequest.current.generation;
    setOpeningConversation(true);
    setError("");
    const retry = pendingOpenDecision.current?.decision === decision ? pendingOpenDecision.current : { decision, key: crypto.randomUUID() };
    pendingOpenDecision.current = retry;
    try {
      const updated = await api.decideClaim(claimId, decision, openingReason.trim(), retry.key);
      if (!isCurrentRoom(claimId, generation)) return;
      pendingOpenDecision.current = null;
      setOpeningReason("");
      applyClaimUpdate(updated);
      await loadClaimRoom(claimId);
    } catch (failure) {
      if (isCurrentRoom(claimId, generation)) setError(failure instanceof Error ? failure.message : "Không thể lưu quyết định");
    } finally { if (isCurrentRoom(claimId, generation)) setOpeningConversation(false); }
  }

  function jumpTo(sectionId: string) {
    setAttachmentMenu(false);
    setEvidenceUploadRequest(value => value + 1);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const sensitiveDocument = /thẻ|giấy|cccd|cmnd|bằng lái|ngân hàng/i.test(claim?.item?.categoryName ?? "");
  // Only LOST rooms have contactPhoto; required=false identifies the target post's owner.
  const showLostOwnerSafetyNote = claim?.contactPhoto?.required === false;
  const displayedGeneration = roomRequest.current.generation;
  const suggestedQuestions: string[] = checkedQuestions && checkedQuestions.claimId === claimId ? checkedQuestions.questions
    : claim && location.state?.claimId === claim.id && location.state?.contactQuestions?.length
      ? location.state.contactQuestions : [];

  const mobileConversationToggle = (claimId || composePostId) && <button type="button" className="mobile-conversation-toggle" aria-expanded={showMobileConversations} onClick={() => setShowMobileConversations(value => !value)}><MessageCircle /><span>Cuộc trò chuyện ({claims.length})</span></button>;
  const pageClass = `claims-page ${(claimId || composePostId) && !showMobileConversations ? "claims-page--focused" : ""}`;
  if (!claimId && composePostId) return <main className={pageClass}>
    {mobileConversationToggle}
    {error && <div className="claim-alert"><AlertTriangle /> {error}</div>}
    <section className="claims-layout">
      <aside className="claims-sidebar">
        <header><span>CONVERSATION</span><strong>{claims.length}</strong></header>
        <label className="conversation-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm cuộc trò chuyện..." /></label>
        <div className="conversation-filters" role="tablist">{(["ALL", "UNREAD", "ACTIVE"] as ConversationFilter[]).map((value) => <button type="button" role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value === "ALL" ? "Tất cả" : value === "UNREAD" ? "Chưa đọc" : "Đang xử lý"}</button>)}</div>
        <ClaimList claims={visibleClaims} userId={user?.id} onSelect={(id) => navigate(`/claims/${id}`)} />
        {claimHasMore && <button className="claim-load-older claim-load-claims" type="button" disabled={loadingMoreClaims} onClick={() => void loadMoreClaims()}><RefreshCw className={loadingMoreClaims ? "is-spinning" : ""} /> {loadingMoreClaims ? "Đang tải..." : "Xem thêm"}</button>}
      </aside>
      <DirectMessageDraft key={`${composePostId}:${searchParams.get("sourceFoundPostId") ?? ""}`} postId={composePostId} sourceFoundPostId={searchParams.get("sourceFoundPostId") ?? undefined} viewer={user ?? undefined} />
    </section>
  </main>;

  return <main className={pageClass}>
    {mobileConversationToggle}
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
                <div className="claim-header-actions"><Link to={`/reports?targetType=CLAIM&targetId=${claim.id}`} title="Báo cáo claim"><FileWarning /></Link>{claim.claimantId === user?.id && ["PENDING", "CONVERSATION_OPEN", "NEED_MORE_INFO"].includes(claim.status) && <button type="button" className="claim-close-button" disabled={withdrawing} onClick={() => void withdraw()} title="Đóng claim"><X /></button>}</div>
                {showLostOwnerSafetyNote && <aside className="claim-lost-safety-note" aria-label="Lưu ý tránh lừa đảo">
                  <AlertTriangle aria-hidden="true" />
                  <div>
                    <strong>Hãy xin ảnh vật phẩm trước khi hẹn nhận đồ</strong>
                    <p>Yêu cầu người liên hệ gửi ảnh hiện tại và đối chiếu đặc điểm riêng của món đồ. Không chuyển tiền hoặc cung cấp thông tin nhạy cảm; ảnh tương đồng chưa chứng minh họ đang giữ đồ.</p>
                  </div>
                </aside>}
                <div className="claim-chat-review">
                  <ClaimVerificationPanel key={`review:${claim.id}`} claim={claim} verification={verification} loading={verificationLoading} loadError={verificationError} onRetry={() => void loadVerification(claim.id, true)} onVerificationChange={value => { if (isCurrentRoom(claim.id, displayedGeneration)) setVerification(value); }} onClaimChange={value => { if (isCurrentRoom(claim.id, displayedGeneration)) applyClaimUpdate(value); }} onDecisionMessage={(message) => { if (isCurrentRoom(claim.id, displayedGeneration)) setMessages((current) => mergeMessages(current, [message])); }} />
                </div>
                {claim.canSend && claim.finderId === user?.id && suggestedQuestions.length > 0 && <section className="claim-question-suggestions" aria-label="Câu hỏi đối chiếu vật phẩm">
                  <button ref={questionToggle} type="button" className="claim-question-toggle" aria-expanded={questionsExpanded} aria-controls="claim-question-options" title={questionsExpanded ? "Thu gọn câu hỏi" : "Mở câu hỏi gợi ý"} onClick={() => setQuestionsExpanded(value => !value)}><MessageCircle aria-hidden="true" /><span>Câu hỏi gợi ý ({Math.min(3, suggestedQuestions.length)})</span>{questionsExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</button>
                  <div id="claim-question-options" className="claim-question-options" role="group" aria-label="Câu hỏi từ ảnh" hidden={!questionsExpanded}>
                    {suggestedQuestions.slice(0, 3).map(question => <button type="button" key={question} disabled={sending} onClick={() => void sendSuggestedQuestion(question)}><MessageCircle aria-hidden="true" /><span>{question}</span><Send aria-hidden="true" /></button>)}
                  </div>
                </section>}
              </header>

              {!claim.canSend ? claim.contactPhoto?.required && !claim.contactPhoto.approved ? <div className="claim-chat-scroll"><LostContactPhotoGate key={claim.id} postId={claim.contactPhoto.postId} onReady={(checkId, questions) => {
                if (checkId) void api.attachContactPhoto(claim.id,checkId).then(() => {
                  if (isCurrentRoom(claim.id, displayedGeneration)) {
                    if (questions?.length) setCheckedQuestions({ claimId: claim.id, questions });
                    return loadClaimRoom(claim.id);
                  }
                }).catch(reason => {
                  if (isCurrentRoom(claim.id, displayedGeneration)) setError(reason instanceof Error ? reason.message : "Không thể xác nhận ảnh liên hệ");
                });
              }} /></div> : claim.finderId === user?.id && claim.status === "PENDING" ? <section className="claim-open-decision">
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
                  {chatFile && messageDraft.trim().length > 255 && <p className="field-error" role="alert">Chú thích ảnh không quá 255 ký tự.</p>}
                  {chatFile && <div className="claim-image-draft">{chatPreview && <img src={chatPreview} alt="Ảnh chờ gửi" />}<span>{chatFile.name}</span><button type="button" title="Bỏ ảnh chờ gửi" disabled={sending} onClick={() => setChatFile(null)}><X /></button></div>}
                  <input ref={chatFileInput} hidden type="file" aria-label="Ảnh gửi trong chat" accept="image/jpeg,image/png,image/webp" onChange={event => {
                    const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Chọn ảnh JPEG, PNG hoặc WebP không quá 10 MB."); return; }
                    setChatFile(file); setReplyingToQuestion(null); setError("");
                  }} />
                  {replyingToQuestion && <div className="claim-reply-tag"><span>Đang trả lời: {replyingToQuestion}</span><button type="button" onClick={cancelReplyQuestion} title="Hủy trả lời"><X /></button></div>}
                  <div className="input-row">
                    <div className="message-attachment"><button type="button" disabled={sending} aria-expanded={attachmentMenu} onClick={() => setAttachmentMenu((value) => !value)} title="Thêm"><Plus /></button>{attachmentMenu && <div className="message-attachment-menu"><button type="button" onClick={() => { setAttachmentMenu(false); chatFileInput.current?.click(); }}><Image /> Ảnh</button><button type="button" onClick={() => jumpTo("private-evidence")}><FileCheck2 /> Evidence</button></div>}</div>
                    <textarea aria-label="Tin nhắn riêng" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={chatFile ? 255 : 5000} placeholder={replyingToQuestion ? "Nhập câu trả lời..." : "Nhập tin nhắn hoặc câu hỏi..."} />
                    <div className="message-actions">
                      {verification?.participantRole === "FINDER" && claim.canSend && <button type="button" className="verification-button" onClick={() => setShowVerificationModal(true)} title="Gửi câu hỏi xác minh"><ShieldCheck /></button>}
                      <button type="submit" disabled={sending || (!messageDraft.trim() && !chatFile) || Boolean(chatFile && messageDraft.trim().length > 255)} title="Gửi tin nhắn"><Send /></button>
                    </div>
                  </div>
                </form>
                {showVerificationModal && verification && verificationTemplates && <ClaimVerificationQuestionModal key={claim.id} claim={claim} verification={verification} templates={verificationTemplates} onClose={() => { if (isCurrentRoom(claim.id, displayedGeneration)) setShowVerificationModal(false); }} onSuccess={value => { if (isCurrentRoom(claim.id, displayedGeneration)) setVerification(value); }} />}
              </>}
            </section>

            <aside className="claim-inspector">
              <ClaimItemPanel claim={claim} />
              <ClaimEvidencePanel key={`evidence:${claim.id}`} claimId={claim.id} evidence={evidence} sensitiveDocument={sensitiveDocument} canUpload={Boolean(claim.canSend)} uploadRequest={evidenceUploadRequest} onEvidenceAdded={(item) => { if (isCurrentRoom(claim.id, displayedGeneration)) setEvidence((current) => current.some(value => value.id === item.id) ? current : [...current, item]); }} />
            </aside>
          </> : <section className="claim-workspace-state"><AlertTriangle /><h2>Không mở được conversation</h2></section>}
    </section>}
  </main>;
}
