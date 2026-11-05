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

import { PostImage } from "@/components/post-image";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import {
  getApiErrorMessage,
  postService,
  type MatchCandidateResult,
  type MatchFeedbackValue,
  type MatchTier,
  type PostMatchesResponse,
} from "@/services/api";

const tierAppearance: Record<MatchTier, { label: string; color: string; background: string; icon: "alert-circle-outline" | "lightbulb-on-outline" | "bell-ring-outline" | "check-decagram-outline" }> = {
  WEAK: { label: "Tín hiệu thấp", color: colors.neutral, background: colors.neutralSoft, icon: "alert-circle-outline" },
  SUGGESTION: { label: "Gợi ý", color: colors.primaryDark, background: colors.primarySoft, icon: "lightbulb-on-outline" },
  NOTIFY: { label: "Nên đối chiếu", color: "#9A4B13", background: colors.accentSoft, icon: "bell-ring-outline" },
  HIGH_CONFIDENCE: { label: "Độ tin cậy cao", color: colors.success, background: colors.successSoft, icon: "check-decagram-outline" },
};

const scoreLabels: { key: keyof MatchCandidateResult["scores"]; label: string; icon: "text-box-outline" | "shape-outline" | "map-marker-outline" | "clock-outline" | "image-search-outline" | "text-recognition" }[] = [
  { key: "text", label: "Nội dung văn bản", icon: "text-box-outline" },
  { key: "category", label: "Danh mục", icon: "shape-outline" },
  { key: "location", label: "Địa điểm", icon: "map-marker-outline" },
  { key: "time", label: "Thời gian", icon: "clock-outline" },
  { key: "image", label: "Nhãn hình ảnh", icon: "image-search-outline" },
  { key: "ocr", label: "Chữ nhận diện (OCR)", icon: "text-recognition" },
];

const feedbackChoices: { value: MatchFeedbackValue; label: string; icon: "thumb-up-outline" | "thumb-down-outline" | "close-circle-outline" }[] = [
  { value: "USEFUL", label: "Hữu ích", icon: "thumb-up-outline" },
  { value: "IRRELEVANT", label: "Không liên quan", icon: "thumb-down-outline" },
  { value: "INCORRECT", label: "Sai", icon: "close-circle-outline" },
];

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value <= 1 ? value * 100 : value)));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Chưa có dữ liệu";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa có dữ liệu" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function locationLabel(candidate: MatchCandidateResult["candidate"]) {
  const location = candidate.location;
  return [location.roomText ? `Phòng ${location.roomText}` : null, location.building?.name, location.area?.name, location.customLocation]
    .filter(Boolean)
    .join(" · ") || candidate.handoverPoint?.name || "Khuôn viên FPTU";
}

function ScoreRow({ label, value, icon }: { label: string; value: number; icon: (typeof scoreLabels)[number]["icon"] }) {
  const valuePercent = percent(value);
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreHeading}>
        <MaterialCommunityIcons name={icon} size={17} color={colors.muted} />
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={styles.scoreValue}>{valuePercent}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${valuePercent}%` }]} />
      </View>
    </View>
  );
}

function TokenList({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <View style={styles.tokenGroup}>
      <Text style={styles.detailLabel}>{title}</Text>
      <View style={styles.tokenList}>
        {values.map((value, index) => <View key={`${value}-${index}`} style={styles.token}><Text style={styles.tokenText}>{value}</Text></View>)}
      </View>
    </View>
  );
}

function CandidateCard({
  result,
  busy,
  disabled,
  onFeedback,
  onDismiss,
  onClaim,
}: {
  result: MatchCandidateResult;
  busy: boolean;
  disabled: boolean;
  onFeedback: (value: MatchFeedbackValue) => void;
  onDismiss: () => void;
  onClaim: () => void;
}) {
  const tier = tierAppearance[result.scoreTier];
  const explanation = result.explanation;
  const totalPercent = percent(result.totalScore);
  const existingFeedback = result.feedback ? feedbackChoices.find((choice) => choice.value === result.feedback?.value)?.label : null;

  return (
    <Card style={styles.candidateCard}>
      <PostImage post={result.candidate} height={190} borderRadius={radii.control} />
      <View style={styles.candidateHeading}>
        <View style={styles.candidateTitleBlock}>
          <Text style={styles.candidateTitle}>{result.candidate.title}</Text>
          <Text style={styles.candidateMeta}>
            {(result.candidate.category?.name || "Chưa phân loại") + " · " + formatDate(result.candidate.lostFoundAt ?? result.candidate.createdAt)}
          </Text>
          <Text style={styles.candidateLocation} numberOfLines={2}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.muted} /> {locationLabel(result.candidate)}
          </Text>
        </View>
        <View style={styles.scorePill}>
          <Text style={styles.scorePillNumber}>{totalPercent}%</Text>
          <Text style={styles.scorePillCaption}>tương đồng</Text>
        </View>
      </View>

      <View style={[styles.tierBadge, { backgroundColor: tier.background }]}>
        <MaterialCommunityIcons name={tier.icon} size={16} color={tier.color} />
        <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
      </View>

      <View style={styles.sectionDivider} />
      <Text style={styles.sectionTitle}>Phân tích độ tương đồng</Text>
      <View style={styles.scoreList}>
        {scoreLabels.map(({ key, label, icon }) => <ScoreRow key={key} label={label} value={result.scores[key]} icon={icon} />)}
      </View>

      {explanation ? (
        <View style={styles.explanation}>
          <Text style={styles.sectionTitle}>Vì sao hệ thống gợi ý?</Text>
          <Text style={styles.explanationSummary}>{explanation.summary}</Text>
          {explanation.reasons.length > 0 ? explanation.reasons.map((reason, index) => (
            <View style={styles.reasonRow} key={`${reason}-${index}`}>
              <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.success} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          )) : null}
          <TokenList title="Từ khóa trùng nhau" values={explanation.matchedTokens} />
          <TokenList title="Nhãn ảnh trùng nhau" values={explanation.matchedImageTags} />
          <TokenList title="Chữ nhận diện trùng nhau" values={explanation.matchedOcrTokens} />
          {explanation.categoryReason ? <Text style={styles.explanationLine}><Text style={styles.detailLabel}>Danh mục: </Text>{explanation.categoryReason}</Text> : null}
          {explanation.locationReason ? <Text style={styles.explanationLine}><Text style={styles.detailLabel}>Khoảng cách vị trí: </Text>{explanation.locationReason}</Text> : null}
          {explanation.daysDiff !== null ? <Text style={styles.explanationLine}><Text style={styles.detailLabel}>Khoảng cách thời gian: </Text>{explanation.daysDiff} ngày</Text> : null}
          {explanation.penalties.length > 0 ? (
            <View style={styles.penaltyBox}>
              <Text style={styles.penaltyTitle}>Yếu tố làm giảm điểm</Text>
              {explanation.penalties.map((penalty, index) => <Text key={`${penalty}-${index}`} style={styles.penaltyText}>• {penalty}</Text>)}
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.privateNote}>Giải thích chi tiết chưa khả dụng cho gợi ý này.</Text>
      )}

      <View style={styles.sectionDivider} />
      <Text style={styles.feedbackHeading}>{existingFeedback ? `Bạn đã đánh giá: ${existingFeedback}` : "Gợi ý này có hữu ích không?"}</Text>
      <View style={styles.feedbackChoices}>
        {feedbackChoices.map((choice) => {
          const selected = result.feedback?.value === choice.value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="button"
              accessibilityLabel={choice.label}
              accessibilityState={{ disabled: Boolean(disabled || busy || result.feedback), selected }}
              disabled={disabled || busy || Boolean(result.feedback)}
              onPress={() => onFeedback(choice.value)}
              style={({ pressed }) => [styles.feedbackButton, selected && styles.feedbackButtonSelected, (disabled || busy || result.feedback) && !selected && styles.feedbackButtonDisabled, pressed && !disabled && !busy && !result.feedback && styles.pressed]}
            >
              {busy && !result.feedback ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialCommunityIcons name={choice.icon} size={17} color={selected ? colors.primary : colors.ink} />}
              <Text numberOfLines={1} style={[styles.feedbackButtonText, selected && styles.feedbackButtonTextSelected]}>{choice.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actionRow}>
        <Pressable accessibilityRole="button" onPress={onClaim} disabled={disabled || busy} style={({ pressed }) => [styles.claimButton, (disabled || busy) && styles.feedbackButtonDisabled, pressed && !disabled && !busy && styles.pressed]}>
          <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.surface} />
          <Text style={styles.claimButtonText}>Bắt đầu xác minh</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Bỏ qua gợi ý" onPress={onDismiss} disabled={disabled || busy} style={({ pressed }) => [styles.dismissButton, (disabled || busy) && styles.feedbackButtonDisabled, pressed && !disabled && !busy && styles.pressed]}>
          <MaterialCommunityIcons name="eye-off-outline" size={18} color={colors.muted} />
          <Text style={styles.dismissText}>Bỏ qua</Text>
        </Pressable>
      </View>
    </Card>
  );
}

export default function PostMatchesScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const [data, setData] = useState<PostMatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!postId) return;
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      setData(await postService.getMatches(postId));
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

  const recalculate = async () => {
    if (!postId || recalculating) return;
    setRecalculating(true);
    setError(null);
    setNotice(null);
    try {
      setData(await postService.recalculateMatches(postId));
      setNotice("Đã cập nhật danh sách gợi ý mới nhất.");
    } catch (recalculateError) {
      setError(getApiErrorMessage(recalculateError));
    } finally {
      setRecalculating(false);
    }
  };

  const submitFeedback = async (result: MatchCandidateResult, value: MatchFeedbackValue) => {
    if (!postId || busyMatchId) return;
    setBusyMatchId(result.matchId);
    setNotice(null);
    try {
      const feedback = await postService.submitMatchFeedback(postId, result.matchId, value);
      setData((current) => current ? { ...current, results: current.results.map((item) => item.matchId === result.matchId ? { ...item, feedback } : item) } : current);
      setNotice("Cảm ơn bạn đã giúp hệ thống cải thiện gợi ý.");
    } catch (feedbackError) {
      setError(getApiErrorMessage(feedbackError));
    } finally {
      setBusyMatchId(null);
    }
  };

  const dismiss = async (result: MatchCandidateResult) => {
    if (!postId || busyMatchId) return;
    setBusyMatchId(result.matchId);
    setError(null);
    try {
      await postService.dismissMatch(postId, result.matchId);
      setData((current) => current ? { ...current, total: Math.max(0, current.total - 1), results: current.results.filter((item) => item.matchId !== result.matchId) } : current);
      setNotice("Đã bỏ qua gợi ý này.");
    } catch (dismissError) {
      setError(getApiErrorMessage(dismissError));
    } finally {
      setBusyMatchId(null);
    }
  };

  const startClaim = async (candidateId: string) => {
    try {
      const existing = await postService.findConversationByPost(candidateId);
      if (existing?.id) {
        router.push(`/claims/${existing.id}` as never);
        return;
      }
    } catch {
      // Open the claim flow with the selected post when no conversation exists yet.
    }
    router.push(`/claims?composePostId=${encodeURIComponent(candidateId)}` as never);
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><LoadingSpinner label="Đang tải gợi ý ghép đôi…" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.ink} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.topTitle}>Gợi ý ghép đôi</Text>
        <View style={styles.topBarSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
      >
        {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
        {notice ? <View style={styles.notice}><MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.success} /><Text style={styles.noticeText}>{notice}</Text></View> : null}

        {data ? (
          <Card style={styles.sourceCard}>
            <View style={styles.sourceEyebrow}><MaterialCommunityIcons name="creation" size={17} color={colors.primary} /><Text style={styles.eyebrowText}>BÀI ĐANG ĐỐI CHIẾU</Text></View>
            <Text style={styles.sourceTitle}>{data.source.title}</Text>
            <View style={styles.sourceMetaRow}>
              <View style={[styles.typeBadge, data.source.type === "LOST" ? styles.lostType : styles.foundType]}>
                <Text style={[styles.typeBadgeText, { color: data.source.type === "LOST" ? colors.danger : colors.success }]}>{data.source.type === "LOST" ? "BÁO MẤT" : "BÁO NHẶT"}</Text>
              </View>
              <Text style={styles.sourceDate}>Đăng {formatDate(data.source.createdAt)}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => void recalculate()} disabled={recalculating} style={({ pressed }) => [styles.recalculateButton, pressed && !recalculating && styles.pressed]}>
              {recalculating ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialCommunityIcons name="refresh" size={18} color={colors.primary} />}
              <Text style={styles.recalculateText}>{recalculating ? "Đang tính toán…" : "Tính toán lại ghép đôi"}</Text>
            </Pressable>
            {formatDateTime(data.calculatedAt) ? <Text style={styles.calculatedAt}>Cập nhật lúc {formatDateTime(data.calculatedAt)}</Text> : null}
          </Card>
        ) : null}

        <View style={styles.resultsHeading}>
          <View><Text style={styles.sectionHeading}>Ứng viên phù hợp</Text><Text style={styles.resultCount}>{data?.total ?? 0} gợi ý đang hiển thị</Text></View>
          <MaterialCommunityIcons name="tune-variant" size={20} color={colors.muted} />
        </View>
        {data?.results.length ? data.results.map((result) => (
          <CandidateCard
            key={result.matchId}
            result={result}
            busy={busyMatchId === result.matchId}
            disabled={Boolean(busyMatchId)}
            onFeedback={(value) => void submitFeedback(result, value)}
            onDismiss={() => void dismiss(result)}
            onClaim={() => void startClaim(result.candidate.id)}
          />
        )) : data ? (
          <Card style={styles.emptyCard}>
            <EmptyState icon="magnify-close" title="Chưa có gợi ý phù hợp" description="Bạn có thể tính toán lại sau khi hệ thống nhận thêm bài đăng mới." />
          </Card>
        ) : null}
        <Text style={styles.disclaimer}>Điểm tương đồng chỉ là gợi ý để bạn đối chiếu thêm; không xác nhận quyền sở hữu vật phẩm.</Text>
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
  sourceCard: { gap: spacing.md },
  sourceEyebrow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  eyebrowText: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  sourceTitle: { color: colors.ink, fontSize: 21, lineHeight: 27, fontWeight: "800" },
  sourceMetaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  typeBadge: { borderRadius: radii.pill, paddingVertical: 5, paddingHorizontal: 10 },
  lostType: { backgroundColor: colors.dangerSoft },
  foundType: { backgroundColor: colors.successSoft },
  typeBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  sourceDate: { color: colors.muted, fontSize: 13 },
  recalculateButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  recalculateText: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" },
  calculatedAt: { color: colors.muted, fontSize: 12, textAlign: "center" },
  resultsHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  sectionHeading: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  resultCount: { color: colors.muted, fontSize: 13, marginTop: 3 },
  candidateCard: { gap: spacing.md },
  candidateHeading: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  candidateTitleBlock: { flex: 1, gap: spacing.xs },
  candidateTitle: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: "800" },
  candidateMeta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  candidateLocation: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  scorePill: { minWidth: 76, alignItems: "center", justifyContent: "center", borderRadius: 14, padding: 9, backgroundColor: colors.primarySoft },
  scorePillNumber: { color: colors.primaryDark, fontSize: 22, fontWeight: "900" },
  scorePillCaption: { color: colors.primaryDark, fontSize: 10, fontWeight: "700" },
  tierBadge: { alignSelf: "flex-start", minHeight: 30, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: radii.pill },
  tierText: { fontSize: 12, fontWeight: "800" },
  sectionDivider: { height: 1, backgroundColor: colors.border },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  scoreList: { gap: 11 },
  scoreRow: { gap: 6 },
  scoreHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  scoreLabel: { flex: 1, color: colors.ink, fontSize: 13 },
  scoreValue: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  progressTrack: { height: 7, overflow: "hidden", borderRadius: 99, backgroundColor: colors.surfaceMuted },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: colors.primary },
  explanation: { gap: spacing.sm },
  explanationSummary: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  reasonRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
  reasonText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },
  tokenGroup: { gap: spacing.xs, paddingTop: spacing.xs },
  detailLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  tokenList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  token: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  tokenText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  explanationLine: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  penaltyBox: { gap: 5, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.warningSoft },
  penaltyTitle: { color: colors.warning, fontSize: 13, fontWeight: "800" },
  penaltyText: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  privateNote: { color: colors.muted, fontSize: 13, lineHeight: 20, fontStyle: "italic" },
  feedbackHeading: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  feedbackChoices: { flexDirection: "row", gap: 6 },
  feedbackButton: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, backgroundColor: colors.surface },
  feedbackButtonSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  feedbackButtonDisabled: { opacity: 0.55 },
  feedbackButtonText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  feedbackButtonTextSelected: { color: colors.primaryDark },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  claimButton: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, borderRadius: radii.control, backgroundColor: colors.primary },
  claimButtonText: { color: colors.surface, fontSize: 13, fontWeight: "800" },
  dismissButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: spacing.md, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  dismissText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.76 },
  emptyCard: { alignItems: "center" },
  disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: spacing.md },
  notice: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.successSoft },
  noticeText: { flex: 1, color: colors.success, fontSize: 13, fontWeight: "700" },
});
