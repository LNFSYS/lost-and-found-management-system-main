import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { SecureImage } from "@/components/secure-image";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import {
  activityService,
  getApiErrorMessage,
  type JourneyEvent,
  type JourneySummary,
  type PostJourneyResponse,
} from "@/services/api";

const eventLabels: Record<string, string> = {
  POST_CREATED: "Bài viết được đăng",
  MATCHING_AVAILABLE: "Có gợi ý ghép đôi",
  CLAIM_CREATED: "Bắt đầu yêu cầu xác minh",
  CONVERSATION_OPENED: "Mở cuộc trao đổi",
  PHOTO_SHARED: "Chia sẻ ảnh bằng chứng",
  PROPOSED: "Đề xuất lịch hẹn",
  ACCEPT: "Đồng ý lịch hẹn",
  REJECT: "Từ chối lịch hẹn",
  CANCEL: "Hủy lịch hẹn",
  RESCHEDULE: "Đề xuất đổi lịch",
  NO_SHOW: "Không có mặt tại lịch hẹn",
  FINDER_CONFIRM: "Người nhặt xác nhận trao trả",
  OWNER_CONFIRM: "Người nhận xác nhận đã nhận đồ",
  FINDER_DISPUTE: "Người nhặt báo có vấn đề",
  OWNER_DISPUTE: "Người nhận báo có vấn đề",
  RETURN_COMPLETED: "Hoàn tất trả đồ",
  LEGACY_RETURN_RECORDED: "Ghi nhận vật phẩm đã được trả",
  REQUEST_CREATED: "Tạo yêu cầu bàn giao",
  REQUEST_ACCEPTED: "Nhân viên tiếp nhận yêu cầu",
  ACCEPTED: "Yêu cầu bàn giao đã được chấp nhận",
  INTAKED: "Vật phẩm đã được tiếp nhận vào kho",
  REJECTED: "Yêu cầu bàn giao bị từ chối",
  CANCELLED: "Yêu cầu bàn giao đã hủy",
  INTAKE_CONFIRMED: "Vật phẩm được nhập kho",
  RECEIVED: "Đã tiếp nhận vào kho",
  STORED: "Vật phẩm được lưu kho",
  CLAIMED: "Vật phẩm được giữ cho yêu cầu nhận lại",
  FEEDBACK_RECORDED: "Đã gửi đánh giá sau trao trả",
  CUSTODY_RETURN_COMPLETED: "Hoàn tất trả đồ qua kho",
  CUSTODY_ESCALATED: "Yêu cầu được chuyển sang quản lý kho",
  STAFF_CUSTODY_VERIFIED: "Nhân viên xác minh vật phẩm",
};

const stateLabels: Record<string, string> = {
  OPEN: "Đang mở",
  MATCHED: "Đã có gợi ý ghép đôi",
  PENDING: "Đang chờ",
  CONVERSATION_OPEN: "Đang trao đổi",
  NEED_MORE_INFO: "Cần thêm thông tin",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
  COMPLETED: "Hoàn tất",
  RECEIVED: "Đã tiếp nhận",
  STORED: "Đang lưu kho",
  RETURNED: "Đã trao trả",
  CLAIMED: "Đang chờ người nhận",
  EXPIRED: "Đã hết hạn",
  DISPOSED: "Đã xử lý",
  DONATED: "Đã quyên góp",
  TRANSFERRED: "Đã chuyển giao",
};

const sourceIcons: Record<string, "file-document-outline" | "creation" | "shield-account-outline" | "message-text-outline" | "calendar-clock-outline" | "warehouse" | "package-variant-closed-check" | "star-outline"> = {
  POST: "file-document-outline",
  MATCHING: "creation",
  CLAIM: "shield-account-outline",
  CHAT: "message-text-outline",
  APPOINTMENT: "calendar-clock-outline",
  CUSTODY: "warehouse",
  WAREHOUSE: "package-variant-closed-check",
  RETURN: "package-variant-closed-check",
  FEEDBACK: "star-outline",
};

function eventLabel(event: JourneyEvent) {
  return eventLabels[event.action] ?? event.action.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function stateLabel(status: string | null) {
  return status ? stateLabels[status] ?? status.toLowerCase().replaceAll("_", " ") : null;
}

function dateTime(value: string | null) {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa ghi nhận" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function custodyLabel(value: JourneySummary["custodian"]) {
  return { FINDER: "Người nhặt", STAFF: "Nhân viên quản lý", OWNER: "Chủ sở hữu", UNKNOWN: "Chưa xác định" }[value];
}

function locationLabel(value: JourneySummary["locationClass"]) {
  return {
    FINDER_HELD: "Người nhặt đang giữ",
    WAREHOUSE: "Đang lưu tại kho",
    RETURNED: "Đã trao trả",
    OTHER_DISPOSITION: "Đã xử lý theo quy định",
    UNKNOWN: "Chưa xác định",
  }[value];
}

function TimelineEvent({ event, isLast, canFeedback }: { event: JourneyEvent; isLast: boolean; canFeedback: boolean }) {
  const icon = sourceIcons[event.source] ?? "history";
  const states = event.fromStatus || event.toStatus
    ? `${stateLabel(event.fromStatus) ?? "Mới"}${event.toStatus ? ` → ${stateLabel(event.toStatus)}` : ""}`
    : null;

  return (
    <View style={styles.eventRow}>
      <View style={styles.rail}>
        <View style={styles.eventDot}><MaterialCommunityIcons name={icon} size={15} color={colors.primary} /></View>
        {!isLast ? <View style={styles.railLine} /> : null}
      </View>
      <Card style={styles.eventCard}>
        <View style={styles.eventHeading}>
          <Text style={styles.eventTitle}>{eventLabel(event)}</Text>
          <Text style={styles.eventTime}>{dateTime(event.createdAt)}</Text>
        </View>
        <View style={styles.eventMetaRow}>
          <View style={styles.sourceBadge}><Text style={styles.sourceBadgeText}>{event.source === "WAREHOUSE" ? "KHO" : event.source}</Text></View>
          {states ? <Text style={styles.eventState}>{states}</Text> : null}
        </View>
        {event.conversationWith ? <Text style={styles.eventDetail}>Trao đổi với {event.conversationWith}</Text> : null}
        {event.appointment?.proposedAt ? <Text style={styles.eventDetail}>Thời gian đề xuất: {dateTime(event.appointment.proposedAt)}</Text> : null}
        {event.matchingSuggestions?.length ? (
          <View style={styles.suggestionList}>
            <Text style={styles.eventDetailStrong}>Bài viết đối ứng được gợi ý</Text>
            {event.matchingSuggestions.map((suggestion) => (
              <Pressable key={suggestion.postId} accessibilityRole="link" onPress={() => router.push(`/posts/${suggestion.postId}` as never)} style={styles.suggestionLink}>
                <Text numberOfLines={1} style={styles.suggestionTitle}>{suggestion.title}</Text>
                <Text style={styles.suggestionScore}>{Math.round(suggestion.score * 100)}%</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {event.images.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageList}>
            {event.images.map((image, index) => (
              <View key={image.id} style={styles.imageItem}>
                <SecureImage url={image.url} style={styles.proofImage} accessibilityLabel={`Ảnh minh chứng ${index + 1}`} />
                <Text style={styles.imageCaption}>{image.kind === "POST" ? "Ảnh bài đăng" : image.kind === "CLAIM" ? "Bằng chứng xác minh" : image.kind === "INTAKE" ? "Ảnh tiếp nhận" : "Ảnh trao trả"}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
        {canFeedback && event.source === "RETURN" && event.targetId ? (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/appointments/${event.targetId}` as never)} style={({ pressed }) => [styles.feedbackLink, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="star-outline" size={17} color={colors.primary} />
            <Text style={styles.feedbackLinkText}>Đánh giá lần trao trả này</Text>
          </Pressable>
        ) : null}
      </Card>
    </View>
  );
}

export default function PostJourneyScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const [data, setData] = useState<PostJourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!postId) return;
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      setData(await activityService.getPostJourney(postId));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [postId]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const loadMore = async () => {
    if (!postId || !data?.hasMore || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await activityService.getPostJourney(postId, data.page + 1, data.asOf);
      setData((current) => current ? {
        ...next,
        results: [...current.results, ...next.results.filter((event) => !current.results.some((existing) => existing.id === event.id))],
      } : next);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><LoadingSpinner label="Đang tải hành trình vật phẩm…" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} hitSlop={8} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.ink} /></Pressable>
        <Text accessibilityRole="header" style={styles.topTitle}>Hành trình vật phẩm</Text>
        <View style={styles.topBarSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
        {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
        {data ? (
          <>
            <Card style={styles.summaryCard}>
              <View style={styles.summaryEyebrow}><MaterialCommunityIcons name="package-variant-closed" size={18} color={colors.primary} /><Text style={styles.eyebrowText}>TÌNH TRẠNG QUẢN LÝ</Text></View>
              <Text style={styles.itemTitle}>{data.title}</Text>
              <View style={styles.summaryMain}>
                <View style={styles.summaryIcon}><MaterialCommunityIcons name="account-box-outline" size={21} color={colors.primary} /></View>
                <View style={styles.summaryCopy}><Text style={styles.summaryLabel}>Người đang giữ</Text><Text style={styles.summaryValue}>{custodyLabel(data.summary.custodian)}</Text></View>
                <View style={styles.summaryIcon}><MaterialCommunityIcons name="map-marker-radius-outline" size={21} color={colors.primary} /></View>
                <View style={styles.summaryCopy}><Text style={styles.summaryLabel}>Vị trí hiện tại</Text><Text style={styles.summaryValue}>{locationLabel(data.summary.locationClass)}</Text></View>
              </View>
              <View style={styles.summaryDates}>
                <View style={styles.dateCell}><Text style={styles.summaryLabel}>Tiếp nhận</Text><Text style={styles.dateValue}>{dateTime(data.summary.receivedAt)}</Text></View>
                <View style={styles.dateCell}><Text style={styles.summaryLabel}>Hoàn trả</Text><Text style={styles.dateValue}>{dateTime(data.summary.returnedAt)}</Text></View>
              </View>
              {data.summary.custodyHours !== null ? <Text style={styles.durationText}>Thời gian quản lý: {data.summary.custodyHours} giờ</Text> : null}
              {data.summary.feedbackEligible ? <View style={styles.eligibleHint}><MaterialCommunityIcons name="star-check-outline" size={17} color={colors.success} /><Text style={styles.eligibleText}>Bạn có thể đánh giá sau khi trao trả.</Text></View> : null}
            </Card>

            <View style={styles.timelineHeading}>
              <View><Text style={styles.sectionTitle}>Các mốc xử lý</Text><Text style={styles.eventCount}>{data.total} sự kiện · hiển thị theo thời gian</Text></View>
              <View style={styles.countPill}><Text style={styles.countText}>{data.results.length}</Text></View>
            </View>

            {data.results.length ? (
              <View style={styles.timeline}>
                {data.results.map((event, index) => <TimelineEvent key={event.id} event={event} isLast={index === data.results.length - 1 && !data.hasMore} canFeedback={data.summary.feedbackEligible} />)}
              </View>
            ) : (
              <Card style={styles.emptyCard}><EmptyState icon="timeline-clock-outline" title="Chưa có mốc hành trình" description="Các cập nhật xử lý sẽ xuất hiện tại đây khi có phát sinh." /></Card>
            )}

            {data.hasMore ? (
              <Pressable accessibilityRole="button" onPress={() => void loadMore()} disabled={loadingMore} style={({ pressed }) => [styles.loadMoreButton, pressed && !loadingMore && styles.pressed]}>
                {loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialCommunityIcons name="history" size={18} color={colors.primary} />}
                <Text style={styles.loadMoreText}>{loadingMore ? "Đang tải…" : "Tải thêm sự kiện"}</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  topBar: { minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  backButton: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  topTitle: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: "800" },
  topBarSpacer: { width: 24 },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  summaryCard: { gap: spacing.md },
  summaryEyebrow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  eyebrowText: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 0.7 },
  itemTitle: { color: colors.ink, fontSize: 20, lineHeight: 27, fontWeight: "800" },
  summaryMain: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap", paddingVertical: spacing.xs },
  summaryIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  summaryCopy: { flexGrow: 1, flexBasis: "35%", gap: 3 },
  summaryLabel: { color: colors.muted, fontSize: 12 },
  summaryValue: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  summaryDates: { flexDirection: "row", gap: spacing.sm },
  dateCell: { flex: 1, gap: 5, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.surfaceMuted },
  dateValue: { color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  durationText: { color: colors.muted, fontSize: 12 },
  eligibleHint: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.successSoft },
  eligibleText: { color: colors.success, fontSize: 12, fontWeight: "700" },
  timelineHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  eventCount: { color: colors.muted, fontSize: 13, marginTop: 3 },
  countPill: { minWidth: 38, height: 32, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.primarySoft },
  countText: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
  timeline: { gap: 0 },
  eventRow: { flexDirection: "row", alignItems: "stretch", gap: spacing.sm },
  rail: { width: 32, alignItems: "center" },
  eventDot: { zIndex: 1, width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  railLine: { position: "absolute", top: 30, bottom: -5, width: 2, backgroundColor: colors.border },
  eventCard: { flex: 1, gap: spacing.sm, marginBottom: spacing.md, padding: spacing.md },
  eventHeading: { gap: 4 },
  eventTitle: { color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: "800" },
  eventTime: { color: colors.muted, fontSize: 12 },
  eventMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  sourceBadgeText: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  eventState: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  eventDetail: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  eventDetailStrong: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  suggestionList: { gap: 6, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.primarySoft },
  suggestionLink: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  suggestionTitle: { flex: 1, color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  suggestionScore: { color: colors.primaryDark, fontSize: 12, fontWeight: "900" },
  imageList: { gap: spacing.sm, paddingTop: spacing.xs },
  imageItem: { width: 148, gap: 5 },
  proofImage: { width: 148, height: 110, overflow: "hidden", borderRadius: radii.control, backgroundColor: colors.surfaceMuted },
  imageCaption: { color: colors.muted, fontSize: 11 },
  feedbackLink: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, borderRadius: radii.control, backgroundColor: colors.primarySoft },
  feedbackLinkText: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
  loadMoreButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  loadMoreText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  emptyCard: { alignItems: "center" },
  pressed: { opacity: 0.76 },
});
