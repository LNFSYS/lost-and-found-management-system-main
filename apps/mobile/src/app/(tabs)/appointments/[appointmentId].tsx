import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage, returnService, type ReturnFeedbackEligibility } from "@/services/api";

const ratingLabels = ["Rất không hài lòng", "Chưa hài lòng", "Bình thường", "Hài lòng", "Rất hài lòng"];
const reputationDeltas = [-3, -1, 1, 4, 6];

function dateTime(value: string | null) {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa ghi nhận" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function ReturnFeedbackScreen() {
  const { appointmentId, postTitle } = useLocalSearchParams<{ appointmentId: string; postTitle?: string }>();
  const { user } = useAuth();
  const [eligibility, setEligibility] = useState<ReturnFeedbackEligibility | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!appointmentId) return;
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      setEligibility(await returnService.getFeedbackEligibility(appointmentId));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const targetName = useMemo(() => {
    if (!eligibility || !user) return "người tham gia còn lại";
    return eligibility.participants.claimant.id === user.id
      ? eligibility.participants.finder.fullName
      : eligibility.participants.claimant.fullName;
  }, [eligibility, user]);

  const submit = async () => {
    if (!appointmentId || !eligibility?.eligible || rating < 1 || submitting) return;
    if (/[<>]/.test(comment)) {
      setError("Nhận xét không được chứa ký tự < hoặc >.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await returnService.submitFeedback(appointmentId, rating, comment);
      setEligibility((current) => current ? {
        ...current,
        eligible: false,
        reason: "Bạn đã gửi đánh giá cho lần trả đồ này.",
        currentUserFeedback: result.feedback,
      } : current);
      setSuccess(result.reputationEventCreated
        ? `Đã gửi đánh giá cho ${targetName}. Điểm uy tín của họ đã được cập nhật.`
        : `Đánh giá cho ${targetName} đã được xác nhận.`);
      void returnService.getFeedbackEligibility(appointmentId).then(setEligibility).catch(() => undefined);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><LoadingSpinner label="Đang kiểm tra điều kiện đánh giá…" /></SafeAreaView>;

  const existingFeedback = eligibility?.currentUserFeedback;
  const selectedDelta = rating > 0 ? reputationDeltas[rating - 1] : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} hitSlop={8} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.ink} /></Pressable>
        <Text accessibilityRole="header" style={styles.topTitle}>Đánh giá trao trả</Text>
        <View style={styles.topBarSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
        {success ? <View style={styles.successBanner}><MaterialCommunityIcons name="check-circle" size={20} color={colors.success} /><Text style={styles.successText}>{success}</Text></View> : null}

        {eligibility ? (
          <>
            <Card style={styles.summaryCard}>
              <View style={styles.eyebrowRow}><MaterialCommunityIcons name="handshake-outline" size={19} color={colors.primary} /><Text style={styles.eyebrow}>SAU KHI TRAO TRẢ</Text></View>
              <Text style={styles.title}>{postTitle || "Xác nhận trải nghiệm trao trả"}</Text>
              <Text style={styles.dateText}>Hoàn tất lúc {dateTime(eligibility.completedAt)}</Text>
              <View style={styles.personRow}>
                <View style={styles.personIcon}><MaterialCommunityIcons name="account-outline" size={20} color={colors.primary} /></View>
                <View style={styles.personCopy}><Text style={styles.personRole}>Người nhận lại</Text><Text style={styles.personName}>{eligibility.participants.claimant.fullName}</Text></View>
              </View>
              <View style={styles.personRow}>
                <View style={[styles.personIcon, styles.finderIcon]}><MaterialCommunityIcons name="account-search-outline" size={20} color={colors.success} /></View>
                <View style={styles.personCopy}><Text style={styles.personRole}>Người nhặt được</Text><Text style={styles.personName}>{eligibility.participants.finder.fullName}</Text></View>
              </View>
            </Card>

            {existingFeedback ? (
              <Card style={styles.resultCard}>
                <View style={styles.resultHeading}><MaterialCommunityIcons name="star-check-outline" size={22} color={colors.success} /><Text style={styles.resultTitle}>Đánh giá đã gửi</Text></View>
                <View style={styles.starsRow}>
                  {Array.from({ length: 5 }, (_, index) => <MaterialCommunityIcons key={index} name={index < existingFeedback.rating ? "star" : "star-outline"} size={24} color={colors.warning} />)}
                  <Text style={styles.ratingCaption}>{ratingLabels[existingFeedback.rating - 1]}</Text>
                </View>
                {existingFeedback.comment ? <Text style={styles.existingComment}>“{existingFeedback.comment}”</Text> : <Text style={styles.helperText}>Bạn không để lại nhận xét.</Text>}
                <Text style={styles.helperText}>Đánh giá đã góp phần cập nhật điểm uy tín cho người nhận.</Text>
              </Card>
            ) : eligibility.eligible ? (
              <Card style={styles.formCard}>
                <Text style={styles.formTitle}>Bạn đánh giá thế nào về {targetName}?</Text>
                <Text style={styles.helperText}>Đánh giá chỉ dành cho người tham gia lượt trả đồ đã hoàn tất.</Text>
                <View style={styles.ratingControl} accessibilityRole="radiogroup" accessibilityLabel="Chọn số sao">
                  {Array.from({ length: 5 }, (_, index) => {
                    const value = index + 1;
                    const selected = value <= rating;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityLabel={`${value} sao, ${ratingLabels[index]}`}
                        accessibilityState={{ selected }}
                        onPress={() => { setRating(value); setError(null); }}
                        style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}
                      >
                        <MaterialCommunityIcons name={selected ? "star" : "star-outline"} size={36} color={selected ? colors.warning : colors.border} />
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.ratingCaption}>{rating > 0 ? `${rating}/5 · ${ratingLabels[rating - 1]}` : "Chọn từ 1 đến 5 sao"}</Text>
                {selectedDelta !== null ? (
                  <View style={[styles.pointsHint, selectedDelta >= 0 ? styles.positivePoints : styles.negativePoints]}>
                    <MaterialCommunityIcons name="chart-line" size={17} color={selectedDelta >= 0 ? colors.success : colors.danger} />
                    <Text style={[styles.pointsText, selectedDelta >= 0 ? styles.positiveText : styles.negativeText]}>Điểm uy tín của người được đánh giá: {selectedDelta > 0 ? "+" : ""}{selectedDelta}</Text>
                  </View>
                ) : null}
                <Input
                  label="Nhận xét (không bắt buộc)"
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Chia sẻ ngắn về trải nghiệm trao trả…"
                  multiline
                  maxLength={500}
                  error={/[<>]/.test(comment) ? "Không nhập ký tự < hoặc >." : undefined}
                />
                <Text style={styles.characterCount}>{comment.length}/500</Text>
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: rating < 1 || submitting, busy: submitting }} onPress={() => void submit()} disabled={rating < 1 || submitting} style={({ pressed }) => [styles.submitButton, (rating < 1 || submitting) && styles.submitDisabled, pressed && rating > 0 && !submitting && styles.pressed]}>
                  {submitting ? <ActivityIndicator color={colors.surface} /> : <><MaterialCommunityIcons name="send-check-outline" size={18} color={colors.surface} /><Text style={styles.submitText}>Gửi đánh giá</Text></>}
                </Pressable>
                <Text style={styles.privacyNote}>Mỗi người chỉ gửi một đánh giá cho mỗi lần trao trả.</Text>
              </Card>
            ) : (
              <Card style={styles.ineligibleCard}>
                <View style={styles.ineligibleIcon}><MaterialCommunityIcons name="information-outline" size={22} color={colors.warning} /></View>
                <Text style={styles.resultTitle}>Chưa thể gửi đánh giá</Text>
                <Text style={styles.ineligibleText}>{eligibility.reason || "Bạn chưa đủ điều kiện đánh giá lượt trao trả này."}</Text>
              </Card>
            )}
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
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  eyebrow: { color: colors.primary, fontSize: 11, letterSpacing: 0.7, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 20, lineHeight: 27, fontWeight: "900" },
  dateText: { color: colors.muted, fontSize: 13 },
  personRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  personIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primarySoft },
  finderIcon: { backgroundColor: colors.successSoft },
  personCopy: { gap: 3 },
  personRole: { color: colors.muted, fontSize: 12 },
  personName: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  formCard: { gap: spacing.md },
  formTitle: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: "800" },
  helperText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  ratingControl: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, paddingTop: spacing.xs },
  starButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  ratingCaption: { color: colors.warning, fontSize: 13, fontWeight: "800", textAlign: "center" },
  pointsHint: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.control },
  positivePoints: { backgroundColor: colors.successSoft },
  negativePoints: { backgroundColor: colors.dangerSoft },
  pointsText: { fontSize: 12, fontWeight: "700" },
  positiveText: { color: colors.success },
  negativeText: { color: colors.danger },
  characterCount: { color: colors.muted, fontSize: 11, textAlign: "right", marginTop: -spacing.sm },
  submitButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.control, backgroundColor: colors.primary },
  submitDisabled: { opacity: 0.52 },
  submitText: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  privacyNote: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center" },
  resultCard: { gap: spacing.md },
  resultHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  resultTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 2, flexWrap: "wrap" },
  existingComment: { color: colors.ink, fontSize: 14, lineHeight: 21, fontStyle: "italic" },
  ineligibleCard: { gap: spacing.sm, alignItems: "flex-start" },
  ineligibleIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.warningSoft },
  ineligibleText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  successBanner: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.successSoft },
  successText: { flex: 1, color: colors.success, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  pressed: { opacity: 0.75 },
});
