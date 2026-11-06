import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { colors, radii, spacing } from "@/constants/theme";
import { adminService, getApiErrorMessage, type AdminModerationReport } from "@/services/api";

type Action = "RESOLVE_REPORT" | "WARN_USER" | "HIDE_POST" | "DELETE_POST" | "BAN_USER" | "UNBAN_USER" | "DISMISS_REPORT";
const statusOptions = ["PENDING", "REVIEWED", "DISMISSED", "WITHDRAWN"] as const;
const entityOptions = ["POST", "USER", "CLAIM", "CHAT", "HANDOVER"] as const;
const actionLabels: Record<Action, string> = { RESOLVE_REPORT: "Đã xử lý", WARN_USER: "Cảnh báo", HIDE_POST: "Ẩn bài", DELETE_POST: "Xóa bài", BAN_USER: "Khóa tài khoản", UNBAN_USER: "Mở khóa", DISMISS_REPORT: "Bỏ qua" };

export default function AdminModerationScreen() {
  const [status, setStatus] = useState<string>("PENDING"); const [entityType, setEntityType] = useState(""); const [q, setQ] = useState("");
  const [items, setItems] = useState<AdminModerationReport[]>([]); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState(""); const [reason, setReason] = useState(""); const [error, setError] = useState("");
  const load = useCallback(async () => { setError(""); try { const result = await adminService.listReports({ q: q.trim() || undefined, status, entityType: entityType || undefined, page: 1, pageSize: 50 }); setItems(result.items); setTotal(result.total); } catch (err) { setError(getApiErrorMessage(err)); } finally { setLoading(false); } }, [q, status, entityType]);
  useEffect(() => { const timer = setTimeout(() => void load(), q ? 350 : 0); return () => clearTimeout(timer); }, [load, q]);
  const availableActions = (report: AdminModerationReport): Action[] => {
    if (report.entityType === "USER") return ["WARN_USER", "BAN_USER", "UNBAN_USER", "RESOLVE_REPORT", "DISMISS_REPORT"];
    if (report.entityType === "POST") return ["WARN_USER", "BAN_USER", "UNBAN_USER", "HIDE_POST", "DELETE_POST", "RESOLVE_REPORT", "DISMISS_REPORT"];
    return ["RESOLVE_REPORT", "DISMISS_REPORT"];
  };
  const review = async (report: AdminModerationReport, action: Action) => {
    if (reason.trim().length < 3) { setError("Nhập lý do xử lý (ít nhất 3 ký tự) trước khi áp dụng chế tài."); return; }
    setBusyId(report.id); setError(""); try { await adminService.reviewReport(report.id, action, reason.trim()); setReason(""); await load(); } catch (err) { setError(getApiErrorMessage(err)); } finally { setBusyId(""); }
  };
  if (loading) return <LoadingSpinner label="Đang tải hàng đợi kiểm duyệt…" />;
  return <AppScreen title="Kiểm duyệt báo cáo" description={`${total.toLocaleString("vi-VN")} báo cáo phù hợp với bộ lọc`}>
    <AdminNavigation active="reports" />
    {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
    <Input label="Tìm báo cáo" value={q} onChangeText={setQ} placeholder="Lý do, người gửi hoặc đối tượng" />
    <View style={styles.filterGroup}><Text style={styles.filterTitle}>Trạng thái</Text><View style={styles.chips}>{statusOptions.map((value) => <Chip key={value} label={value} selected={status === value} onPress={() => setStatus(value)} />)}</View></View>
    <View style={styles.filterGroup}><Text style={styles.filterTitle}>Đối tượng</Text><View style={styles.chips}><Chip label="Tất cả" selected={!entityType} onPress={() => setEntityType("")} />{entityOptions.map((value) => <Chip key={value} label={value} selected={entityType === value} onPress={() => setEntityType(value)} />)}</View></View>
    <Input label="Lý do xử lý" value={reason} onChangeText={setReason} placeholder="Lý do sẽ được lưu vào nhật ký kiểm duyệt" maxLength={255} />
    {items.length === 0 ? <Card><EmptyState icon="check-decagram-outline" title="Không có báo cáo" description="Hàng đợi hiện không có mục phù hợp." /></Card> : null}
    <View style={styles.list}>{items.map((report) => <Card key={report.id} style={styles.report}>
      <View style={styles.top}><View style={styles.copy}><Text style={styles.entityTitle}>{report.entity.title || `${report.entityType} · ${report.entityId.slice(0, 8)}`}</Text><Text style={styles.meta}>{report.entityType} · {report.reporter.fullName} · {new Date(report.createdAt).toLocaleDateString("vi-VN")}</Text></View><Badge status={report.status} /></View>
      <Text style={styles.reason}>{report.reason}</Text>{report.details ? <Text style={styles.details}>{report.details}</Text> : null}
      {report.entity.ownerName ? <Text style={styles.details}>Tài khoản liên quan: {report.entity.ownerName}</Text> : null}
      {report.status === "PENDING" ? <View style={styles.actions}>{availableActions(report).map((action) => <Button key={action} title={actionLabels[action]} variant={action === "DELETE_POST" || action === "BAN_USER" ? "danger" : "secondary"} loading={busyId === report.id} onPress={() => void review(report, action)} style={styles.action} />)}</View> : null}
    </Card>)}</View>
  </AppScreen>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label.replaceAll("_", " ")}</Text></Pressable>; }
const styles = StyleSheet.create({ filterGroup: { gap: spacing.sm }, filterTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, chip: { minHeight: 34, paddingHorizontal: spacing.md, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, backgroundColor: colors.surface }, chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, chipText: { color: colors.muted, fontSize: 11, fontWeight: "700" }, chipTextSelected: { color: colors.primaryDark }, list: { gap: spacing.sm }, report: { gap: spacing.md }, top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }, copy: { flex: 1, gap: 4 }, entityTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" }, meta: { color: colors.muted, fontSize: 11 }, reason: { color: colors.ink, fontSize: 14, fontWeight: "700" }, details: { color: colors.muted, fontSize: 13, lineHeight: 19 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, action: { minHeight: 40, paddingHorizontal: spacing.sm }, });
