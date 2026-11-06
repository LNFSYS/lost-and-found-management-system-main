import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { claimService, createRequestUuid, getApiErrorMessage, postService, type ClaimRecord, type MobileImageFile, type PostSummary } from "@/services/api";

const statusLabels: Record<ClaimRecord["status"], string> = {
  PENDING: "Chờ Finder",
  CONVERSATION_OPEN: "Đang trao đổi",
  NEED_MORE_INFO: "Cần bổ sung thông tin",
  ACCEPTED: "Đủ điều kiện hẹn gặp",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã đóng",
};

const statusColors: Record<ClaimRecord["status"], { color: string; background: string }> = {
  PENDING: { color: colors.warning, background: colors.warningSoft },
  CONVERSATION_OPEN: { color: colors.primaryDark, background: colors.primarySoft },
  NEED_MORE_INFO: { color: "#9A4B13", background: colors.accentSoft },
  ACCEPTED: { color: colors.success, background: colors.successSoft },
  REJECTED: { color: colors.danger, background: colors.dangerSoft },
  CANCELLED: { color: colors.neutral, background: colors.neutralSoft },
};

function claimTitle(claim: ClaimRecord) {
  return claim.item?.title ?? claim.posts.found.title ?? claim.posts.lost?.title ?? "Vật phẩm";
}

function timeLabel(value: string | null | undefined) {
  if (!value) return "Chưa có tin nhắn";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(date);
}

function imageFile(asset: ImagePicker.ImagePickerAsset): MobileImageFile {
  const extension = asset.mimeType === "image/png" ? "png" : asset.mimeType === "image/webp" ? "webp" : "jpg";
  return { uri: asset.uri, name: asset.fileName || `claim-photo-${Date.now()}.${extension}`, type: asset.mimeType || "image/jpeg", size: asset.fileSize };
}

function ConversationCard({ claim, userId }: { claim: ClaimRecord; userId?: string }) {
  const counterpart = claim.claimantId === userId ? claim.finder : claim.claimant;
  const unreadCount = claim.conversation?.unreadCount ?? 0;
  const statusStyle = statusColors[claim.status];
  const role = claim.finderId === userId ? "FINDER · NGƯỜI NHẶT" : "CLAIMANT · NGƯỜI NHẬN";
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/claims/${claim.id}` as never)} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.claimCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{counterpart.fullName.trim().slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.claimCopy}>
          <View style={styles.claimTopLine}>
            <Text numberOfLines={1} style={styles.personName}>{counterpart.fullName}</Text>
            <Text style={styles.time}>{timeLabel(claim.conversation?.lastMessageAt ?? claim.updatedAt)}</Text>
          </View>
          <Text numberOfLines={1} style={styles.itemName}>{claimTitle(claim)}</Text>
          <Text numberOfLines={1} style={styles.preview}>{claim.conversation?.lastMessage || claim.description || "Mở cuộc trao đổi riêng"}</Text>
          <View style={styles.claimFooter}>
            <View style={[styles.statusPill, { backgroundColor: statusStyle.background }]}><Text style={[styles.statusText, { color: statusStyle.color }]}>{statusLabels[claim.status]}</Text></View>
            <Text style={styles.roleLabel}>{role}</Text>
          </View>
        </View>
        {unreadCount > 0 ? <View accessibilityLabel={`${unreadCount} tin chưa đọc`} style={styles.unread}><Text style={styles.unreadText}>{unreadCount > 99 ? "99+" : unreadCount}</Text></View> : <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />}
      </Card>
    </Pressable>
  );
}

function ClaimComposer({ post, sourceFoundPostId, onClose, onCreated }: { post: PostSummary; sourceFoundPostId?: string; onClose: () => void; onCreated: (claim: ClaimRecord) => void }) {
  const [proof, setProof] = useState("");
  const [location, setLocation] = useState("");
  const [approximateTime, setApproximateTime] = useState<Date | null>(null);
  const [pickerMode, setPickerMode] = useState<"date" | "time" | "datetime" | null>(null);
  const [contactPhoto, setContactPhoto] = useState<MobileImageFile | null>(null);
  const [contactPhotoUri, setContactPhotoUri] = useState<string | null>(null);
  const [contactCheckId, setContactCheckId] = useState<string | null>(null);
  const [contactScore, setContactScore] = useState<number | null>(null);
  const [checkingPhoto, setCheckingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = useRef(createRequestUuid());
  const messageKey = useRef(createRequestUuid());
  const needsPhotoCheck = post.type === "LOST";

  const choosePhoto = async (source: "camera" | "library") => {
    setError(null);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error("Cần cấp quyền camera để kiểm tra ảnh vật phẩm.");
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error("Cần cấp quyền thư viện ảnh để chọn ảnh vật phẩm.");
      }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) throw new Error("Ảnh cần nhỏ hơn hoặc bằng 5 MB.");
      setContactPhoto(imageFile(asset));
      setContactPhotoUri(asset.uri);
      setContactCheckId(null);
      setContactScore(null);
    } catch (photoError) {
      setError(getApiErrorMessage(photoError));
    }
  };

  const verifyPhoto = async () => {
    if (!contactPhoto || checkingPhoto) return;
    setCheckingPhoto(true);
    setError(null);
    try {
      const result = await claimService.checkLostContactPhoto(post.id, contactPhoto);
      if (!result.approved || !result.checkId) throw new Error("Ảnh chưa đạt mức tương đồng cần thiết. Hãy thử ảnh rõ hơn của vật phẩm.");
      setContactCheckId(result.checkId);
      setContactScore(result.score);
    } catch (photoError) {
      setError(getApiErrorMessage(photoError));
    } finally {
      setCheckingPhoto(false);
    }
  };

  const onDateTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "dismissed") { setPickerMode(null); return; }
    if (!selected) return;
    const base = approximateTime ?? new Date();
    if (Platform.OS === "android" && pickerMode === "date") {
      const combined = new Date(selected);
      combined.setHours(base.getHours(), base.getMinutes(), 0, 0);
      setApproximateTime(combined);
      setPickerMode("time");
      return;
    }
    if (Platform.OS === "android" && pickerMode === "time") {
      const combined = new Date(base);
      combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setApproximateTime(combined);
      setPickerMode(null);
      return;
    }
    setApproximateTime(selected);
  };

  const submit = async () => {
    if (submitting) return;
    if (post.canEdit) { setError("Bạn không thể gửi yêu cầu cho bài viết của chính mình."); return; }
    if (proof.trim().length < 10) { setError("Mô tả bằng chứng cần ít nhất 10 ký tự."); return; }
    if (location.trim().length < 3) { setError("Nhập địa điểm bạn nhớ đã làm mất vật phẩm."); return; }
    if (approximateTime && approximateTime.getTime() > Date.now()) { setError("Thời gian thất lạc phải ở quá khứ."); return; }
    if (needsPhotoCheck && !contactCheckId) { setError("Hãy kiểm tra ảnh vật phẩm trước khi mở cuộc trò chuyện."); return; }
    const initialMessage = [
      "Xin chào, tôi muốn xác minh quyền sở hữu vật phẩm này.",
      `Bằng chứng nhận dạng: ${proof.trim()}`,
      approximateTime ? `Thời gian thất lạc gần đúng: ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(approximateTime)}` : "",
      `Địa điểm thất lạc gần đúng: ${location.trim()}`,
    ].filter(Boolean).join("\n");
    setSubmitting(true);
    setError(null);
    try {
      await claimService.create({
        postId: post.id,
        description: proof.trim(),
        approximateLostAt: approximateTime?.toISOString(),
        approximateLocation: location.trim(),
        sourceFoundPostId,
        contactCheckId: contactCheckId ?? undefined,
        requestKey: requestKey.current,
      });
      const result = await claimService.createDirectMessage(post.id, initialMessage, messageKey.current, sourceFoundPostId, contactCheckId ?? undefined);
      onCreated(result.claim);
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={styles.composerCard}>
      <View style={styles.composerHeader}>
        <View style={styles.composerIcon}><MaterialCommunityIcons name="shield-check-outline" size={21} color={colors.primary} /></View>
        <View style={styles.claimCopy}><Text style={styles.composerTitle}>Yêu cầu nhận lại vật phẩm</Text><Text numberOfLines={2} style={styles.composerSubtitle}>{post.title}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng biểu mẫu" onPress={onClose} style={styles.closeButton}><MaterialCommunityIcons name="close" size={21} color={colors.muted} /></Pressable>
      </View>
      {post.canEdit ? <View style={styles.infoBox}><MaterialCommunityIcons name="information-outline" size={18} color={colors.warning} /><Text style={styles.infoText}>Bạn là người đăng bài này. Mở yêu cầu từ bài viết của người khác.</Text></View> : null}
      <Input label="Bằng chứng nhận dạng vật phẩm" value={proof} onChangeText={setProof} multiline maxLength={1200} placeholder="Mô tả dấu hiệu riêng, nội dung bên trong hoặc đặc điểm chỉ chủ sở hữu biết…" />
      <Input label="Địa điểm thất lạc gần đúng" value={location} onChangeText={setLocation} maxLength={255} placeholder="Ví dụ: thư viện, khu A…" />
      <View style={styles.dateField}>
        <Text style={styles.fieldLabel}>Thời gian thất lạc gần đúng</Text>
        <Pressable accessibilityRole="button" onPress={() => setPickerMode(Platform.OS === "ios" ? "datetime" : "date")} style={styles.dateButton}>
          <MaterialCommunityIcons name="calendar-clock-outline" size={19} color={colors.primary} />
          <Text style={styles.dateButtonText}>{approximateTime ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(approximateTime) : "Chọn ngày và giờ (không bắt buộc)"}</Text>
        </Pressable>
        {pickerMode ? <View style={styles.pickerPanel}>
          <DateTimePicker value={approximateTime ?? new Date()} mode={Platform.OS === "ios" ? "datetime" : pickerMode === "time" ? "time" : "date"} display={Platform.OS === "ios" ? "spinner" : "default"} maximumDate={new Date()} onChange={onDateTimeChange} />
          {Platform.OS === "ios" ? <Button title="Xong" variant="secondary" onPress={() => setPickerMode(null)} /> : null}
        </View> : null}
      </View>
      {needsPhotoCheck ? <View style={styles.photoGate}>
        <View style={styles.photoGateHeading}><MaterialCommunityIcons name="lock-check-outline" size={18} color={colors.primary} /><Text style={styles.fieldLabel}>Kiểm tra ảnh vật phẩm để mở chat</Text></View>
        <Text style={styles.photoHint}>Ảnh chỉ dùng để đối chiếu trước khi liên hệ. Không thay thế xác minh quyền sở hữu.</Text>
        {contactPhotoUri ? <Image source={{ uri: contactPhotoUri }} style={styles.contactPreview} accessibilityLabel="Ảnh vật phẩm được chọn" /> : null}
        <View style={styles.photoActions}>
          <Button title="Chụp ảnh" variant="secondary" onPress={() => void choosePhoto("camera")} disabled={checkingPhoto || submitting} style={styles.photoButton} />
          <Button title="Chọn ảnh" variant="secondary" onPress={() => void choosePhoto("library")} disabled={checkingPhoto || submitting} style={styles.photoButton} />
          {contactPhoto ? <Button title={contactCheckId ? "Đã xác minh" : "Kiểm tra ảnh"} loading={checkingPhoto} onPress={() => void verifyPhoto()} disabled={submitting} style={styles.photoButton} /> : null}
        </View>
        {contactScore !== null ? <Text style={styles.photoSuccess}>Ảnh tương đồng {Math.round(contactScore * 100)}% · Có thể bắt đầu trao đổi</Text> : null}
      </View> : null}
      {error ? <ErrorBanner message={error} /> : null}
      <Button title="Gửi yêu cầu và mở chat riêng" onPress={() => void submit()} loading={submitting} disabled={post.canEdit || (needsPhotoCheck && !contactCheckId)} />
    </Card>
  );
}

export default function ClaimsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ composePostId?: string; sourceFoundPostId?: string }>();
  const postId = typeof params.composePostId === "string" ? params.composePostId : undefined;
  const sourceFoundPostId = typeof params.sourceFoundPostId === "string" ? params.sourceFoundPostId : undefined;
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [post, setPost] = useState<PostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      const result = await claimService.list(1, 30);
      setClaims(result.items);
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let active = true;
    if (!postId) {
      const timer = setTimeout(() => {
        if (active) setPost(null);
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
    const timer = setTimeout(() => {
      if (!active) return;
      setLoadingPost(true);
      setError(null);
      void (async () => {
        try {
          if (!sourceFoundPostId) {
            const existing = await postService.findConversationByPost(postId);
            if (active && existing?.id) { router.replace(`/claims/${existing.id}` as never); return; }
          }
          const result = await postService.getPost(postId);
          if (active) setPost(result);
        } catch (postError) {
          if (active) setError(getApiErrorMessage(postError));
        } finally {
          if (active) setLoadingPost(false);
        }
      })();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [postId, sourceFoundPostId]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await claimService.list(page + 1, 30);
      setClaims((current) => [...current, ...result.items.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoadingMore(false);
    }
  };

  const closeComposer = () => { setPost(null); router.replace("/claims" as never); };
  const onCreated = (claim: ClaimRecord) => router.replace(`/claims/${claim.id}` as never);

  if (loading) return <SafeAreaView style={styles.safeArea}><LoadingSpinner label="Đang tải các yêu cầu đối chiếu…" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerIcon}><MaterialCommunityIcons name="message-processing-outline" size={23} color={colors.primary} /></View>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>TRAO ĐỔI RIÊNG TƯ</Text><Text accessibilityRole="header" style={styles.title}>Yêu cầu nhận lại đồ</Text><Text style={styles.description}>Trao đổi bằng chứng riêng với Finder hoặc Claimant.</Text></View>
          <View style={styles.headerCount}><Text style={styles.headerCountNumber}>{claims.length}</Text><Text style={styles.headerCountLabel}>cuộc chat</Text></View>
        </View>
        {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
        {postId ? loadingPost ? <Card style={styles.loadingPost}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Đang mở biểu mẫu yêu cầu…</Text></Card> : post ? <ClaimComposer post={post} sourceFoundPostId={sourceFoundPostId} onClose={closeComposer} onCreated={onCreated} /> : null : null}
        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Cuộc đối chiếu của bạn</Text><Text style={styles.sectionSubtitle}>Tin nhắn và trạng thái mới nhất</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Tải lại danh sách" onPress={() => void load(true)} style={styles.refreshButton}><MaterialCommunityIcons name="refresh" size={19} color={colors.primary} /></Pressable></View>
        {claims.length ? <View style={styles.list}>{claims.map((claim) => <ConversationCard key={claim.id} claim={claim} userId={user?.id} />)}</View> : !error ? <Card style={styles.emptyCard}><EmptyState icon="message-text-outline" title="Chưa có cuộc đối chiếu" description="Mở một bài viết và chọn gửi yêu cầu nhận lại để bắt đầu trao đổi riêng." /></Card> : null}
        {hasMore ? <Button title="Tải thêm cuộc trao đổi" loading={loadingMore} variant="secondary" onPress={() => void loadMore()} /> : null}
        <View style={styles.privacyNote}><MaterialCommunityIcons name="lock-outline" size={17} color={colors.success} /><Text style={styles.privacyText}>Chỉ Finder, Claimant và nhân sự được phân quyền mới xem được nội dung cuộc trao đổi.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.sm },
  headerIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: colors.primarySoft },
  headerCopy: { flex: 1, gap: 3 }, eyebrow: { color: colors.primary, fontSize: 10, letterSpacing: 0.8, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 21, lineHeight: 27, fontWeight: "900" }, description: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  headerCount: { alignItems: "center", minWidth: 46 }, headerCountNumber: { color: colors.primary, fontSize: 20, fontWeight: "900" }, headerCountLabel: { color: colors.muted, fontSize: 10 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" }, sectionSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  refreshButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  list: { gap: spacing.sm }, claimCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  avatar: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft }, avatarText: { color: colors.primaryDark, fontSize: 18, fontWeight: "900" },
  claimCopy: { flex: 1, gap: 4 }, claimTopLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, personName: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "800" }, time: { color: colors.muted, fontSize: 10 }, itemName: { color: colors.ink, fontSize: 13, fontWeight: "700" }, preview: { color: colors.muted, fontSize: 12 },
  claimFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: 3 }, statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill }, statusText: { fontSize: 10, fontWeight: "800" }, roleLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  unread: { minWidth: 24, height: 24, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.accent }, unreadText: { color: colors.surface, fontSize: 11, fontWeight: "900" },
  emptyCard: { alignItems: "center" }, loadingPost: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, muted: { color: colors.muted, fontSize: 13 }, privacyNote: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.successSoft }, privacyText: { flex: 1, color: colors.success, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.78 }, composerCard: { gap: spacing.md }, composerHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md }, composerIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primarySoft }, composerTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" }, composerSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 }, closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  infoBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.warningSoft }, infoText: { flex: 1, color: colors.warning, fontSize: 12, lineHeight: 17 }, fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  dateField: { gap: spacing.sm }, dateButton: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, backgroundColor: colors.surface }, dateButtonText: { color: colors.ink, fontSize: 13, flex: 1 }, pickerPanel: { padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.surfaceMuted, gap: spacing.sm },
  photoGate: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, photoGateHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, photoHint: { color: colors.muted, fontSize: 12, lineHeight: 17 }, contactPreview: { width: "100%", height: 150, borderRadius: radii.control, backgroundColor: colors.border }, photoActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, photoButton: { flexGrow: 1, minWidth: 92, paddingHorizontal: spacing.sm }, photoSuccess: { color: colors.success, fontSize: 12, fontWeight: "800" },
});
