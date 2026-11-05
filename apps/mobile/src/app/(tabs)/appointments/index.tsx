import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SecureImage } from "@/components/secure-image";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { appointmentService, claimService, createRequestUuid, getApiErrorMessage, returnService, type AppointmentRecord, type ClaimRecord, type CompletedReturn, type PublicHandoverPoint } from "@/services/api";

const appointmentLabels: Record<AppointmentRecord["status"], string> = {
  PENDING: "Chờ phản hồi",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
  COMPLETED: "Đã trao trả",
  RESCHEDULED: "Đã đổi lịch",
};

const appointmentTones: Record<AppointmentRecord["status"], { color: string; background: string }> = {
  PENDING: { color: colors.warning, background: colors.warningSoft },
  ACCEPTED: { color: colors.success, background: colors.successSoft },
  REJECTED: { color: colors.danger, background: colors.dangerSoft },
  CANCELLED: { color: colors.neutral, background: colors.neutralSoft },
  COMPLETED: { color: colors.success, background: colors.successSoft },
  RESCHEDULED: { color: colors.primary, background: colors.primarySoft },
};

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa xác định" : new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function activeAppointment(status: AppointmentRecord["status"]) {
  return status === "PENDING" || status === "ACCEPTED" || status === "RESCHEDULED";
}

function AppointmentCard({ appointment, userId }: { appointment: AppointmentRecord; userId?: string }) {
  const tone = appointmentTones[appointment.status];
  return <Pressable accessibilityRole="button" onPress={() => router.push(`/appointments/${appointment.id}` as never)} style={({ pressed }) => pressed && styles.pressed}>
    <Card style={styles.appointmentCard}>
      <View style={styles.appointmentTop}>
        {appointment.itemImageUrl ? <SecureImage url={appointment.itemImageUrl} style={styles.itemThumb} accessibilityLabel={`Ảnh ${appointment.title}`} /> : <View style={styles.thumbPlaceholder}><MaterialCommunityIcons name="package-variant-closed" size={20} color={colors.primary} /></View>}
        <View style={styles.cardCopy}>
          <Text numberOfLines={2} style={styles.itemTitle}>{appointment.title}</Text>
          <Text style={styles.dateText}>{displayDate(appointment.proposedAt)}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={21} color={colors.muted} />
      </View>
      <View style={styles.appointmentFooter}>
        <View style={[styles.statusPill, { backgroundColor: tone.background }]}><Text style={[styles.statusText, { color: tone.color }]}>{appointmentLabels[appointment.status]}</Text></View>
        <Text numberOfLines={1} style={styles.locationText}><MaterialCommunityIcons name="map-marker-outline" size={13} color={colors.muted} /> {appointment.location || "Chưa chọn điểm hẹn"}</Text>
      </View>
      <Text style={styles.roleNote}>{appointment.finderId === userId ? "Bạn là người nhặt" : "Bạn là người nhận"} · {appointment.finderResponse === "CONFIRMED" ? "Finder đã xác nhận" : appointment.finderResponse === "DISPUTED" ? "Finder yêu cầu đối soát" : "Finder chưa xác nhận"} · {appointment.ownerResponse === "CONFIRMED" ? "Người nhận đã xác nhận" : appointment.ownerResponse === "DISPUTED" ? "Người nhận yêu cầu đối soát" : "Người nhận chưa xác nhận"}</Text>
    </Card>
  </Pressable>;
}

function CompletedReturnCard({ item }: { item: CompletedReturn }) {
  return <Pressable accessibilityRole="button" onPress={() => router.push(`/appointments/${item.id}?feedback=1` as never)} style={({ pressed }) => pressed && styles.pressed}>
    <Card style={styles.completedCard}>
      <View style={[styles.completedIcon, item.rating === null ? styles.pendingIcon : styles.ratedIcon]}><MaterialCommunityIcons name={item.rating === null ? "star-outline" : "star-check-outline"} size={19} color={item.rating === null ? colors.warning : colors.success} /></View>
      <View style={styles.cardCopy}><Text numberOfLines={2} style={styles.itemTitle}>{item.postTitle}</Text><Text style={styles.dateText}>Hoàn tất {displayDate(item.completedAt)}</Text></View>
      {item.rating === null ? <Text style={styles.rateAction}>Đánh giá</Text> : <View style={styles.smallStars}>{Array.from({ length: 5 }, (_, index) => <MaterialCommunityIcons key={index} name={index < item.rating! ? "star" : "star-outline"} size={15} color={colors.warning} />)}</View>}
    </Card>
  </Pressable>;
}

export default function AppointmentsScreen() {
  const { user } = useAuth();
  const { claimId: rawClaimId } = useLocalSearchParams<{ claimId?: string }>();
  const claimId = typeof rawClaimId === "string" ? rawClaimId : undefined;
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [completed, setCompleted] = useState<CompletedReturn[]>([]);
  const [claim, setClaim] = useState<ClaimRecord | null>(null);
  const [points, setPoints] = useState<PublicHandoverPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState("");
  const [proposedAt, setProposedAt] = useState<Date | null>(null);
  const [pickerMode, setPickerMode] = useState<"date" | "time" | "datetime" | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      const [appointmentResult, returnResult] = await Promise.all([
        appointmentService.list({ claimId, page: 1 }),
        returnService.listCompleted(1),
      ]);
      setAppointments(appointmentResult.results);
      setTotal(appointmentResult.total);
      setPage(1);
      setHasMore(appointmentResult.total > appointmentResult.results.length);
      setCompleted(returnResult.items);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [claimId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let active = true;
    if (!claimId) { setClaim(null); return () => { active = false; }; }
    setLoadingPoints(true);
    void Promise.all([appointmentService.listHandoverPoints(), claimService.get(claimId)])
      .then(([result, claimResult]) => {
        if (!active) return;
        const usable = result.handoverPoints;
        setPoints(usable);
        setSelectedPoint((current) => current || usable[0]?.id || "");
        setClaim(claimResult);
      })
      .catch((pointError) => { if (active) setError(getApiErrorMessage(pointError)); })
      .finally(() => { if (active) setLoadingPoints(false); });
    return () => { active = false; };
  }, [claimId]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await appointmentService.list({ claimId, page: nextPage });
      setAppointments((current) => [...current, ...result.results.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setPage(nextPage);
      setHasMore(nextPage * 20 < total);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoadingMore(false);
    }
  };

  const onDateTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "dismissed") { setPickerMode(null); return; }
    if (!selected) return;
    const base = proposedAt ?? new Date(Date.now() + 60 * 60 * 1000);
    if (Platform.OS === "android" && pickerMode === "date") {
      const combined = new Date(selected); combined.setHours(base.getHours(), base.getMinutes(), 0, 0); setProposedAt(combined); setPickerMode("time"); return;
    }
    if (Platform.OS === "android" && pickerMode === "time") {
      const combined = new Date(base); combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0); setProposedAt(combined); setPickerMode(null); return;
    }
    setProposedAt(selected);
  };

  const createAppointment = async () => {
    if (!claimId || !claim || !proposedAt || !selectedPoint || creating) return;
    if (proposedAt.getTime() <= Date.now()) { setError("Chọn thời gian hẹn trong tương lai."); return; }
    if (!claim.appointmentEligible) { setError("Finder chưa xác nhận đủ điều kiện để đề xuất lịch gặp."); return; }
    setCreating(true);
    setError(null);
    requestKey.current ??= createRequestUuid();
    try {
      const created = await appointmentService.create({ claimId, proposedAt: proposedAt.toISOString(), handoverPointId: selectedPoint, requestKey: requestKey.current });
      requestKey.current = null;
      router.push(`/appointments/${created.id}` as never);
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><LoadingSpinner label="Đang tải lịch hẹn…" /></SafeAreaView>;
  const hasActive = appointments.some((item) => activeAppointment(item.status));

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerIcon}><MaterialCommunityIcons name="calendar-check-outline" size={23} color={colors.primary} /></View>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>BÀN GIAO TRỰC TIẾP</Text><Text accessibilityRole="header" style={styles.title}>Lịch hẹn</Text><Text style={styles.description}>Chọn điểm gặp an toàn trong campus và cùng xác nhận khi trao trả xong.</Text></View>
        </View>
        {error ? <ErrorBanner message={error} onRetry={() => void load(true)} /> : null}
        {claimId && claim ? <Card style={styles.proposalCard}>
          <View style={styles.proposalHeading}><View style={styles.proposalIcon}><MaterialCommunityIcons name="calendar-plus" size={20} color={colors.primary} /></View><View style={styles.headerCopy}><Text style={styles.proposalTitle}>Đề xuất lịch bàn giao</Text><Text style={styles.proposalSubtitle}>{claim.item?.title ?? claim.posts.found.title}</Text></View></View>
          {!claim.appointmentEligible ? <View style={styles.infoBox}><MaterialCommunityIcons name="lock-outline" size={18} color={colors.warning} /><Text style={styles.infoText}>Chỉ đề xuất lịch khi Finder đã chọn gặp mặt xác minh.</Text></View> : null}
          {hasActive ? <View style={styles.infoBox}><MaterialCommunityIcons name="calendar-alert" size={18} color={colors.warning} /><Text style={styles.infoText}>Đã có lịch đang chờ xử lý cho yêu cầu này. Mở lịch hiện tại để phản hồi hoặc đề xuất lại sau khi lịch kết thúc.</Text></View> : <>
            <Text style={styles.fieldLabel}>Thời gian gặp</Text>
            <Pressable accessibilityRole="button" onPress={() => setPickerMode(Platform.OS === "ios" ? "datetime" : "date")} style={styles.dateButton}><MaterialCommunityIcons name="calendar-clock-outline" size={19} color={colors.primary} /><Text style={styles.dateButtonText}>{proposedAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "full", timeStyle: "short" }).format(proposedAt) : "Chọn ngày và giờ"}</Text></Pressable>
            {pickerMode ? <View style={styles.pickerPanel}><DateTimePicker value={proposedAt ?? new Date(Date.now() + 60 * 60 * 1000)} mode={Platform.OS === "ios" ? "datetime" : pickerMode === "time" ? "time" : "date"} minimumDate={new Date()} display={Platform.OS === "ios" ? "spinner" : "default"} onChange={onDateTimeChange} />{Platform.OS === "ios" ? <Button title="Xong" variant="secondary" onPress={() => setPickerMode(null)} /> : null}</View> : null}
            <Text style={styles.fieldLabel}>Điểm bàn giao an toàn</Text>
            {loadingPoints ? <ActivityIndicator color={colors.primary} /> : <View style={styles.pointsList}>{points.map((point) => <Pressable key={point.id} accessibilityRole="radio" accessibilityState={{ selected: selectedPoint === point.id }} onPress={() => setSelectedPoint(point.id)} style={[styles.pointCard, selectedPoint === point.id && styles.pointCardSelected]}><MaterialCommunityIcons name={selectedPoint === point.id ? "radiobox-marked" : "radiobox-blank"} size={20} color={selectedPoint === point.id ? colors.primary : colors.muted} /><View style={styles.headerCopy}><Text style={styles.pointName}>{point.name}</Text><Text style={styles.pointAddress}>{point.address ?? "Điểm bàn giao được trường quản lý"}</Text></View></Pressable>)}</View>}
            {points.length === 0 && !loadingPoints ? <Text style={styles.muted}>Chưa có điểm bàn giao khả dụng. Hãy thử tải lại sau.</Text> : null}
            <Button title="Gửi đề xuất lịch" onPress={() => void createAppointment()} loading={creating} disabled={!claim.appointmentEligible || !proposedAt || !selectedPoint || !points.length} />
          </>}
        </Card> : null}
        {claimId && !claim && !loadingPoints ? <Card style={styles.infoBox}><MaterialCommunityIcons name="information-outline" size={18} color={colors.warning} /><Text style={styles.infoText}>Không tải được yêu cầu để đề xuất lịch. Mở lại từ phòng chat.</Text></Card> : null}

        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>{claimId ? "Lịch của yêu cầu này" : "Lịch đang xử lý"}</Text><Text style={styles.sectionSubtitle}>{total} lịch hẹn · phản hồi của Finder và người nhận</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Tải lại lịch hẹn" onPress={() => void load(true)} style={styles.refreshButton}><MaterialCommunityIcons name="refresh" size={19} color={colors.primary} /></Pressable></View>
        {appointments.length ? <View style={styles.list}>{appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} userId={user?.id} />)}</View> : !error ? <Card style={styles.emptyCard}><EmptyState icon="calendar-blank-outline" title="Chưa có lịch hẹn" description={claimId ? "Sau khi Finder chấp thuận gặp mặt, bạn có thể đề xuất một điểm bàn giao an toàn." : "Các lịch gặp và trạng thái xác nhận hai bên sẽ xuất hiện ở đây."} /></Card> : null}
        {hasMore ? <Button title="Tải thêm lịch" variant="secondary" loading={loadingMore} onPress={() => void loadMore()} /> : null}

        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Đánh giá sau trao trả</Text><Text style={styles.sectionSubtitle}>Đánh giá chỉ khả dụng sau khi lượt trả đồ hoàn tất</Text></View></View>
        {completed.length ? <View style={styles.list}>{completed.map((item) => <CompletedReturnCard key={item.id} item={item} />)}</View> : <Card style={styles.emptyCard}><EmptyState icon="star-outline" title="Chưa có lượt trao trả hoàn tất" description="Lịch đã được hai bên xác nhận sẽ hiện tại đây để gửi đánh giá." /></Card>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.sm }, headerIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: colors.primarySoft }, headerCopy: { flex: 1, gap: 3 }, eyebrow: { color: colors.primary, fontSize: 10, letterSpacing: 0.8, fontWeight: "900" }, title: { color: colors.ink, fontSize: 23, fontWeight: "900" }, description: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  proposalCard: { gap: spacing.md }, proposalHeading: { flexDirection: "row", alignItems: "center", gap: spacing.md }, proposalIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primarySoft }, proposalTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" }, proposalSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  infoBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.warningSoft }, infoText: { flex: 1, color: colors.warning, fontSize: 12, lineHeight: 18 }, fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" }, dateButton: { minHeight: 48, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, backgroundColor: colors.surface }, dateButtonText: { color: colors.ink, fontSize: 13, flex: 1 }, pickerPanel: { padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.surfaceMuted, gap: spacing.sm }, pointsList: { gap: spacing.xs }, pointCard: { minHeight: 58, padding: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, backgroundColor: colors.surface }, pointCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, pointName: { color: colors.ink, fontSize: 13, fontWeight: "800" }, pointAddress: { color: colors.muted, fontSize: 11, marginTop: 2 }, muted: { color: colors.muted, fontSize: 12 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" }, sectionSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 }, refreshButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  list: { gap: spacing.sm }, appointmentCard: { gap: spacing.md }, appointmentTop: { flexDirection: "row", alignItems: "center", gap: spacing.md }, itemThumb: { width: 62, height: 62, borderRadius: 14, backgroundColor: colors.surfaceMuted }, thumbPlaceholder: { width: 62, height: 62, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primarySoft }, cardCopy: { flex: 1, gap: 4 }, itemTitle: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: "800" }, dateText: { color: colors.muted, fontSize: 12 }, appointmentFooter: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: spacing.sm, justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }, statusPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill }, statusText: { fontSize: 10, fontWeight: "900" }, locationText: { flex: 1, color: colors.muted, fontSize: 11, textAlign: "right" }, roleNote: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  completedCard: { flexDirection: "row", alignItems: "center", gap: spacing.md }, completedIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14 }, pendingIcon: { backgroundColor: colors.warningSoft }, ratedIcon: { backgroundColor: colors.successSoft }, rateAction: { color: colors.primary, fontSize: 12, fontWeight: "900" }, smallStars: { flexDirection: "row" }, emptyCard: { alignItems: "center" }, pressed: { opacity: 0.78 },
});
