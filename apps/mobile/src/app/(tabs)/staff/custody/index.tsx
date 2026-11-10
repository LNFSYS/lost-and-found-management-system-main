import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { StaffNavigation, WarehouseStatusPill, staffDateTime } from "@/components/staff/staff-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { custodyIntakeTypeLabels } from "@/constants/labels";
import { colors, radii, spacing } from "@/constants/theme";
import { getApiErrorMessage, staffService, type StaffCustodyFilter, type StaffCustodyListResponse, type StaffCustodyRequest } from "@/services/api";

const filters: { key: "ALL" | StaffCustodyFilter; label: string; status?: StaffCustodyFilter }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING", label: "Chờ xử lý", status: "PENDING" },
  { key: "AWAITING_INTAKE", label: "Chờ nhập kho", status: "AWAITING_INTAKE" },
  { key: "INTAKED", label: "Đã tiếp nhận", status: "INTAKED" },
  { key: "REJECTED", label: "Đã từ chối", status: "REJECTED" },
];

function RequestCard({ request }: { request: StaffCustodyRequest }) {
  const title = request.post?.title || request.photoSource?.title || "Vật phẩm từ yêu cầu xác minh";
  const nextAction = request.status === "PENDING" ? "Cần xem và phản hồi" : request.status === "ACCEPTED" ? "Hoàn tất biểu mẫu nhập kho" : request.status === "INTAKED" ? "Đã có hồ sơ kho" : "Xem lịch sử xử lý";
  return <Pressable accessibilityRole="button" onPress={() => router.push(`/staff/custody/${request.id}` as never)}>
    <Card style={styles.requestCard}>
      <View style={styles.requestIcon}><MaterialCommunityIcons name={request.intakeType === "WALK_IN" ? "account-arrow-right-outline" : "package-variant-closed"} size={21} color={colors.primary} /></View>
      <View style={styles.requestCopy}>
        <View style={styles.requestTop}><Text numberOfLines={1} style={styles.requestTitle}>{title}</Text><WarehouseStatusPill status={request.status} compact /></View>
        <Text numberOfLines={1} style={styles.requestMeta}>{request.requester.fullName || "Người nhặt"} · {custodyIntakeTypeLabels[request.intakeType]}</Text>
        <Text numberOfLines={2} style={styles.reason}>{request.reason || "Không có lý do kèm theo."}</Text>
        <View style={styles.requestFooter}><Text numberOfLines={1} style={styles.location}>{request.handoverPoint?.name || "Chưa chọn điểm bàn giao"}</Text><Text style={styles.date}>{staffDateTime(request.createdAt, false)}</Text></View>
        <Text style={styles.nextAction}>{nextAction}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={21} color={colors.muted} />
    </Card>
  </Pressable>;
}

export default function CustodyQueueScreen() {
  const [data, setData] = useState<StaffCustodyListResponse | null>(null);
  const [items, setItems] = useState<StaffCustodyRequest[]>([]);
  const [filter, setFilter] = useState<"ALL" | StaffCustodyFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false, selectedFilter = filter, page = 1) => {
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      const result = await staffService.listCustodyRequests({ status: selectedFilter === "ALL" ? undefined : selectedFilter, page, pageSize: 12 });
      setData(result);
      setItems((current) => page === 1 ? result.items : [...current, ...result.items.filter((request) => !current.some((existing) => existing.id === request.id))]);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => { const timer = setTimeout(() => { void load(false, filter, 1); }, 0); return () => clearTimeout(timer); }, [load, filter]);

  const selectFilter = (next: "ALL" | StaffCustodyFilter) => { setFilter(next); setItems([]); setLoading(true); };
  const loadMore = () => {
    if (!data || loadingMore || data.page * data.pageSize >= data.total) return;
    setLoadingMore(true);
    void load(false, filter, data.page + 1);
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><StaffNavigation active="custody" /><LoadingSpinner label="Đang tải hàng đợi tiếp nhận…" /></SafeAreaView>;

  const activeFilter = filters.find((item) => item.key === filter);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StaffNavigation active="custody" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true, filter, 1)} tintColor={colors.primary} />}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}><Text style={styles.eyebrow}>BÀN GIAO KHO</Text><Text accessibilityRole="header" style={styles.title}>Hàng đợi tiếp nhận</Text><Text style={styles.subtitle}>Kiểm tra nguồn vật phẩm, xử lý yêu cầu và ghi nhận nhập kho.</Text></View>
          <View style={styles.count}><Text style={styles.countValue}>{data?.counts.PENDING ?? 0}</Text><Text style={styles.countLabel}>đang chờ</Text></View>
        </View>
        <Button title="Tiếp nhận đồ mang trực tiếp tại quầy" variant="secondary" onPress={() => router.push("/staff/custody/walk-in" as never)} />
        {error ? <ErrorBanner message={error} onRetry={() => void load(true, filter, 1)} /> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map((item) => {
            const selected = item.key === filter;
            const count = item.status === "PENDING" ? data?.counts.PENDING : item.status === "INTAKED" ? data?.counts.INTAKED : item.status === "REJECTED" ? data?.counts.REJECTED : item.status === "AWAITING_INTAKE" ? data?.counts.ACCEPTED : data?.total;
            return <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => selectFilter(item.key)} style={[styles.filter, selected && styles.filterSelected]}><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text><Text style={[styles.filterCount, selected && styles.filterCountSelected]}>{count ?? 0}</Text></Pressable>;
          })}
        </ScrollView>
        <View style={styles.listHeading}><Text style={styles.listTitle}>{activeFilter?.label}</Text><Text style={styles.listCount}>{data?.total ?? 0} yêu cầu</Text></View>
        {items.length ? <View style={styles.list}>{items.map((request) => <RequestCard key={request.id} request={request} />)}</View> : !error ? <Card style={styles.emptyCard}><EmptyState icon="clipboard-check-outline" title="Không có yêu cầu trong bộ lọc này" description="Các yêu cầu bàn giao từ người nhặt sẽ xuất hiện tại đây." /></Card> : null}
        {data && data.page * data.pageSize < data.total ? <Button title={loadingMore ? "Đang tải…" : "Tải thêm yêu cầu"} variant="secondary" loading={loadingMore} onPress={loadMore} /> : null}
        {loadingMore ? <ActivityIndicator color={colors.primary} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl },
  headingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md }, headingCopy: { flex: 1, gap: 4 }, eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, title: { color: colors.ink, fontSize: 21, fontWeight: "900" }, subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18 }, count: { minWidth: 56, alignItems: "center", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: radii.control, backgroundColor: colors.warningSoft }, countValue: { color: colors.warning, fontSize: 19, fontWeight: "900" }, countLabel: { color: colors.warning, fontSize: 9, fontWeight: "800" },
  filters: { gap: spacing.xs, paddingRight: spacing.md }, filter: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, filterSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, filterText: { color: colors.ink, fontSize: 11, fontWeight: "800" }, filterTextSelected: { color: colors.primaryDark }, filterCount: { color: colors.muted, fontSize: 10, fontWeight: "900" }, filterCountSelected: { color: colors.primary },
  listHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, listTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" }, listCount: { color: colors.muted, fontSize: 11 }, list: { gap: spacing.sm }, requestCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md }, requestIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.primarySoft }, requestCopy: { flex: 1, gap: 5 }, requestTop: { flexDirection: "row", alignItems: "center", gap: spacing.xs }, requestTitle: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: "900" }, requestMeta: { color: colors.muted, fontSize: 10, fontWeight: "700" }, reason: { color: colors.ink, fontSize: 11, lineHeight: 16 }, requestFooter: { flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" }, location: { flex: 1, color: colors.muted, fontSize: 10 }, date: { color: colors.muted, fontSize: 10 }, nextAction: { color: colors.primary, fontSize: 10, fontWeight: "900" }, emptyCard: { alignItems: "center" },
});
