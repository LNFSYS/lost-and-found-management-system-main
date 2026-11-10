import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { StaffNavigation, WarehouseStatusPill, staffDateTime } from "@/components/staff/staff-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import { getApiErrorMessage, staffService, type StaffWarehouseDashboard, type WarehouseItemStatus } from "@/services/api";

const statusFilters: { value: "" | WarehouseItemStatus; label: string }[] = [
  { value: "", label: "Tất cả" }, { value: "RECEIVED", label: "Đã tiếp nhận" }, { value: "STORED", label: "Đang lưu kho" },
  { value: "CLAIMED", label: "Đang giữ" }, { value: "RETURNED", label: "Đã trả" }, { value: "EXPIRED", label: "Quá hạn" },
  { value: "PENDING_APPROVAL", label: "Chờ duyệt" }, { value: "DISPOSED", label: "Đã xử lý" }, { value: "DONATED", label: "Đã quyên góp" }, { value: "TRANSFERRED", label: "Đã chuyển" },
];

export default function WarehouseItemsScreen() {
  const params = useLocalSearchParams<{ overdue?: string }>();
  const overdueOnly = params.overdue === "true";
  const [data, setData] = useState<StaffWarehouseDashboard | null>(null);
  const [status, setStatus] = useState<"" | WarehouseItemStatus>("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false, page = 1) => {
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      const result = await staffService.listWarehouseItems({ q: submittedSearch || undefined, status: status || undefined, overdue: overdueOnly || undefined, page, pageSize: 12 });
      setData((current) => page === 1 ? result : { ...result, items: [...(current?.items ?? []), ...result.items.filter((item) => !(current?.items ?? []).some((existing) => existing.id === item.id))] });
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [overdueOnly, status, submittedSearch]);

  useEffect(() => { const timer = setTimeout(() => { void load(false, 1); }, 0); return () => clearTimeout(timer); }, [load]);

  useEffect(() => {
    const nextSearch = search.trim();
    if (nextSearch === submittedSearch) return;
    const timer = setTimeout(() => {
      setSubmittedSearch(nextSearch);
      setLoading(true);
    }, nextSearch ? 400 : 300);
    return () => clearTimeout(timer);
  }, [search, submittedSearch]);

  const loadMore = () => {
    if (!data || loadingMore || data.page * data.pageSize >= data.total) return;
    setLoadingMore(true);
    void load(false, data.page + 1);
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><StaffNavigation active="warehouse" /><LoadingSpinner label="Đang tải kho vật phẩm…" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StaffNavigation active="warehouse" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true, 1)} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}><View style={styles.headingCopy}><Text style={styles.eyebrow}>QUẢN LÝ VẬT PHẨM</Text><Text accessibilityRole="header" style={styles.title}>{overdueOnly ? "Vật phẩm quá hạn" : "Kho vật phẩm"}</Text><Text style={styles.subtitle}>{data?.total ?? 0} hồ sơ phù hợp với bộ lọc hiện tại.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Tải lại kho vật phẩm" onPress={() => void load(true, 1)} style={styles.refresh}><MaterialCommunityIcons name="refresh" size={20} color={colors.primary} /></Pressable></View>
        {error ? <ErrorBanner message={error} onRetry={() => void load(true, 1)} /> : null}
        <View style={styles.searchRow}><Input label="Tìm theo tên, mã kệ hoặc người gửi" value={search} onChangeText={setSearch} onSubmitEditing={() => { setSubmittedSearch(search.trim()); setLoading(true); }} returnKeyType="search" placeholder="Nhập từ khóa…" style={styles.searchInput} /><Pressable accessibilityRole="button" accessibilityLabel="Tìm kiếm" onPress={() => { setSubmittedSearch(search.trim()); setLoading(true); }} style={styles.searchButton}><MaterialCommunityIcons name="magnify" size={21} color={colors.surface} /></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{statusFilters.map((filter) => { const selected = filter.value === status; return <Pressable key={filter.value || "all"} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => { setStatus(filter.value); setLoading(true); }} style={[styles.filter, selected && styles.filterSelected]}><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{filter.label}</Text></Pressable>; })}</ScrollView>
        {overdueOnly ? <View style={styles.overdueNote}><MaterialCommunityIcons name="alert-circle-outline" size={17} color={colors.danger} /><Text style={styles.overdueText}>Danh sách chỉ hiển thị hồ sơ đã quá hạn theo điều kiện retention của backend.</Text></View> : null}
        {data?.items.length ? <View style={styles.list}>{data.items.map((item) => {
          const overdue = overdueOnly || item.status === "EXPIRED";
          return <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push(`/staff/warehouse/${item.id}` as never)}><Card style={styles.itemCard}>
            <View style={styles.itemIcon}><MaterialCommunityIcons name={item.status === "RETURNED" ? "package-variant-closed-check" : "package-variant-closed"} size={21} color={colors.primary} /></View>
            <View style={styles.itemCopy}><View style={styles.itemTop}><Text numberOfLines={1} style={styles.itemTitle}>{item.itemName}</Text><WarehouseStatusPill status={item.status} compact /></View>
              <Text style={styles.itemMeta}>{item.storageCode || "Chưa có mã kệ"} · {item.handoverPoint?.name || "Chưa có điểm bàn giao"}</Text>
              <Text numberOfLines={1} style={styles.itemMeta}>{item.finder.name || item.finder.userName || "Người gửi chưa rõ"} · Nhận {staffDateTime(item.receivedAt, false)}</Text>
              {overdue ? <Text style={styles.deadline}>Quá hạn từ {staffDateTime(item.retentionDeadline, false)}</Text> : null}
            </View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </Card></Pressable>;
        })}</View> : !error ? <Card style={styles.emptyCard}><EmptyState icon="archive-outline" title="Không tìm thấy vật phẩm" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." /></Card> : null}
        {data && data.page * data.pageSize < data.total ? <Button title="Tải thêm vật phẩm" variant="secondary" loading={loadingMore} onPress={loadMore} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl }, headingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md }, headingCopy: { flex: 1, gap: 4 }, eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, title: { color: colors.ink, fontSize: 21, fontWeight: "900" }, subtitle: { color: colors.muted, fontSize: 11, lineHeight: 17 }, refresh: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }, searchInput: { minHeight: 46 }, searchButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: colors.primary }, filters: { gap: spacing.xs, paddingRight: spacing.md }, filter: { minHeight: 39, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, filterSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, filterText: { color: colors.ink, fontSize: 10, fontWeight: "800" }, filterTextSelected: { color: colors.primaryDark }, overdueNote: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.dangerSoft }, overdueText: { flex: 1, color: colors.danger, fontSize: 11, lineHeight: 16 },
  list: { gap: spacing.sm }, itemCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md }, itemIcon: { width: 39, height: 39, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.primarySoft }, itemCopy: { flex: 1, gap: 4 }, itemTop: { flexDirection: "row", alignItems: "center", gap: spacing.xs }, itemTitle: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: "900" }, itemMeta: { color: colors.muted, fontSize: 10 }, deadline: { color: colors.danger, fontSize: 10, fontWeight: "900" }, emptyCard: { alignItems: "center" },
});
