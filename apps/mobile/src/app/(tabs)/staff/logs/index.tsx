import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { StaffNavigation, staffDateTime } from "@/components/staff/staff-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import { getApiErrorMessage, staffService, type StaffWarehouseStorageLog } from "@/services/api";

const actionLabels: Record<string, string> = {
  RECEIVED: "Tiếp nhận vật phẩm", STORED: "Đưa vào lưu kho", CLAIMED: "Giữ cho người nhận", RETURNED: "Trả vật phẩm",
  EXPIRED: "Đánh dấu quá hạn", OVERDUE_MARKED: "Ghi nhận quá hạn", CONDITION_UPDATED: "Cập nhật hồ sơ",
  DISPOSED: "Đã xử lý", DONATED: "Đã quyên góp", TRANSFERRED: "Đã chuyển giao",
};

export default function StorageLogsScreen() {
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const [logs, setLogs] = useState<StaffWarehouseStorageLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false, targetPage = 1) => {
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      if (itemId) {
        const result = await staffService.listWarehouseLogs(itemId);
        setLogs(result);
        setTotal(result.length);
        setPage(1);
      } else {
        const result = await staffService.listAllWarehouseLogs(targetPage, 20);
        setLogs((current) => targetPage === 1 ? result.logs : [...current, ...result.logs]);
        setTotal(result.total);
        setPage(result.page);
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [itemId]);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);

  const loadMore = () => {
    if (itemId || loadingMore || page * 20 >= total) return;
    setLoadingMore(true);
    void load(false, page + 1);
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><StaffNavigation active="logs" /><LoadingSpinner label="Đang tải nhật ký lưu kho…" /></SafeAreaView>;

  return <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
    <StaffNavigation active="logs" />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
      <View style={styles.headingRow}><View style={styles.headingCopy}><Text style={styles.eyebrow}>AUDIT TRAIL</Text><Text accessibilityRole="header" style={styles.title}>{itemId ? "Nhật ký vật phẩm" : "Nhật ký lưu kho"}</Text><Text style={styles.subtitle}>{itemId ? `Lịch sử hồ sơ ${itemId}` : `${total.toLocaleString("vi-VN")} biến động, mới nhất trước.`}</Text></View><MaterialCommunityIcons name="history" size={25} color={colors.primary} /></View>
      {error ? <ErrorBanner message={error} onRetry={() => void load(true)} /> : null}
      <Card style={styles.timelineCard}>
        <View style={styles.timelineHeader}><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Biến động kho</Text><Text style={styles.sectionSubtitle}>Người thao tác, thay đổi trạng thái, vị trí và ghi chú.</Text></View><Text style={styles.eventCount}>{logs.length}</Text></View>
        {logs.length ? logs.map((log, index) => <Pressable key={log.id} accessibilityRole={log.warehouseItemId ? "button" : undefined} onPress={log.warehouseItemId ? () => router.push(`/staff/warehouse/${log.warehouseItemId}` as never) : undefined} style={styles.logEntry}>
          <View style={styles.rail}><View style={styles.dot} /><View style={[styles.line, index === logs.length - 1 && styles.lineHidden]} /></View>
          <View style={styles.logContent}>
            <View style={styles.logHeading}><Text style={styles.action}>{actionLabels[log.action] ?? log.action.replaceAll("_", " ")}</Text><Text style={styles.time}>{staffDateTime(log.createdAt)}</Text></View>
            <Text style={styles.itemName}>{log.itemName || (log.warehouseItemId ? `Hồ sơ ${log.warehouseItemId}` : "Vật phẩm đã lưu trữ")}</Text>
            <Text style={styles.actor}>{log.actor.fullName || "Nhân viên"} · {log.handoverPoint?.name || "Điểm bàn giao"}</Text>
            {log.fromStatus || log.toStatus ? <Text style={styles.statusChange}>{log.fromStatus?.replaceAll("_", " ") || "Mới"} → {log.toStatus?.replaceAll("_", " ") || "—"}</Text> : null}
            {log.storageCode ? <Text style={styles.detail}>Mã kệ: {log.storageCode}</Text> : null}
            {log.conditionNotes ? <Text style={styles.detail}>Tình trạng: {log.conditionNotes}</Text> : null}
            {log.note ? <Text style={styles.note}>{log.note}</Text> : null}
          </View>
          {log.warehouseItemId ? <MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} /> : null}
        </Pressable>) : !error ? <EmptyState icon="history" title="Chưa có nhật ký" description="Các lần tiếp nhận, di chuyển và trả đồ sẽ được ghi lại tại đây." /> : null}
      </Card>
      {!itemId && page * 20 < total ? <Button title="Tải thêm sự kiện" variant="secondary" loading={loadingMore} onPress={loadMore} /> : null}
      {loadingMore ? <View style={styles.loadingMore}><ActivityIndicator color={colors.primary} /><Text style={styles.sectionSubtitle}>Đang tải sự kiện…</Text></View> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl }, headingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md }, headingCopy: { flex: 1, gap: 4 }, eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, title: { color: colors.ink, fontSize: 21, fontWeight: "900" }, subtitle: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  timelineCard: { gap: spacing.md }, timelineHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" }, sectionSubtitle: { color: colors.muted, fontSize: 11 }, eventCount: { minWidth: 34, height: 30, textAlign: "center", textAlignVertical: "center", borderRadius: radii.pill, backgroundColor: colors.primarySoft, color: colors.primary, fontSize: 11, fontWeight: "900" },
  logEntry: { minHeight: 82, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }, rail: { width: 20, alignItems: "center" }, dot: { zIndex: 1, width: 12, height: 12, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface }, line: { position: "absolute", top: 12, bottom: -8, width: 2, backgroundColor: colors.border }, lineHidden: { display: "none" }, logContent: { flex: 1, gap: 4, paddingBottom: spacing.md }, logHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm }, action: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: "900" }, time: { color: colors.muted, fontSize: 9 }, itemName: { color: colors.primaryDark, fontSize: 11, fontWeight: "800" }, actor: { color: colors.muted, fontSize: 10 }, statusChange: { color: colors.primaryDark, fontSize: 10, fontWeight: "800" }, detail: { color: colors.ink, fontSize: 10 }, note: { padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.surfaceMuted, color: colors.muted, fontSize: 10, lineHeight: 15 }, loadingMore: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
});
