import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { appointmentEventLabels, claimRoleLabels } from "@/constants/labels";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { appointmentService, createRequestUuid, getApiErrorMessage, returnService, type AppointmentAction, type AppointmentRecord, type ReturnFeedbackEligibility, type ReturnFeedbackRecord } from "@/services/api";

const statusLabels: Record<AppointmentRecord["status"], string> = {
  PENDING: "Chờ phản hồi",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
  COMPLETED: "Đã trao trả",
  RESCHEDULED: "Đã đổi lịch",
};
const responseLabels = { PENDING: "Chưa xác nhận", CONFIRMED: "Đã xác nhận", DISPUTED: "Cần đối soát" } as const;
const responseColors = { PENDING: colors.warning, CONFIRMED: colors.success, DISPUTED: colors.danger } as const;
const ratingLabels = ["Rất không hài lòng", "Chưa hài lòng", "Bình thường", "Hài lòng", "Rất hài lòng"];
const reputationDeltas = [-3, -1, 1, 4, 6];

function dateTime(value: string | null | undefined) {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa ghi nhận" : new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function eventLabel(action: string) {
  const labels: Record<string, string> = {
    PROPOSED: "Đề xuất lịch hẹn", ACCEPT: "Chấp nhận lịch hẹn", REJECT: "Từ chối lịch hẹn", CANCEL: "Hủy lịch hẹn",
    FINDER_CONFIRM: `${claimRoleLabels.FINDER} xác nhận đã giao`, OWNER_CONFIRM: "Người nhận xác nhận đã nhận", FINDER_DISPUTE: `${claimRoleLabels.FINDER} yêu cầu đối soát`,
    OWNER_DISPUTE: "Người nhận yêu cầu đối soát", NO_SHOW: appointmentEventLabels.NO_SHOW, RETURN_COMPLETED: "Hoàn tất trao trả", REMINDER_QUEUED: "Đã tạo nhắc lịch",
  };
  return labels[action] ?? action.toLowerCase().replaceAll("_", " ");
}

export default function AppointmentDetailScreen() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const { user } = useAuth();
  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null);
  const [eligibility, setEligibility] = useState<ReturnFeedbackEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkedItem, setCheckedItem] = useState(false);
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const actionKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const feedbackKey = useRef<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!appointmentId) return;
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      const result = await appointmentService.get(appointmentId);
      setAppointment(result);
      if (result.status === "COMPLETED") {
        const feedbackResult = await returnService.getFeedbackEligibility(appointmentId).catch(() => null);
        setEligibility(feedbackResult);
      } else {
        setEligibility(null);
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const act = async (action: AppointmentAction) => {
    if (!appointment || busy) return;
    if (action === "CANCEL" && reason.trim().length < 3) { setError("Nhập lý do hủy lịch (ít nhất 3 ký tự)."); return; }
    if (action === "CONFIRM" && !checkedItem) { setError("Xác nhận sau khi đã trực tiếp đối chiếu đúng vật phẩm."); return; }
    const fingerprint = JSON.stringify([appointment.id, action, appointment.version, checkedItem, reason.trim()]);
    if (actionKey.current?.fingerprint !== fingerprint) actionKey.current = { fingerprint, key: createRequestUuid() };
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await appointmentService.act(appointment.id, {
        action,
        version: appointment.version,
        requestKey: actionKey.current.key,
        physicallyChecked: action === "CONFIRM" ? checkedItem : undefined,
        reason: reason.trim() || undefined,
      });
      actionKey.current = null;
      setAppointment(updated);
      setCheckedItem(false);
      if (updated.status === "COMPLETED") {
        setEligibility(await returnService.getFeedbackEligibility(updated.id).catch(() => null));
        setNotice("Cả hai bên đã xác nhận hoàn tất trao trả.");
      } else if (action === "CONFIRM") {
        setNotice("Đã ghi nhận xác nhận của bạn. Đang chờ bên còn lại xác nhận.");
      } else {
        setNotice("Trạng thái lịch hẹn đã được cập nhật.");
      }
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setBusy(false);
    }
  };

  const submitFeedback = async () => {
    if (!appointmentId || !eligibility?.eligible || rating < 1 || sendingFeedback) return;
    if (/[<>]/.test(comment)) { setError("Nhận xét không được chứa ký tự < hoặc >."); return; }
    feedbackKey.current ??= createRequestUuid();
    setSendingFeedback(true);
    setError(null);
    setNotice(null);
    try {
      const result = await returnService.submitFeedback(appointmentId, rating, comment);
      feedbackKey.current = null;
      const feedbackRecord = result.feedback as ReturnFeedbackRecord;
      setEligibility((current) => current ? { ...current, eligible: false, currentUserFeedback: feedbackRecord } : current);
      setNotice(result.reputationEventCreated ? "Đã gửi đánh giá và cập nhật điểm uy tín." : "Đánh giá đã được ghi nhận.");
    } catch (feedbackError) {
      setError(getApiErrorMessage(feedbackError));
    } finally {
      setSendingFeedback(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><LoadingSpinner label="Đang tải lịch bàn giao…" /></SafeAreaView>;
  if (!appointment) return <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}><View style={styles.missing}><ErrorBanner message={error ?? "Không tìm thấy lịch hẹn."} onRetry={() => void load()} /><Button title="Quay lại lịch hẹn" variant="secondary" onPress={() => router.replace("/appointments" as never)} /></View></SafeAreaView>;

  const finder = appointment.finderId === user?.id;
  const ownResponse = finder ? appointment.finderResponse : appointment.ownerResponse;
  const otherResponse = finder ? appointment.ownerResponse : appointment.finderResponse;
  const ended = ["COMPLETED", "CANCELLED", "REJECTED"].includes(appointment.status);
  const proposedTime = new Date(appointment.proposedAt).getTime();
  const occurred = proposedTime <= now;
  const canCancel = (appointment.finderResponse === "PENDING" && appointment.ownerResponse === "PENDING") || (appointment.finderResponse === "DISPUTED" && appointment.ownerResponse === "DISPUTED");
  const canNoShow = occurred && now >= proposedTime + 15 * 60_000 && ownResponse === "CONFIRMED" && otherResponse === "PENDING";
  const feedbackRecord = eligibility?.currentUserFeedback;
  const selectedDelta = rating > 0 ? reputationDeltas[rating - 1] : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại lịch hẹn" onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.ink} /></Pressable>
        <Text accessibilityRole="header" style={styles.topTitle}>Chi tiết lịch hẹn</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Tải lại lịch hẹn" onPress={() => void load(true)} style={styles.refreshButton}><MaterialCommunityIcons name="refresh" size={19} color={colors.primary} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
        {notice ? <View style={styles.notice}><MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.success} /><Text style={styles.noticeText}>{notice}</Text></View> : null}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryTop}><View style={styles.calendarIcon}><MaterialCommunityIcons name="calendar-check-outline" size={22} color={colors.primary} /></View><View style={styles.summaryCopy}><View style={[styles.statusPill, statusTones[appointment.status]]}><Text style={[styles.statusText, statusToneText[appointment.status]]}>{statusLabels[appointment.status]}</Text></View><Text style={styles.title}>{appointment.title}</Text></View></View>
          <View style={styles.detailRow}><MaterialCommunityIcons name="calendar-clock-outline" size={19} color={colors.primary} /><View style={styles.detailCopy}><Text style={styles.detailLabel}>Thời gian dự kiến</Text><Text style={styles.detailValue}>{dateTime(appointment.proposedAt)}</Text></View></View>
          <View style={styles.detailRow}><MaterialCommunityIcons name="map-marker-radius-outline" size={19} color={colors.primary} /><View style={styles.detailCopy}><Text style={styles.detailLabel}>Điểm bàn giao</Text><Text style={styles.detailValue}>{appointment.location ?? "Chưa ghi nhận địa điểm"}</Text></View></View>
          <View style={styles.responses}>
            <View style={styles.responseCard}><Text style={styles.responseRole}>{claimRoleLabels.FINDER}</Text><Text style={[styles.responseStatus, { color: responseColors[appointment.finderResponse] }]}>{responseLabels[appointment.finderResponse]}</Text></View>
            <View style={styles.responseCard}><Text style={styles.responseRole}>{claimRoleLabels.CLAIMANT}</Text><Text style={[styles.responseStatus, { color: responseColors[appointment.ownerResponse] }]}>{responseLabels[appointment.ownerResponse]}</Text></View>
          </View>
          {appointment.completedAt ? <View style={styles.infoSuccess}><MaterialCommunityIcons name="check-decagram-outline" size={19} color={colors.success} /><Text style={styles.infoSuccessText}>Hoàn tất lúc {dateTime(appointment.completedAt)}</Text></View> : null}
          {appointment.noShowUserId ? <View style={styles.infoWarning}><MaterialCommunityIcons name="account-alert-outline" size={19} color={colors.warning} /><Text style={styles.infoWarningText}>Đã ghi nhận báo vắng mặt. Đây không tự động xác nhận trao trả hoặc xử phạt.</Text></View> : null}
          {appointment.custodyAuthorized ? <View style={styles.infoSuccess}><MaterialCommunityIcons name="warehouse" size={19} color={colors.success} /><Text style={styles.infoSuccessText}>Lượt bàn giao này do nhân viên kho quản lý tại quầy.</Text></View> : null}
        </Card>

        {!ended && !appointment.custodyAuthorized ? <Card style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Thao tác</Text>
          {appointment.status === "PENDING" && appointment.proposerId !== user?.id ? <>
            <Text style={styles.helperText}>Bạn nhận được đề xuất này. Hãy kiểm tra địa điểm và thời gian trước khi phản hồi.</Text>
            <Button title="Chấp nhận lịch hẹn" onPress={() => void act("ACCEPT")} loading={busy} />
            <Button title="Từ chối lịch" variant="secondary" onPress={() => void act("REJECT")} disabled={busy} />
          </> : null}
          {appointment.status === "PENDING" && appointment.proposerId === user?.id ? <View style={styles.waiting}><MaterialCommunityIcons name="clock-outline" size={18} color={colors.warning} /><Text style={styles.helperText}>Đang chờ bên còn lại phản hồi đề xuất.</Text></View> : null}
          {appointment.status === "ACCEPTED" ? <>
            {otherResponse === "DISPUTED" ? <View style={styles.infoWarning}><MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={[styles.infoWarningText, { color: colors.danger }]}>Bên còn lại yêu cầu đối soát. Chưa bên nào được tính là đã trả hoặc nhận đồ.</Text></View> : null}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: checkedItem }} onPress={() => setCheckedItem((value) => !value)} style={styles.checkRow}><MaterialCommunityIcons name={checkedItem ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={checkedItem ? colors.primary : colors.muted} /><Text style={styles.checkText}>{finder ? "Tôi đã trực tiếp đối chiếu và giao đúng vật phẩm cho người nhận." : "Tôi đã trực tiếp đối chiếu và nhận đúng vật phẩm."}</Text></Pressable>
            {ownResponse === "CONFIRMED" ? <View style={styles.infoSuccess}><MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.success} /><Text style={styles.infoSuccessText}>Bạn đã xác nhận. Đang chờ bên còn lại xác nhận hoàn tất.</Text></View> : null}
            <Button title={finder ? "Xác nhận đã giao đồ" : "Xác nhận đã nhận đồ"} onPress={() => void act("CONFIRM")} loading={busy} disabled={!occurred || !checkedItem || ownResponse === "CONFIRMED"} />
            <Button title="Báo cần đối soát" variant="secondary" onPress={() => void act("DISPUTE")} disabled={busy || !occurred} />
            <Button title="Báo bên còn lại không đến" variant="danger" onPress={() => void act("NO_SHOW")} disabled={busy || !canNoShow} />
            {!occurred ? <Text style={styles.helperText}>Xác nhận hoặc báo vắng mặt chỉ khả dụng khi đến thời gian hẹn.</Text> : canNoShow ? <Text style={styles.helperText}>Báo vắng mặt chỉ ghi nhận sự việc; trạng thái trao trả không tự hoàn tất.</Text> : null}
          </> : null}
          {canCancel ? <>
            <Input label="Lý do hủy hoặc ghi chú đối soát" value={reason} onChangeText={setReason} multiline maxLength={500} placeholder="Nhập lý do (ít nhất 3 ký tự)…" />
            <Button title="Hủy lịch hẹn" variant="danger" onPress={() => void act("CANCEL")} loading={busy} disabled={reason.trim().length < 3} />
          </> : null}
          {ownResponse !== "PENDING" && appointment.status === "ACCEPTED" ? <Text style={styles.helperText}>Đổi thời gian bằng cách hủy lịch khi đủ điều kiện, sau đó đề xuất lịch mới trong cuộc trao đổi.</Text> : null}
        </Card> : null}

        {appointment.status === "CANCELLED" || appointment.status === "REJECTED" ? <Card style={styles.rescheduleCard}><MaterialCommunityIcons name="calendar-refresh-outline" size={21} color={colors.primary} /><View style={styles.summaryCopy}><Text style={styles.rescheduleTitle}>Cần thời gian khác?</Text><Text style={styles.helperText}>Mở yêu cầu nhận lại đồ để đề xuất lịch hẹn mới tại một điểm bàn giao an toàn.</Text></View><Button title="Đề xuất lịch khác" variant="secondary" onPress={() => router.push(`/appointments?claimId=${encodeURIComponent(appointment.claimId)}` as never)} /></Card> : null}

        {appointment.status === "COMPLETED" ? <Card style={styles.feedbackCard}>
          <View style={styles.feedbackHeading}><View style={styles.feedbackIcon}><MaterialCommunityIcons name="star-check-outline" size={21} color={colors.warning} /></View><View style={styles.summaryCopy}><Text style={styles.sectionTitle}>Đánh giá sau trao trả</Text><Text style={styles.helperText}>Chia sẻ trải nghiệm và cập nhật điểm uy tín cho bên còn lại.</Text></View></View>
          {!eligibility ? <View style={styles.waiting}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.helperText}>Đang kiểm tra điều kiện đánh giá…</Text></View> : null}
          {feedbackRecord ? <View style={styles.reviewedBox}><Text style={styles.responseStatus}>Đánh giá đã gửi</Text><View style={styles.starsRow}>{Array.from({ length: 5 }, (_, index) => <MaterialCommunityIcons key={index} name={index < feedbackRecord.rating ? "star" : "star-outline"} size={19} color={colors.warning} />)}<Text style={styles.ratingLabel}>{ratingLabels[feedbackRecord.rating - 1]}</Text></View>{feedbackRecord.comment ? <Text style={styles.commentText}>“{feedbackRecord.comment}”</Text> : null}</View> : eligibility?.eligible ? <>
            <Text style={styles.feedbackQuestion}>Bạn đánh giá thế nào về {eligibility.participants.claimant.id === user?.id ? eligibility.participants.finder.fullName : eligibility.participants.claimant.fullName}?</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Chọn số sao" style={styles.starsRow}>{Array.from({ length: 5 }, (_, index) => { const value = index + 1; return <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} sao, ${ratingLabels[index]}`} accessibilityState={{ selected: rating === value }} onPress={() => setRating(value)} style={styles.starButton}><MaterialCommunityIcons name={rating >= value ? "star" : "star-outline"} size={31} color={rating >= value ? colors.warning : colors.border} /></Pressable>; })}</View>
            {rating > 0 ? <Text style={styles.ratingLabel}>{rating}/5 · {ratingLabels[rating - 1]}</Text> : null}
            {selectedDelta !== null ? <View style={styles.pointsHint}><MaterialCommunityIcons name="chart-line" size={17} color={selectedDelta >= 0 ? colors.success : colors.danger} /><Text style={[styles.pointsText, { color: selectedDelta >= 0 ? colors.success : colors.danger }]}>Điểm uy tín dự kiến: {selectedDelta > 0 ? "+" : ""}{selectedDelta}</Text></View> : null}
            <Input label="Nhận xét (không bắt buộc)" value={comment} onChangeText={setComment} multiline maxLength={500} placeholder="Chia sẻ ngắn về trải nghiệm trao trả…" error={/[<>]/.test(comment) ? "Không nhập ký tự < hoặc >." : undefined} />
            <Button title="Gửi đánh giá" onPress={() => void submitFeedback()} loading={sendingFeedback} disabled={rating < 1 || /[<>]/.test(comment)} />
          </> : eligibility ? <View style={styles.infoWarning}><MaterialCommunityIcons name="information-outline" size={18} color={colors.warning} /><Text style={styles.infoWarningText}>{eligibility.reason ?? "Bạn chưa đủ điều kiện đánh giá lượt trao trả này."}</Text></View> : null}
        </Card> : null}

        <Card style={styles.chatLinkCard}><View style={styles.chatLinkIcon}><MaterialCommunityIcons name="message-text-outline" size={20} color={colors.primary} /></View><View style={styles.summaryCopy}><Text style={styles.chatLinkTitle}>Trao đổi về lần bàn giao</Text><Text style={styles.helperText}>Mở phòng chat và xác minh của yêu cầu này.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Mở phòng chat" onPress={() => router.push(`/claims/${appointment.claimId}` as never)} style={styles.chatLinkButton}><MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary} /></Pressable></Card>

        <Card style={styles.historyCard}><Text style={styles.sectionTitle}>Nhật ký lịch hẹn</Text>{appointment.events.length ? appointment.events.map((event, index) => <View key={event.id} style={styles.eventRow}><View style={styles.eventRail}><View style={[styles.eventDot, index === 0 && styles.eventDotFirst]}>{index === 0 ? <MaterialCommunityIcons name="calendar-check" size={12} color={colors.surface} /> : null}</View>{index < appointment.events.length - 1 ? <View style={styles.eventLine} /> : null}</View><View style={styles.eventCopy}><Text style={styles.eventTitle}>{eventLabel(event.action)}</Text><Text style={styles.eventTime}>{dateTime(event.createdAt)}</Text>{event.note ? <Text style={styles.eventNote}>{event.note}</Text> : null}</View></View>) : <Text style={styles.helperText}>Chưa có cập nhật.</Text>}</Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const statusTones: Record<AppointmentRecord["status"], object> = {
  PENDING: { backgroundColor: colors.warningSoft }, ACCEPTED: { backgroundColor: colors.successSoft }, REJECTED: { backgroundColor: colors.dangerSoft }, CANCELLED: { backgroundColor: colors.neutralSoft }, COMPLETED: { backgroundColor: colors.successSoft }, RESCHEDULED: { backgroundColor: colors.primarySoft },
};
const statusToneText: Record<AppointmentRecord["status"], object> = {
  PENDING: { color: colors.warning }, ACCEPTED: { color: colors.success }, REJECTED: { color: colors.danger }, CANCELLED: { color: colors.neutral }, COMPLETED: { color: colors.success }, RESCHEDULED: { color: colors.primary },
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, topBar: { minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }, backButton: { width: 42, height: 44, justifyContent: "center" }, topTitle: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: "900" }, refreshButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, content: { width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl },
  summaryCard: { gap: spacing.md }, summaryTop: { flexDirection: "row", alignItems: "center", gap: spacing.md }, calendarIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.primarySoft }, summaryCopy: { flex: 1, gap: 3 }, statusPill: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill }, statusText: { fontSize: 10, fontWeight: "900" }, title: { color: colors.ink, fontSize: 19, lineHeight: 26, fontWeight: "900", marginTop: 3 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md }, detailCopy: { flex: 1, gap: 3 }, detailLabel: { color: colors.muted, fontSize: 12 }, detailValue: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "700" }, responses: { flexDirection: "row", gap: spacing.sm }, responseCard: { flex: 1, minHeight: 68, justifyContent: "center", gap: 5, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, responseRole: { color: colors.muted, fontSize: 11 }, responseStatus: { fontSize: 12, fontWeight: "900" }, infoSuccess: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.successSoft }, infoSuccessText: { flex: 1, color: colors.success, fontSize: 12, lineHeight: 17, fontWeight: "700" }, infoWarning: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.warningSoft }, infoWarningText: { flex: 1, color: colors.warning, fontSize: 12, lineHeight: 17 },
  actionsCard: { gap: spacing.sm }, sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" }, helperText: { color: colors.muted, fontSize: 12, lineHeight: 18 }, waiting: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm }, checkRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, checkText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: "600" }, rescheduleCard: { gap: spacing.md }, rescheduleTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  feedbackCard: { gap: spacing.md }, feedbackHeading: { flexDirection: "row", alignItems: "center", gap: spacing.md }, feedbackIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.warningSoft }, feedbackQuestion: { color: colors.ink, fontSize: 14, fontWeight: "800" }, starsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, flexWrap: "wrap" }, starButton: { width: 42, height: 44, alignItems: "center", justifyContent: "center" }, ratingLabel: { color: colors.warning, fontSize: 12, fontWeight: "900", textAlign: "center" }, pointsHint: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: colors.successSoft }, pointsText: { fontSize: 12, fontWeight: "800" }, reviewedBox: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.successSoft }, commentText: { color: colors.ink, fontSize: 13, lineHeight: 19, fontStyle: "italic" },
  chatLinkCard: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: spacing.md }, chatLinkIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.primarySoft }, chatLinkTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" }, chatLinkButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, historyCard: { gap: spacing.md }, eventRow: { minHeight: 52, flexDirection: "row", gap: spacing.sm }, eventRail: { width: 22, alignItems: "center" }, eventDot: { zIndex: 1, width: 16, height: 16, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface }, eventDotFirst: { borderColor: colors.primary, backgroundColor: colors.primary }, eventLine: { position: "absolute", top: 15, bottom: -5, width: 2, backgroundColor: colors.border }, eventCopy: { flex: 1, paddingBottom: spacing.md }, eventTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" }, eventTime: { color: colors.muted, fontSize: 11, marginTop: 3 }, eventNote: { color: colors.muted, fontSize: 12, marginTop: 4 }, notice: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.successSoft }, noticeText: { color: colors.success, flex: 1, fontSize: 12, fontWeight: "700" }, missing: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg },
});
