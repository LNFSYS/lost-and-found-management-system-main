import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { AppScreen } from "@/components/app-screen";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, spacing } from "@/constants/theme";
import { adminService, getApiErrorMessage, type AdminDashboardKpis } from "@/services/api";

function dateBefore(days: number) { const date = new Date(); date.setDate(date.getDate() - days); return date.toISOString().slice(0, 10); }
const today = () => new Date().toISOString().slice(0, 10);
const metricLabels: { key: keyof AdminDashboardKpis["totals"]; label: string; icon: "file-document-outline" | "shield-check-outline" | "calendar-check-outline" | "package-check" }[] = [
  { key: "posts", label: "Bài đăng", icon: "file-document-outline" }, { key: "claims", label: "Yêu cầu nhận đồ", icon: "shield-check-outline" },
  { key: "appointments", label: "Lịch hẹn", icon: "calendar-check-outline" }, { key: "returns", label: "Đã trả đồ", icon: "package-check" },
];

export default function AdminDashboardScreen() {
  const [from, setFrom] = useState(dateBefore(29)); const [to, setTo] = useState(today());
  const [applied, setApplied] = useState({ from: dateBefore(29), to: today() });
  const [data, setData] = useState<AdminDashboardKpis | null>(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [exporting, setExporting] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async (refresh = false) => {
    setError(""); if (refresh) setRefreshing(true);
    try { setData(await adminService.getDashboard(applied)); } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [applied]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const trendRows = useMemo(() => data?.trends.slice(-10) ?? [], [data]);
  const maxTrend = Math.max(1, ...trendRows.flatMap((row) => [row.posts, row.claims, row.appointments, row.returns]));
  const exportData = async (format: "CSV" | "JSON") => {
    setExporting(true); setError("");
    try {
      const response = await adminService.exportStatistics({ ...applied, format });
      if (!(await Sharing.isAvailableAsync())) throw new Error("Thiết bị chưa hỗ trợ chia sẻ tệp.");
      const safeName = response.fileName.replace(/[^\w.-]+/g, "_") || `statistics.${format.toLowerCase()}`;
      const exportedFile = new File(Paths.cache, safeName);
      exportedFile.create({ overwrite: true });
      await exportedFile.write(response.content);
      await Sharing.shareAsync(exportedFile.uri, {
        mimeType: format === "CSV" ? "text/csv" : "application/json",
        dialogTitle: response.fileName,
      });
    }
    catch (err) { setError(getApiErrorMessage(err)); }
    finally { setExporting(false); }
  };
  if (loading) return <LoadingSpinner label="Đang tải tổng quan quản trị…" />;
  return <AppScreen title="Tổng quan quản trị" description="Theo dõi hoạt động, báo cáo và kết quả xử lý trong khoảng thời gian chọn.">
    <AdminNavigation active="dashboard" />
    {error ? <ErrorBanner message={error} onRetry={() => void load(true)} /> : null}
    <Card style={styles.filters}>
      <View style={styles.filterHeading}><Text style={styles.sectionTitle}>Khoảng thống kê</Text><View style={styles.filterActions}><Button title="Áp dụng" loading={refreshing} onPress={() => { if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) { setError("Nhập ngày hợp lệ theo YYYY-MM-DD và đảm bảo ngày bắt đầu không sau ngày kết thúc."); return; } setApplied({ from, to }); }} /><Button title="Tải lại" variant="ghost" loading={refreshing} onPress={() => void load(true)} /></View></View>
      <View style={styles.dateRow}><Input label="Từ ngày" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" maxLength={10} /><Input label="Đến ngày" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" maxLength={10} /></View>
      {data ? <Text style={styles.caption}>{data.filters.days} ngày · {data.filters.from} – {data.filters.to}</Text> : null}
    </Card>
    {data ? <>
      <View style={styles.metricGrid}>{metricLabels.map((metric) => <Card key={metric.key} style={styles.metric}>
        <View style={styles.metricTop}><MaterialCommunityIcons name={metric.icon} size={19} color={colors.primary} /><Text style={styles.metricLabel}>{metric.label}</Text></View>
        <Text style={styles.metricValue}>{data.totals[metric.key].toLocaleString("vi-VN")}</Text>
      </Card>)}</View>
      <Card style={styles.snapshot}>
        <Text style={styles.sectionTitle}>Tình hình hiện tại</Text>
        <View style={styles.snapshotRow}><Text style={styles.snapshotLabel}>Bài đang mở</Text><Text style={styles.snapshotValue}>{data.snapshot.openPosts}</Text></View>
        <View style={styles.snapshotRow}><Text style={styles.snapshotLabel}>Vật phẩm trong kho</Text><Text style={styles.snapshotValue}>{data.snapshot.custodyItems}</Text></View>
        <View style={styles.snapshotRow}><Text style={styles.snapshotLabel}>Báo cáo chờ xử lý</Text><Text style={styles.snapshotValue}>{data.snapshot.unresolvedReports}</Text></View>
      </Card>
      <Card style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Xu hướng theo ngày</Text>
        {trendRows.length === 0 ? <Text style={styles.caption}>Không có dữ liệu trong khoảng này.</Text> : trendRows.map((row) => <View key={row.date} style={styles.trendRow}>
          <Text style={styles.trendDate}>{row.date.slice(5)}</Text>
          <View style={styles.bars}>{metricLabels.map((metric) => <View key={metric.key} style={styles.barTrack}><View style={[styles.bar, { width: `${Math.max(row[metric.key] ? 5 : 0, row[metric.key] / maxTrend * 100)}%`, backgroundColor: metric.key === "posts" ? colors.primary : metric.key === "claims" ? colors.accent : metric.key === "appointments" ? colors.success : colors.neutral }]} /></View>)}</View>
          <Text style={styles.trendValue}>{row.posts + row.claims + row.appointments + row.returns}</Text>
        </View>)}
        <View style={styles.legend}>{metricLabels.map((metric) => <View key={metric.key} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: metric.key === "posts" ? colors.primary : metric.key === "claims" ? colors.accent : metric.key === "appointments" ? colors.success : colors.neutral }]} /><Text style={styles.legendText}>{metric.label}</Text></View>)}</View>
      </Card>
      <Card style={styles.exportCard}><Text style={styles.sectionTitle}>Xuất thống kê</Text><Text style={styles.caption}>Chia sẻ dữ liệu theo định dạng CSV hoặc JSON.</Text><View style={styles.exportActions}><Button title="Chia sẻ CSV" variant="secondary" loading={exporting} onPress={() => void exportData("CSV")} style={styles.exportButton} /><Button title="Chia sẻ JSON" variant="secondary" loading={exporting} onPress={() => void exportData("JSON")} style={styles.exportButton} /></View></Card>
    </> : <Button title="Thử tải lại" onPress={() => void load(true)} />}
  </AppScreen>;
}

const styles = StyleSheet.create({ filters: { gap: spacing.md }, filterHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, filterActions: { flexDirection: "row", alignItems: "center" }, dateRow: { flexDirection: "row", gap: spacing.md }, sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" }, caption: { color: colors.muted, fontSize: 12, lineHeight: 18 }, metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, metric: { flexGrow: 1, flexBasis: "45%", gap: spacing.md, padding: spacing.md }, metricTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, metricLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" }, metricValue: { color: colors.ink, fontSize: 25, fontWeight: "900" }, snapshot: { gap: spacing.md }, snapshotRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, snapshotLabel: { color: colors.muted, fontSize: 13 }, snapshotValue: { color: colors.ink, fontSize: 14, fontWeight: "800" }, chartCard: { gap: spacing.md }, trendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, trendDate: { width: 38, color: colors.muted, fontSize: 10 }, bars: { flex: 1, gap: 3 }, barTrack: { height: 4, backgroundColor: colors.surfaceMuted, borderRadius: 2, overflow: "hidden" }, bar: { height: "100%", borderRadius: 2 }, trendValue: { width: 28, textAlign: "right", color: colors.ink, fontSize: 10, fontWeight: "700" }, legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, legendItem: { flexDirection: "row", alignItems: "center", gap: 4 }, legendDot: { width: 7, height: 7, borderRadius: 4 }, legendText: { color: colors.muted, fontSize: 10 }, exportCard: { gap: spacing.md }, exportActions: { flexDirection: "row", gap: spacing.sm }, exportButton: { flex: 1 }, });
