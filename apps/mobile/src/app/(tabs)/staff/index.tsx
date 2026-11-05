import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { StaffNavigation, WarehouseStatusPill, staffDateTime } from "@/components/staff/staff-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import { getApiErrorMessage, staffService, type StaffWarehouseDashboard, type StaffWarehouseItem } from "@/services/api";

const emptyDashboard: StaffWarehouseDashboard = {
  stats: { totalItems: 0, activeItems: 0, receivedItems: 0, storedItems: 0, returnedItems: 0, overdueItems: 0 },
  handoverCounts: [], total: 0, page: 1, pageSize: 10, items: [],
};

const metrics: { key: keyof StaffWarehouseDashboard["stats"]; title: string; icon: "package-variant-closed" | "progress-clock" | "inbox-arrow-down-outline" | "archive-outline" | "package-variant-closed-check" | "alert-circle-outline"; tone: string; surface: string }[] = [
  { key: "totalItems", title: "Tổng vật phẩm", icon: "package-variant-closed", tone: colors.primary, surface: colors.primarySoft },
  { key: "activeItems", title: "Đang xử lý", icon: "progress-clock", tone: colors.warning, surface: colors.warningSoft },
  { key: "receivedItems", title: "Đã tiếp nhận", icon: "inbox-arrow-down-outline", tone: colors.primaryDark, surface: colors.primarySoft },
  { key: "storedItems", title: "Đang lưu kho", icon: "archive-outline", tone: colors.success, surface: colors.successSoft },
  { key: "returnedItems", title: "Đã trả đồ", icon: "package-variant-closed-check", tone: colors.success, surface: colors.successSoft },
  { key: "overdueItems", title: "Đã quá hạn", icon: "alert-circle-outline", tone: colors.danger, surface: colors.dangerSoft },
];

export default function StaffDashboardScreen() {
  const [dashboard, setDashboard] = useState<StaffWarehouseDashboard>(emptyDashboard);
  const [overdue, setOverdue] = useState<StaffWarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      const [summary, overdueResult] = await Promise.all([
        staffService.listWarehouseItems({ page: 1, pageSize: 10 }),
        staffService.listWarehouseItems({ overdue: true, page: 1, pageSize: 5 }),
      ]);
      setDashboard(summary);
      setOverdue(overdueResult.items);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);

  if (loading) return <SafeAreaView style={styles.safeArea}><StaffNavigation active="dashboard" /><LoadingSpinner label="Đang tải số liệu kho…" /></SafeAreaView>;

  const maxLocationCount = Math.max(1, ...dashboard.handoverCounts.map((point) => point.itemCount));

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StaffNavigation active="dashboard" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}><Text style={styles.eyebrow}>TỔNG QUAN HÔM NAY</Text><Text accessibilityRole="header" style={styles.title}>Dashboard kho</Text><Text style={styles.subtitle}>Theo dõi tiếp nhận, lưu giữ và thời hạn xử lý vật phẩm.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Tải lại thống kê kho" onPress={() => void load(true)} style={styles.refreshButton}><MaterialCommunityIcons name="refresh" size={20} color={colors.primary} /></Pressable>
        </View>
        {error ? <ErrorBanner message={error} onRetry={() => void load(true)} /> : null}

        <View style={styles.metricsGrid}>
          {metrics.map((metric) => <Card key={metric.key} style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: metric.surface }]}><MaterialCommunityIcons name={metric.icon} size={19} color={metric.tone} /></View>
            <Text style={styles.metricValue}>{dashboard.stats[metric.key].toLocaleString("vi-VN")}</Text>
            <Text style={styles.metricTitle}>{metric.title}</Text>
          </Card>)}
        </View>

        <View style={styles.quickActions}>
          <Button title="Mở hàng đợi" onPress={() => router.push("/staff/custody" as never)} style={styles.quickButton} />
          <Button title="Tiếp nhận Walk-in" variant="secondary" onPress={() => router.push("/staff/custody/walk-in" as never)} style={styles.quickButton} />
        </View>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeading}><View style={styles.sectionHeadingCopy}><Text style={styles.sectionTitle}>Phân bổ theo điểm bàn giao</Text><Text style={styles.sectionSubtitle}>Số hồ sơ vật phẩm đang được quản lý tại mỗi điểm.</Text></View><MaterialCommunityIcons name="map-marker-radius-outline" size={21} color={colors.primary} /></View>
          {dashboard.handoverCounts.length ? dashboard.handoverCounts.map((point) => <View key={point.handoverPointId} style={styles.locationRow}>
            <View style={styles.locationTop}><Text numberOfLines={1} style={styles.locationName}>{point.name}</Text><Text style={styles.locationCount}>{point.itemCount}</Text></View>
            <View style={styles.track}><View style={[styles.trackFill, { width: `${Math.max(4, (point.itemCount / maxLocationCount) * 100)}%` }]} /></View>
            <Text style={styles.locationMeta}>{point.storedCount} đang lưu · {point.overdueCount} quá hạn</Text>
          </View>) : <Text style={styles.emptyText}>Chưa có số liệu phân bổ tại các điểm bàn giao.</Text>}
        </Card>

        <Card style={[styles.sectionCard, dashboard.stats.overdueItems > 0 && styles.overdueSection]}>
          <View style={styles.sectionHeading}><View style={styles.overdueIcon}><MaterialCommunityIcons name="alert-outline" size={20} color={colors.danger} /></View><View style={styles.sectionHeadingCopy}><Text style={styles.sectionTitle}>Cần xử lý quá hạn</Text><Text style={styles.sectionSubtitle}>{dashboard.stats.overdueItems} vật phẩm đã đến hạn lưu giữ.</Text></View></View>
          {overdue.length ? <View style={styles.overdueList}>{overdue.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push(`/staff/warehouse/${item.id}` as never)} style={styles.overdueItem}>
            <View style={styles.overdueItemCopy}><Text numberOfLines={1} style={styles.itemTitle}>{item.itemName}</Text><Text numberOfLines={1} style={styles.itemMeta}>{item.storageCode || "Chưa có mã kệ"} · {item.handoverPoint?.name || "Chưa rõ điểm"}</Text><Text style={styles.deadline}>Hạn lưu giữ: {staffDateTime(item.retentionDeadline, false)}</Text></View>
              <View style={styles.overdueBadge}><Text style={styles.overdueBadgeText}>QUÁ HẠN</Text><WarehouseStatusPill status={item.status} compact /></View>
          </Pressable>)}</View> : <View style={styles.clearState}><MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} /><Text style={styles.clearText}>Không có vật phẩm quá hạn cần xử lý.</Text></View>}
          {dashboard.stats.overdueItems > overdue.length ? <Button title="Xem toàn bộ quá hạn" variant="ghost" onPress={() => router.push("/staff/warehouse?overdue=true" as never)} /> : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl },
  headingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.xs }, headingCopy: { flex: 1, gap: 4 }, eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, title: { color: colors.ink, fontSize: 22, fontWeight: "900" }, subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18 }, refreshButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, metricCard: { width: "48%", minHeight: 124, flexGrow: 1, gap: spacing.xs, padding: spacing.md }, metricIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 }, metricValue: { color: colors.ink, fontSize: 23, lineHeight: 27, fontWeight: "900" }, metricTitle: { color: colors.muted, fontSize: 11, fontWeight: "700" }, quickActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, quickButton: { flexGrow: 1, minWidth: 145 },
  sectionCard: { gap: spacing.md }, sectionHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, sectionHeadingCopy: { flex: 1, gap: 3 }, sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" }, sectionSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 17 }, locationRow: { gap: 5 }, locationTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, locationName: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: "800" }, locationCount: { color: colors.primary, fontSize: 12, fontWeight: "900" }, track: { height: 7, overflow: "hidden", borderRadius: radii.pill, backgroundColor: colors.surfaceMuted }, trackFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.primary }, locationMeta: { color: colors.muted, fontSize: 10 }, emptyText: { color: colors.muted, fontSize: 12 },
  overdueSection: { borderColor: "#F2C6C1" }, overdueIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.dangerSoft }, overdueList: { gap: spacing.xs }, overdueItem: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, overdueItemCopy: { flex: 1, gap: 3 }, overdueBadge: { alignItems: "flex-end", gap: spacing.xs }, overdueBadgeText: { color: colors.danger, fontSize: 9, fontWeight: "900" }, itemTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" }, itemMeta: { color: colors.muted, fontSize: 10 }, deadline: { color: colors.danger, fontSize: 10, fontWeight: "800" }, clearState: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm }, clearText: { color: colors.success, fontSize: 12, fontWeight: "700" },
});
