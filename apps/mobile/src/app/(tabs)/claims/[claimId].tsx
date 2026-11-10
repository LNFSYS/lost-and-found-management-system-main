import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { SecureImage } from "@/components/secure-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { claimRoleLabels } from "@/constants/labels";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import {
  claimService,
  createRequestUuid,
  getApiErrorMessage,
  postService,
  type ClaimDecision,
  type ClaimEvidence,
  type ClaimMessage,
  type ClaimRecord,
  type ClaimVerificationState,
  type MobileImageFile,
  type VerificationTemplatesResponse,
} from "@/services/api";

type Panel = "chat" | "verify" | "item" | "evidence";
type MessageCursor = { before: string; beforeId: string };
type DecisionDraft = { action: ClaimDecision; label: string; icon: "calendar-check-outline" | "comment-question-outline" | "close-circle-outline" | "warehouse" };

const decisions: DecisionDraft[] = [
  { action: "VERIFY_FOR_MEETUP", label: "Đề xuất gặp mặt", icon: "calendar-check-outline" },
  { action: "REQUEST_MORE_INFO", label: "Yêu cầu bổ sung", icon: "comment-question-outline" },
  { action: "DECLINE", label: "Từ chối yêu cầu", icon: "close-circle-outline" },
  { action: "ESCALATE_TO_CUSTODY", label: "Chuyển vật phẩm vào kho trường", icon: "warehouse" },
];

function messageTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function sortMessages(messages: ClaimMessage[]) {
  const unique = new Map<string, ClaimMessage>();
  for (const message of messages) {
    if (message.clientMessageId) unique.delete(`optimistic:${message.clientMessageId}`);
    unique.set(message.id, message);
  }
  return [...unique.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

function assetToFile(asset: ImagePicker.ImagePickerAsset): MobileImageFile {
  const extension = asset.mimeType === "image/png" ? "png" : asset.mimeType === "image/webp" ? "webp" : "jpg";
  return { uri: asset.uri, name: asset.fileName || `claim-evidence-${Date.now()}.${extension}`, type: asset.mimeType || "image/jpeg", size: asset.fileSize };
}

function PersonBubble({ message, own, onOpenImage }: { message: ClaimMessage; own: boolean; onOpenImage: (url: string) => void }) {
  const system = message.messageType === "SYSTEM" || message.content?.startsWith("⚖️ ");
  if (system) return <View accessibilityRole="text" style={styles.systemMessage}><MaterialCommunityIcons name="scale-balance" size={17} color={colors.warning} /><Text style={styles.systemText}>{message.content?.replace(/^⚖️\s*/, "") || "Cập nhật quy trình xác minh"}</Text><Text style={styles.systemTime}>{messageTime(message.createdAt)}</Text></View>;
  return (
    <View style={[styles.messageRow, own && styles.messageRowOwn]}>
      <View style={[styles.messageBubble, own ? styles.messageOwn : styles.messageOther]}>
        {!own ? <Text style={styles.senderName}>{message.sender.fullName}</Text> : null}
        {message.messageType === "IMAGE" && message.mediaUrl ? <Pressable accessibilityRole="imagebutton" accessibilityLabel="Mở ảnh trong tin nhắn" onPress={() => onOpenImage(message.mediaUrl!)}><SecureImage url={message.mediaUrl} style={styles.chatImage} accessibilityLabel="Ảnh bằng chứng trong cuộc chat" /></Pressable> : null}
        {message.content ? <Text style={[styles.messageText, own && styles.messageTextOwn]}>{message.content}</Text> : null}
        <View style={styles.messageMeta}><Text style={[styles.messageTime, own && styles.messageTimeOwn]}>{messageTime(message.createdAt)}</Text>{message.pending ? <Text style={styles.pendingText}>Đang gửi…</Text> : null}</View>
      </View>
    </View>
  );
}

export default function ClaimDetailScreen() {
  const { claimId } = useLocalSearchParams<{ claimId: string }>();
  const { user } = useAuth();
  const [claim, setClaim] = useState<ClaimRecord | null>(null);
  const [messages, setMessages] = useState<ClaimMessage[]>([]);
  const [cursor, setCursor] = useState<MessageCursor | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [evidence, setEvidence] = useState<ClaimEvidence[]>([]);
  const [templates, setTemplates] = useState<VerificationTemplatesResponse | null>(null);
  const [verification, setVerification] = useState<ClaimVerificationState | null>(null);
  const [panel, setPanel] = useState<Panel>("chat");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [draft, setDraft] = useState("");
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedPromptKey, setSelectedPromptKey] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [decision, setDecision] = useState<ClaimDecision | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionPoints, setDecisionPoints] = useState<{ id: string; name: string; address: string | null }[]>([]);
  const [handoverPointId, setHandoverPointId] = useState("");
  const [intakeAt, setIntakeAt] = useState<Date | null>(null);
  const [defaultIntakeDate] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [pickerMode, setPickerMode] = useState<"date" | "time" | "datetime" | null>(null);
  const [imageToView, setImageToView] = useState<string | null>(null);
  const messagesScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const initialLoad = useRef(true);
  const messageRetry = useRef<{ text: string; key: string } | null>(null);
  const decisionRetry = useRef<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!claimId) return;
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      const claimResult = await claimService.get(claimId);
      setClaim(claimResult);
      const results = await Promise.allSettled([
        claimService.listMessages(claimId),
        claimService.listEvidence(claimId),
        claimService.getVerification(claimId),
        claimService.getVerificationTemplates(claimId),
      ]);
      const [messageResult, evidenceResult, verificationResult, templateResult] = results;
      if (messageResult.status === "fulfilled") {
        setMessages(messageResult.value.items);
        setCursor(messageResult.value.nextCursor);
        setHasOlder(messageResult.value.hasMore);
      } else if (!refresh) {
        setError(getApiErrorMessage(messageResult.reason));
      }
      if (evidenceResult.status === "fulfilled") setEvidence(evidenceResult.value.items);
      if (verificationResult.status === "fulfilled") setVerification(verificationResult.value);
      if (templateResult.status === "fulfilled") setTemplates(templateResult.value);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [claimId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!claimId) return;
    const timer = setInterval(() => {
      void claimService.listMessages(claimId).then((result) => setMessages((current) => sortMessages([...current, ...result.items]))).catch(() => undefined);
      void claimService.get(claimId).then(setClaim).catch(() => undefined);
    }, 12000);
    return () => clearInterval(timer);
  }, [claimId]);

  useEffect(() => {
    if (!initialLoad.current && messages.length) messagesScroll.current?.scrollToEnd({ animated: true });
    if (messages.length) initialLoad.current = false;
  }, [messages.length]);

  const role = verification?.participantRole ?? (claim?.finderId === user?.id ? "FINDER" : "CLAIMANT");
  const activeQuestion = useMemo(() => verification?.questions.find((question) => question.status === "APPROVED" && !question.answer) ?? null, [verification]);
  const canSend = Boolean(claim && claim.canSend !== false && !["REJECTED", "CANCELLED"].includes(claim.status));
  const appointmentEligible = Boolean(verification?.appointmentEligible || claim?.appointmentEligible);

  const loadOlder = async () => {
    if (!claimId || !cursor || loadingOlder) return;
    setLoadingOlder(true);
    setError(null);
    try {
      const result = await claimService.listMessages(claimId, cursor);
      setMessages((current) => sortMessages([...result.items, ...current]));
      setCursor(result.nextCursor);
      setHasOlder(result.hasMore);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoadingOlder(false);
    }
  };

  const sendText = async () => {
    const content = draft.trim();
    if (!claimId || !content || !canSend || sending) return;
    const retry = messageRetry.current?.text === content ? messageRetry.current : { text: content, key: createRequestUuid() };
    messageRetry.current = retry;
    setSending(true);
    setError(null);
    setDraft("");
    const optimistic: ClaimMessage = { id: `optimistic:${retry.key}`, roomId: claim?.roomId ?? "", sender: { id: user?.id ?? "", fullName: user?.fullName ?? "Bạn" }, clientMessageId: retry.key, content, messageType: "TEXT", isRead: false, readAt: null, createdAt: new Date().toISOString(), pending: true };
    setMessages((current) => sortMessages([...current, optimistic]));
    try {
      const sent = await claimService.sendMessage(claimId, content, retry.key);
      messageRetry.current = null;
      setMessages((current) => sortMessages([...current, sent]));
    } catch (sendError) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setDraft(content);
      setError(getApiErrorMessage(sendError));
    } finally {
      setSending(false);
    }
  };

  const pickChatImage = async (source: "camera" | "library") => {
    if (!claimId || !canSend || sending) return;
    setError(null);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error("Cần cấp quyền camera để chụp ảnh bằng chứng.");
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error("Cần cấp quyền thư viện ảnh để chọn ảnh bằng chứng.");
      }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) throw new Error("Ảnh cần nhỏ hơn hoặc bằng 10 MB.");
      setSending(true);
      const sent = await claimService.sendImage(claimId, assetToFile(asset), draft.trim());
      setMessages((current) => sortMessages([...current, sent]));
      setDraft("");
    } catch (sendError) {
      setError(getApiErrorMessage(sendError));
    } finally {
      setSending(false);
    }
  };

  const uploadEvidence = async (source: "camera" | "library") => {
    if (!claimId || uploadingEvidence) return;
    setError(null);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error("Cần cấp quyền camera để chụp bằng chứng.");
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error("Cần cấp quyền thư viện ảnh để chọn bằng chứng.");
      }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) throw new Error("Ảnh cần nhỏ hơn hoặc bằng 10 MB.");
      setUploadingEvidence(true);
      const created = await claimService.uploadEvidence(claimId, assetToFile(asset), evidenceDescription);
      setEvidence((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setEvidenceDescription("");
      setNotice("Đã tải bằng chứng riêng tư lên cuộc đối chiếu.");
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError));
    } finally {
      setUploadingEvidence(false);
    }
  };

  const sendQuestion = async () => {
    if (!claimId || !templates || !selectedPromptKey || selectedPrompt.trim().length < 10) return;
    setSending(true);
    setError(null);
    try {
      const updated = await claimService.sendVerificationQuestion(claimId, {
        templateId: templates.template.id,
        templateVersion: templates.template.version,
        promptKey: selectedPromptKey,
        prompt: selectedPrompt.trim(),
        idempotencyKey: createRequestUuid(),
      });
      setVerification(updated);
      setSelectedPromptKey(null);
      setSelectedPrompt("");
      setNotice("Đã gửi câu hỏi xác minh riêng cho người nhận.");
      void claimService.listMessages(claimId).then((result) => setMessages((current) => sortMessages([...current, ...result.items]))).catch(() => undefined);
    } catch (questionError) {
      setError(getApiErrorMessage(questionError));
    } finally {
      setSending(false);
    }
  };

  const submitAnswer = async () => {
    if (!claimId || !activeQuestion || !answer.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      setVerification(await claimService.answerVerificationQuestion(claimId, activeQuestion.id, answer.trim(), createRequestUuid()));
      setAnswer("");
      setNotice("Đã gửi câu trả lời riêng cho người nhặt.");
      void claimService.listMessages(claimId).then((result) => setMessages((current) => sortMessages([...current, ...result.items]))).catch(() => undefined);
    } catch (answerError) {
      setError(getApiErrorMessage(answerError));
    } finally {
      setSending(false);
    }
  };

  const openDecision = async (next: ClaimDecision) => {
    setDecision(next);
    setDecisionReason("");
    setError(null);
    if (next === "ESCALATE_TO_CUSTODY") {
      try {
        const result = await postService.listPublicHandoverPoints();
        setDecisionPoints(result.handoverPoints.map((point) => ({ ...point, address: point.address ?? null })));
        setHandoverPointId(result.handoverPoints[0]?.id ?? "");
      } catch (pointError) {
        setError(getApiErrorMessage(pointError));
      }
    }
  };

  const onDecisionTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "dismissed") { setPickerMode(null); return; }
    if (!selected) return;
    const base = intakeAt ?? new Date(Date.now() + 60 * 60 * 1000);
    if (Platform.OS === "android" && pickerMode === "date") {
      const combined = new Date(selected); combined.setHours(base.getHours(), base.getMinutes(), 0, 0); setIntakeAt(combined); setPickerMode("time"); return;
    }
    if (Platform.OS === "android" && pickerMode === "time") {
      const combined = new Date(base); combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0); setIntakeAt(combined); setPickerMode(null); return;
    }
    setIntakeAt(selected);
  };

  const submitDecision = async () => {
    if (!claimId || !decision || decisionReason.trim().length < 3 || sending) return;
    if (decision === "VERIFY_FOR_MEETUP" && !verification?.policy.readyForDecision) { setError("Cần hoàn tất số câu trả lời tối thiểu trước khi đề xuất gặp mặt."); return; }
    if (decision === "ESCALATE_TO_CUSTODY" && (!handoverPointId || !intakeAt)) { setError("Chọn quầy tiếp nhận và thời gian bàn giao dự kiến."); return; }
    setSending(true);
    setError(null);
    decisionRetry.current ??= createRequestUuid();
    try {
      const result = await claimService.decideVerification(claimId, {
        decision,
        reason: decisionReason.trim(),
        handoverPointId: decision === "ESCALATE_TO_CUSTODY" ? handoverPointId : undefined,
        requestedIntakeAt: decision === "ESCALATE_TO_CUSTODY" ? intakeAt?.toISOString() : undefined,
        idempotencyKey: decisionRetry.current,
      });
      decisionRetry.current = null;
      setClaim(result.claim);
      setVerification(result.verification);
      if (result.message) setMessages((current) => sortMessages([...current, result.message! ]));
      setDecision(null);
      setNotice("Quyết định xác minh đã được ghi nhận.");
    } catch (decisionError) {
      setError(getApiErrorMessage(decisionError));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><LoadingSpinner label="Đang mở cuộc trao đổi riêng…" /></SafeAreaView>;
  if (!claim) return <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}><View style={styles.missing}><ErrorBanner message={error ?? "Không tìm thấy yêu cầu đối chiếu."} onRetry={() => void load()} /><Button title="Quay lại danh sách" variant="secondary" onPress={() => router.replace("/claims" as never)} /></View></SafeAreaView>;

  const item = claim.item;
  const openAppointment = () => router.push(`/appointments?claimId=${encodeURIComponent(claim.id)}` as never);
  const claimName = claim.claimantId === user?.id ? claim.finder.fullName : claim.claimant.fullName;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại danh sách claims" onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.ink} /></Pressable>
        <View style={styles.topBarCopy}><Text accessibilityRole="header" style={styles.topTitle}>{claimName}</Text><Text numberOfLines={1} style={styles.topSubtitle}>{item?.title ?? claim.posts.found.title}</Text></View>
        <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{claimRoleLabels[role]}</Text></View>
      </View>
      <ScrollView style={styles.panelTabScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.panelTabs}>
        {(["chat", "verify", "item", "evidence"] as Panel[]).map((key) => {
          const info = panelInfo[key]; const selected = panel === key;
          return <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setPanel(key)} style={[styles.panelTab, selected && styles.panelTabSelected]}><MaterialCommunityIcons name={info.icon} size={16} color={selected ? colors.surface : colors.muted} /><Text style={[styles.panelTabText, selected && styles.panelTabTextSelected]}>{info.label}</Text>{key === "evidence" && evidence.length > 0 ? <Text style={[styles.panelTabCount, selected && styles.panelTabCountSelected]}>{evidence.length}</Text> : null}</Pressable>;
        })}
      </ScrollView>
      {error ? <View style={styles.inlineError}><ErrorBanner message={error} onRetry={() => void load(true)} /></View> : null}
      {notice ? <View style={styles.inlineNotice}><MaterialCommunityIcons name="check-circle-outline" size={17} color={colors.success} /><Text style={styles.noticeText}>{notice}</Text></View> : null}

      {panel === "chat" ? <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <View style={styles.itemStrip}>
          <View style={styles.itemGlyph}><MaterialCommunityIcons name="package-variant-closed" size={20} color={colors.primary} /></View>
          <View style={styles.itemStripCopy}><Text style={styles.itemStripTitle} numberOfLines={1}>{item?.title ?? claim.posts.found.title}</Text><Text style={styles.itemStripLocation} numberOfLines={1}>{item?.locationLabel ?? "Vị trí vật phẩm được giữ riêng tư"}</Text></View>
          <Pressable accessibilityRole="button" onPress={() => setPanel("item")} style={styles.itemMore}><MaterialCommunityIcons name="information-outline" size={20} color={colors.primary} /></Pressable>
        </View>
        {appointmentEligible ? <Pressable accessibilityRole="button" onPress={openAppointment} style={styles.appointmentCta}><MaterialCommunityIcons name="calendar-plus" size={18} color={colors.primary} /><Text style={styles.appointmentCtaText}>Đủ điều kiện · Đề xuất lịch bàn giao</Text><MaterialCommunityIcons name="chevron-right" size={19} color={colors.primary} /></Pressable> : null}
        <ScrollView ref={messagesScroll} style={styles.messageList} contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled">
          {hasOlder ? <Pressable accessibilityRole="button" disabled={loadingOlder} onPress={() => void loadOlder()} style={styles.olderButton}>{loadingOlder ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialCommunityIcons name="history" size={16} color={colors.primary} />}<Text style={styles.olderText}>Tải tin nhắn cũ hơn</Text></Pressable> : null}
          {messages.length ? messages.map((message) => <PersonBubble key={message.id} message={message} own={message.sender.id === user?.id} onOpenImage={setImageToView} />) : <View style={styles.chatEmpty}><MaterialCommunityIcons name="lock-outline" size={25} color={colors.muted} /><Text style={styles.chatEmptyTitle}>Cuộc trao đổi riêng tư</Text><Text style={styles.chatEmptyText}>Chỉ hai bên trong yêu cầu này có thể xem tin nhắn và bằng chứng.</Text></View>}
        </ScrollView>
        <View style={styles.composer}>
          {canSend ? <>
            <Input label="Tin nhắn riêng" value={draft} onChangeText={setDraft} multiline maxLength={5000} placeholder="Nhập nội dung xác minh…" style={styles.messageInput} />
            <View style={styles.composerActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Chụp và gửi ảnh" disabled={sending} onPress={() => void pickChatImage("camera")} style={styles.attachButton}><MaterialCommunityIcons name="camera-outline" size={22} color={colors.primary} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Chọn ảnh bằng chứng" disabled={sending} onPress={() => void pickChatImage("library")} style={styles.attachButton}><MaterialCommunityIcons name="image-plus-outline" size={22} color={colors.primary} /></Pressable>
              <Button title={sending ? "Đang gửi" : "Gửi"} loading={sending} disabled={!draft.trim()} onPress={() => void sendText()} style={styles.sendButton} />
            </View>
          </> : <View style={styles.closedNote}><MaterialCommunityIcons name="lock-outline" size={17} color={colors.muted} /><Text style={styles.closedText}>Cuộc trao đổi này đã đóng hoặc đang chờ người nhặt chấp thuận.</Text></View>}
        </View>
      </KeyboardAvoidingView> : null}

      {panel === "verify" ? <ScrollView style={styles.flex} contentContainerStyle={styles.panelContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        <Card style={styles.verificationCard}>
          <View style={styles.cardHeader}><View style={styles.cardHeaderIcon}><MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.primary} /></View><View style={styles.claimCopy}><Text style={styles.cardTitle}>Xác minh quyền sở hữu</Text><Text style={styles.cardSubtitle}>{verification ? `Đã trả lời ${verification.policy.answeredCount}/${verification.policy.minimumAnswers} câu hỏi tối thiểu` : "Đang tải trạng thái xác minh"}</Text></View></View>
          {verification ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, verification.policy.minimumAnswers ? (verification.policy.answeredCount / verification.policy.minimumAnswers) * 100 : 0)}%` }]} /></View> : <ActivityIndicator color={colors.primary} />}
          {verification?.roomEscalation ? <View style={styles.infoBox}><MaterialCommunityIcons name="warehouse" size={18} color={colors.success} /><Text style={[styles.infoText, { color: colors.success }]}>Vật phẩm đã được chuyển sang quy trình tiếp nhận tại kho trường.</Text></View> : null}
        </Card>
        {verification?.questions.map((question) => <Card key={question.id} style={styles.questionCard}>
          <View style={styles.questionTop}><MaterialCommunityIcons name="help-circle-outline" size={19} color={colors.primary} /><Text style={styles.questionType}>{question.privacyLevel === "HIGHLY_PRIVATE" ? "RIÊNG TƯ CAO" : "CÂU HỎI RIÊNG"}</Text></View>
          <Text style={styles.questionText}>{question.prompt}</Text>
          {question.answer ? <View style={styles.answerState}><MaterialCommunityIcons name="check-circle-outline" size={17} color={colors.success} /><Text style={styles.answerStateText}>{role === "FINDER" ? "Người nhận đã gửi câu trả lời." : "Đã gửi câu trả lời riêng."}</Text></View> : role === "FINDER" ? <Text style={styles.waitingText}>Đang chờ người nhận trả lời.</Text> : activeQuestion?.id === question.id ? <View style={styles.answerForm}><Input label="Câu trả lời riêng" value={answer} onChangeText={setAnswer} maxLength={500} placeholder="Nhập câu trả lời…" /><Button title="Gửi câu trả lời" onPress={() => void submitAnswer()} loading={sending} disabled={!answer.trim()} /></View> : null}
        </Card>)}
        {role === "FINDER" && verification && !verification.roomEscalation && (verification.status === "CONVERSATION_OPEN" || verification.status === "NEED_MORE_INFO") ? <Card style={styles.verificationCard}>
          <Text style={styles.cardTitle}>Câu hỏi theo mẫu</Text><Text style={styles.cardSubtitle}>{templates ? `${templates.category} · tối thiểu ${templates.template.minimumAnswers} câu trả lời` : "Không tải được bộ câu hỏi mẫu."}</Text>
          {selectedPromptKey ? <View style={styles.answerForm}><Text style={styles.questionText}>{selectedPrompt}</Text><Button title="Gửi câu hỏi" onPress={() => void sendQuestion()} loading={sending} /><Button title="Chọn câu khác" variant="ghost" onPress={() => { setSelectedPromptKey(null); setSelectedPrompt(""); }} /></View> : <View style={styles.promptList}>{templates?.template.prompts.map((prompt) => <Pressable key={prompt.key} accessibilityRole="button" onPress={() => { setSelectedPromptKey(prompt.key); setSelectedPrompt(prompt.prompt); }} style={styles.promptButton}><MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.primary} /><Text style={styles.promptText}>{prompt.prompt}</Text></Pressable>)}{templates?.template.customFollowUpAllowed ? <Pressable accessibilityRole="button" onPress={() => { setSelectedPromptKey("custom-follow-up"); setSelectedPrompt(""); }} style={styles.promptButton}><MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} /><Text style={styles.promptText}>Tạo câu hỏi bổ sung</Text></Pressable> : null}</View>}
          {selectedPromptKey === "custom-follow-up" ? <View style={styles.answerForm}><Input label="Câu hỏi bổ sung (10–500 ký tự)" value={selectedPrompt} onChangeText={setSelectedPrompt} multiline maxLength={500} /><Button title="Gửi câu hỏi" onPress={() => void sendQuestion()} loading={sending} disabled={selectedPrompt.trim().length < 10} /></View> : null}
          {verification.policy.matchedCount !== undefined ? <Text style={styles.cardSubtitle}>Câu trả lời khớp: {verification.policy.matchedCount}/{verification.policy.answeredCount}</Text> : null}
        </Card> : null}
        {role === "FINDER" && verification && !verification.roomEscalation && (verification.status === "CONVERSATION_OPEN" || verification.status === "NEED_MORE_INFO") ? <Card style={styles.decisionCard}>
          <Text style={styles.cardTitle}>Quyết định của người nhặt</Text><Text style={styles.cardSubtitle}>Chọn bước tiếp theo dựa trên câu trả lời và bằng chứng đã trao đổi.</Text>
          {decisions.map((option) => <Pressable key={option.action} accessibilityRole="button" accessibilityState={{ disabled: option.action === "VERIFY_FOR_MEETUP" && !verification.policy.readyForDecision }} disabled={option.action === "VERIFY_FOR_MEETUP" && !verification.policy.readyForDecision} onPress={() => void openDecision(option.action)} style={[styles.decisionOption, option.action === "VERIFY_FOR_MEETUP" && !verification.policy.readyForDecision && styles.disabledOption]}><View style={styles.decisionIcon}><MaterialCommunityIcons name={option.icon} size={19} color={option.action === "DECLINE" ? colors.danger : colors.primary} /></View><Text style={[styles.decisionText, option.action === "DECLINE" && { color: colors.danger }]}>{option.label}</Text><MaterialCommunityIcons name="chevron-right" size={19} color={colors.muted} /></Pressable>)}
          {!verification.policy.readyForDecision ? <Text style={styles.waitingText}>Để đề xuất gặp mặt, cần đủ câu trả lời tối thiểu hoặc điều kiện xác minh ảnh.</Text> : null}
        </Card> : null}
        {role === "CLAIMANT" && verification && !activeQuestion ? <Card style={styles.infoBox}><MaterialCommunityIcons name="clock-outline" size={18} color={colors.warning} /><Text style={styles.infoText}>Đang chờ người nhặt gửi câu hỏi hoặc ra quyết định xác minh.</Text></Card> : null}
        {appointmentEligible ? <Button title="Đề xuất lịch gặp tại khuôn viên trường" onPress={openAppointment} /> : null}
      </ScrollView> : null}

      {panel === "item" ? <ScrollView style={styles.flex} contentContainerStyle={styles.panelContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
        <Card style={styles.itemCard}>
          <View style={styles.itemPanelEyebrow}><MaterialCommunityIcons name="package-variant-closed" size={18} color={colors.primary} /><Text style={styles.eyebrow}>VẬT PHẨM ĐANG ĐỐI CHIẾU</Text></View>
          {item?.imageUrl ? <SecureImage url={item.imageUrl} style={styles.itemImage} accessibilityLabel={`Ảnh ${item.title}`} /> : <View style={[styles.itemImage, styles.itemImagePlaceholder]}><MaterialCommunityIcons name="image-off-outline" size={34} color={colors.muted} /><Text style={styles.muted}>Chưa có ảnh công khai</Text></View>}
          <Text style={styles.itemPanelTitle}>{item?.title ?? claim.posts.found.title}</Text>
          <View style={styles.detailRow}><MaterialCommunityIcons name="tag-outline" size={18} color={colors.muted} /><Text style={styles.detailLabel}>Danh mục</Text><Text style={styles.detailValue}>{item?.categoryName ?? "Chưa cập nhật"}</Text></View>
          <View style={styles.detailRow}><MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.muted} /><Text style={styles.detailLabel}>Vị trí</Text><Text style={styles.detailValue}>{item?.locationLabel ?? "Được giữ riêng tư"}</Text></View>
          {claim.conversation?.custodyEscalated ? <View style={styles.infoBox}><MaterialCommunityIcons name="warehouse" size={18} color={colors.success} /><Text style={[styles.infoText, { color: colors.success }]}>Đang được lưu giữ tại quầy tiếp nhận đồ thất lạc của trường.</Text></View> : null}
          <Text style={styles.privacyText}>Không chia sẻ số seri, giấy tờ tùy thân hoặc bí mật sở hữu trong khu vực công khai.</Text>
        </Card>
      </ScrollView> : null}

      {panel === "evidence" ? <ScrollView style={styles.flex} contentContainerStyle={styles.panelContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        <Card style={styles.evidenceCard}>
          <View style={styles.cardHeader}><View style={styles.cardHeaderIcon}><MaterialCommunityIcons name="lock-check-outline" size={20} color={colors.success} /></View><View style={styles.claimCopy}><Text style={styles.cardTitle}>Bằng chứng riêng tư</Text><Text style={styles.cardSubtitle}>Chỉ người tham gia cuộc đối chiếu mới xem được.</Text></View><View style={styles.evidenceCount}><Text style={styles.evidenceCountText}>{evidence.length}</Text></View></View>
          <View style={styles.privacyBanner}><MaterialCommunityIcons name="shield-lock-outline" size={18} color={colors.success} /><Text style={styles.privacyText}>Tránh tải ảnh đầy đủ thẻ sinh viên, căn cước hoặc thông tin nhạy cảm không cần thiết.</Text></View>
          <Input label="Mô tả bằng chứng (không bắt buộc)" value={evidenceDescription} onChangeText={setEvidenceDescription} maxLength={255} placeholder="Ví dụ: Ốp lưng có vết xước ở góc trái" />
          <View style={styles.evidenceActions}><Button title="Chụp ảnh" variant="secondary" onPress={() => void uploadEvidence("camera")} loading={uploadingEvidence} style={styles.evidenceButton} /><Button title="Chọn từ thư viện" variant="secondary" onPress={() => void uploadEvidence("library")} loading={uploadingEvidence} style={styles.evidenceButton} /></View>
          {evidence.length ? <View style={styles.evidenceList}>{evidence.map((item) => <Card key={item.id} style={styles.evidenceItem}>
            <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Xem bằng chứng ${item.description ?? ""}`} onPress={() => setImageToView(item.url)}><SecureImage url={item.url} style={styles.evidenceImage} accessibilityLabel={item.description ?? "Bằng chứng riêng tư"} /></Pressable>
            <View style={styles.claimCopy}><Text style={styles.evidenceDescription}>{item.description || "Ảnh bằng chứng"}</Text><Text style={styles.cardSubtitle}>{item.uploadedBy.fullName} · {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(item.createdAt))}</Text><Text style={styles.privateTag}><MaterialCommunityIcons name="lock-outline" size={12} color={colors.success} /> RIÊNG TƯ</Text></View>
          </Card>)}</View> : <View style={styles.emptyEvidence}><MaterialCommunityIcons name="file-image-outline" size={29} color={colors.muted} /><Text style={styles.muted}>Chưa có bằng chứng được chia sẻ.</Text></View>}
        </Card>
      </ScrollView> : null}

      <Modal visible={Boolean(decision)} transparent animationType="fade" onRequestClose={() => setDecision(null)}>
        <View style={styles.modalBackdrop}><Card style={styles.decisionModal}>
          <View style={styles.modalTitleRow}><Text style={styles.cardTitle}>{decisions.find((item) => item.action === decision)?.label}</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setDecision(null)} style={styles.modalClose}><MaterialCommunityIcons name="close" size={20} color={colors.muted} /></Pressable></View>
          <Text style={styles.cardSubtitle}>Quyết định sẽ được ghi vào lịch sử xác minh và gửi thông báo cho bên còn lại.</Text>
          <Input label="Lý do" value={decisionReason} onChangeText={setDecisionReason} multiline maxLength={1000} placeholder="Nhập lý do để bên kia hiểu quyết định…" />
          {decision === "ESCALATE_TO_CUSTODY" ? <>
            <Text style={styles.fieldLabel}>Quầy tiếp nhận</Text>
            <ScrollView style={styles.pointList} nestedScrollEnabled>{decisionPoints.map((point) => <Pressable key={point.id} accessibilityRole="radio" accessibilityState={{ selected: handoverPointId === point.id }} onPress={() => setHandoverPointId(point.id)} style={[styles.pointOption, handoverPointId === point.id && styles.pointOptionSelected]}><MaterialCommunityIcons name={handoverPointId === point.id ? "radiobox-marked" : "radiobox-blank"} size={18} color={handoverPointId === point.id ? colors.primary : colors.muted} /><View style={styles.claimCopy}><Text style={styles.pointName}>{point.name}</Text><Text style={styles.cardSubtitle}>{point.address}</Text></View></Pressable>)}</ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setPickerMode(Platform.OS === "ios" ? "datetime" : "date")} style={styles.dateButton}><MaterialCommunityIcons name="calendar-clock-outline" size={18} color={colors.primary} /><Text style={styles.dateButtonText}>{intakeAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(intakeAt) : "Chọn thời gian bàn giao"}</Text></Pressable>
            {pickerMode ? <View style={styles.pickerPanel}><DateTimePicker value={intakeAt ?? defaultIntakeDate} mode={Platform.OS === "ios" ? "datetime" : pickerMode === "time" ? "time" : "date"} minimumDate={new Date()} display={Platform.OS === "ios" ? "spinner" : "default"} onChange={onDecisionTimeChange} />{Platform.OS === "ios" ? <Button title="Xong" variant="secondary" onPress={() => setPickerMode(null)} /> : null}</View> : null}
          </> : null}
          {error ? <ErrorBanner message={error} /> : null}
          <View style={styles.modalActions}><Button title="Hủy" variant="secondary" onPress={() => setDecision(null)} disabled={sending} style={styles.modalButton} /><Button title="Xác nhận" onPress={() => void submitDecision()} loading={sending} disabled={decisionReason.trim().length < 3 || (decision === "ESCALATE_TO_CUSTODY" && (!handoverPointId || !intakeAt))} style={styles.modalButton} /></View>
        </Card></View>
      </Modal>
      <Modal visible={Boolean(imageToView)} transparent animationType="fade" onRequestClose={() => setImageToView(null)}>
        <View style={styles.imageModal}><Pressable accessibilityRole="button" accessibilityLabel="Đóng ảnh" onPress={() => setImageToView(null)} style={styles.imageClose}><MaterialCommunityIcons name="close" size={24} color={colors.surface} /></Pressable>{imageToView ? <SecureImage url={imageToView} style={styles.fullImage} resizeMode="contain" accessibilityLabel="Ảnh riêng tư" /> : null}</View>
      </Modal>
    </SafeAreaView>
  );
}

const panelInfo: Record<Panel, { label: string; icon: "message-text-outline" | "shield-check-outline" | "package-variant-closed" | "folder-lock-outline" }> = {
  chat: { label: "Trò chuyện", icon: "message-text-outline" }, verify: { label: "Xác minh", icon: "shield-check-outline" }, item: { label: "Vật phẩm", icon: "package-variant-closed" }, evidence: { label: "Bằng chứng", icon: "folder-lock-outline" },
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  topBar: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 42, height: 44, justifyContent: "center" }, topBarCopy: { flex: 1 }, topTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" }, topSubtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
  roleBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.primarySoft }, roleBadgeText: { color: colors.primaryDark, fontSize: 9, fontWeight: "900" },
  panelTabScroll: { flexGrow: 0, height: 48 }, panelTabs: { paddingHorizontal: spacing.md, alignItems: "center", gap: spacing.xs }, panelTab: { height: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, panelTabSelected: { backgroundColor: colors.primary, borderColor: colors.primary }, panelTabText: { color: colors.muted, fontSize: 12, fontWeight: "700" }, panelTabTextSelected: { color: colors.surface }, panelTabCount: { color: colors.primary, fontSize: 10, fontWeight: "900" }, panelTabCountSelected: { color: colors.surface },
  inlineError: { paddingHorizontal: spacing.md, paddingTop: spacing.xs }, inlineNotice: { marginHorizontal: spacing.md, marginTop: spacing.xs, padding: spacing.sm, flexDirection: "row", gap: spacing.xs, alignItems: "center", backgroundColor: colors.successSoft, borderRadius: radii.control }, noticeText: { color: colors.success, fontSize: 12, flex: 1 },
  itemStrip: { marginHorizontal: spacing.md, marginTop: spacing.xs, padding: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control }, itemGlyph: { width: 38, height: 38, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft, borderRadius: 12 }, itemStripCopy: { flex: 1, gap: 2 }, itemStripTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" }, itemStripLocation: { color: colors.muted, fontSize: 11 }, itemMore: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  appointmentCta: { minHeight: 44, marginHorizontal: spacing.md, marginTop: spacing.sm, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radii.control }, appointmentCtaText: { color: colors.primaryDark, flex: 1, fontSize: 12, fontWeight: "800" },
  messageList: { flex: 1 }, messageContent: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm }, messageRow: { flexDirection: "row", justifyContent: "flex-start" }, messageRowOwn: { justifyContent: "flex-end" }, messageBubble: { maxWidth: "86%", minWidth: 100, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 16, gap: 4 }, messageOwn: { backgroundColor: colors.primary, borderBottomRightRadius: 5 }, messageOther: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 5 }, senderName: { color: colors.primary, fontSize: 11, fontWeight: "800" }, messageText: { color: colors.ink, fontSize: 14, lineHeight: 20 }, messageTextOwn: { color: colors.surface }, messageMeta: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: spacing.xs }, messageTime: { color: colors.muted, fontSize: 10 }, messageTimeOwn: { color: "#D9EAF9" }, pendingText: { color: "#D9EAF9", fontSize: 10 }, chatImage: { width: 220, height: 180, borderRadius: radii.control, backgroundColor: colors.surfaceMuted },
  systemMessage: { alignSelf: "center", maxWidth: "94%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.warningSoft }, systemText: { color: colors.warning, fontSize: 11, fontWeight: "700", flexShrink: 1 }, systemTime: { color: colors.warning, fontSize: 9 },
  olderButton: { minHeight: 40, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.primarySoft }, olderText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  chatEmpty: { flex: 1, minHeight: 150, alignItems: "center", justifyContent: "center", gap: spacing.sm }, chatEmptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" }, chatEmptyText: { maxWidth: 270, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  composer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }, messageInput: { minHeight: 48, maxHeight: 112 }, composerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs }, attachButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: colors.primarySoft }, sendButton: { flex: 1 }, closedNote: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm }, closedText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
  panelContent: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl }, verificationCard: { gap: spacing.md }, cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md }, cardHeaderIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primarySoft }, claimCopy: { flex: 1 }, cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" }, cardSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 }, progressTrack: { height: 8, overflow: "hidden", borderRadius: radii.pill, backgroundColor: colors.surfaceMuted }, progressFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.success },
  questionCard: { gap: spacing.sm }, questionTop: { flexDirection: "row", alignItems: "center", gap: spacing.xs }, questionType: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 }, questionText: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "700" }, answerState: { flexDirection: "row", alignItems: "center", gap: spacing.xs }, answerStateText: { color: colors.success, fontSize: 12, fontWeight: "700" }, waitingText: { color: colors.muted, fontSize: 12, lineHeight: 17 }, answerForm: { gap: spacing.sm, marginTop: spacing.sm }, promptList: { gap: spacing.xs, marginTop: spacing.sm }, promptButton: { minHeight: 48, padding: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, promptText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 17 },
  decisionCard: { gap: spacing.sm, borderColor: "#F4D9C5" }, decisionOption: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, disabledOption: { opacity: 0.48 }, decisionIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: colors.surface }, decisionText: { flex: 1, color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
  itemCard: { gap: spacing.md }, itemPanelEyebrow: { flexDirection: "row", alignItems: "center", gap: spacing.xs }, eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, itemImage: { width: "100%", height: 220, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, itemImagePlaceholder: { alignItems: "center", justifyContent: "center", gap: spacing.xs }, itemPanelTitle: { color: colors.ink, fontSize: 20, lineHeight: 27, fontWeight: "900" }, detailRow: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }, detailLabel: { color: colors.muted, fontSize: 12 }, detailValue: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: "700", textAlign: "right" },
  evidenceCard: { gap: spacing.md }, evidenceCount: { minWidth: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.successSoft }, evidenceCountText: { color: colors.success, fontWeight: "900" }, privacyBanner: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.successSoft }, privacyText: { flex: 1, color: colors.success, fontSize: 12, lineHeight: 18 }, evidenceActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, evidenceButton: { flexGrow: 1, minWidth: 130 }, evidenceList: { gap: spacing.sm }, evidenceItem: { padding: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md }, evidenceImage: { width: 76, height: 76, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, evidenceDescription: { color: colors.ink, fontSize: 13, fontWeight: "800" }, privateTag: { color: colors.success, fontSize: 10, fontWeight: "900", marginTop: 6 }, emptyEvidence: { minHeight: 120, alignItems: "center", justifyContent: "center", gap: spacing.sm }, muted: { color: colors.muted, fontSize: 12, textAlign: "center" }, fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  infoBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.successSoft }, infoText: { flex: 1, color: colors.success, fontSize: 12, lineHeight: 18 },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: spacing.md, backgroundColor: "rgba(13, 28, 42, 0.48)" }, decisionModal: { gap: spacing.md, maxHeight: "92%" }, modalTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, modalClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, pointList: { maxHeight: 170 }, pointOption: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.control }, pointOptionSelected: { backgroundColor: colors.primarySoft }, pointName: { color: colors.ink, fontSize: 13, fontWeight: "800" }, dateButton: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control }, dateButtonText: { flex: 1, color: colors.ink, fontSize: 12 }, pickerPanel: { padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, modalActions: { flexDirection: "row", gap: spacing.sm }, modalButton: { flex: 1 }, imageModal: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(5, 13, 22, 0.94)" }, imageClose: { position: "absolute", top: 52, right: 18, zIndex: 2, width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.14)" }, fullImage: { width: "100%", height: "78%" }, missing: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg },
});
