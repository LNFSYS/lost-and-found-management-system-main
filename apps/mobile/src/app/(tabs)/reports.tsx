import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { colors, spacing } from "@/constants/theme";
import { createRequestUuid, getApiErrorMessage, userReportService, type UserReportRecord } from "@/services/api";

type ReportTarget = "POST" | "USER" | "MESSAGE";
const targetOptions: { key: ReportTarget; label: string }[] = [{ key: "POST", label: "Bài viết" }, { key: "USER", label: "Người dùng" }, { key: "MESSAGE", label: "Tin nhắn" }];
const targetLabels: Record<ReportTarget, string> = { POST: "Bài viết", USER: "Người dùng", MESSAGE: "Tin nhắn" };

export default function UserReportsScreen() {
  const [targetType, setTargetType] = useState<ReportTarget>("POST");
  const [targetId, setTargetId] = useState(""); const [reason, setReason] = useState(""); const [details, setDetails] = useState("");
  const [items, setItems] = useState<UserReportRecord[]>([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [submitting, setSubmitting] = useState(false); const [busyId, setBusyId] = useState(""); const [error, setError] = useState("");
  const load = useCallback(async (refresh = false) => { setError(""); if (refresh) setRefreshing(true); try { setItems((await userReportService.list({ page: 1, pageSize: 30 })).items); } catch (err) { setError(getApiErrorMessage(err)); } finally { setLoading(false); setRefreshing(false); } }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const submit = async () => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId.trim())) { setError("Mã đối tượng phải là UUID hợp lệ."); return; }
    if (reason.trim().length < 3 || reason.trim().length > 120) { setError("Lý do cần từ 3 đến 120 ký tự."); return; }
    if (details.trim().length > 1000) { setError("Mô tả tối đa 1.000 ký tự."); return; }
    setSubmitting(true); setError("");
    try { await userReportService.submit({ targetType, targetId: targetId.trim(), reason: reason.trim(), details: details.trim() || undefined, idempotencyKey: createRequestUuid() }); setTargetId(""); setReason(""); setDetails(""); await load(true); }
    catch (err) { setError(getApiErrorMessage(err)); }
    finally { setSubmitting(false); }
  };
  const withdraw = (report: UserReportRecord) => Alert.alert("Rút báo cáo?", "Báo cáo đang chờ xử lý sẽ được rút khỏi hàng đợi.", [
    { text: "Giữ báo cáo", style: "cancel" }, { text: "Rút báo cáo", style: "destructive", onPress: () => { setBusyId(report.id); void userReportService.withdraw(report.id).then(() => load(true)).catch((err) => setError(getApiErrorMessage(err))).finally(() => setBusyId("")).then(() => undefined); } },
  ]);
  if (loading) return <LoadingSpinner label="Đang tải báo cáo…" />;
  return <AppScreen title="Báo cáo vi phạm" description="Gửi nội dung cần xem xét và theo dõi tình trạng xử lý.">
    {error ? <ErrorBanner message={error} onRetry={() => void load(true)} /> : null}
    <Card style={styles.form}>
      <Text style={styles.sectionTitle}>Tạo báo cáo</Text>
      <View style={styles.options}>{targetOptions.map((option) => <Pressable key={option.key} accessibilityRole="radio" accessibilityState={{ selected: targetType === option.key }} onPress={() => setTargetType(option.key)} style={[styles.option, targetType === option.key && styles.optionSelected]}><Text style={[styles.optionText, targetType === option.key && styles.optionTextSelected]}>{option.label}</Text></Pressable>)}</View>
      <Input label={`Mã ${targetLabels[targetType].toLocaleLowerCase()}`} value={targetId} onChangeText={setTargetId} placeholder="UUID của đối tượng" autoCapitalize="none" autoCorrect={false} />
      <Input label="Lý do" value={reason} onChangeText={setReason} placeholder="Mô tả ngắn vi phạm" maxLength={120} />
      <Input label="Thông tin bổ sung (không bắt buộc)" value={details} onChangeText={setDetails} placeholder="Thêm ngữ cảnh để đội ngũ kiểm duyệt xem xét" multiline maxLength={1000} />
      <Button title="Gửi báo cáo" loading={submitting} onPress={() => void submit()} />
    </Card>
    <View style={styles.heading}><Text style={styles.sectionTitle}>Báo cáo đã gửi</Text><Button title="Làm mới" variant="ghost" loading={refreshing} onPress={() => void load(true)} /></View>
    {items.length === 0 ? <Card><EmptyState icon="flag-checkered" title="Chưa có báo cáo" description="Các báo cáo bạn gửi sẽ được liệt kê ở đây." /></Card> : null}
    <View style={styles.reportList}>{items.map((report) => <Card key={report.id} style={styles.report}>
      <View style={styles.reportTop}><View style={styles.reportCopy}><Text style={styles.reportTitle}>{report.target.title}</Text><Text style={styles.reportMeta}>{report.sourceType === "USER" ? "Người dùng" : report.sourceType === "MESSAGE" ? "Tin nhắn" : report.sourceType === "POST" ? "Bài viết" : report.sourceType} · {new Date(report.createdAt).toLocaleDateString("vi-VN")}</Text></View><Badge status={report.status} /></View>
      <Text style={styles.reason}>{report.reason}</Text>{report.details ? <Text style={styles.details}>{report.details}</Text> : null}
      {report.resolution ? <Text style={styles.details}>Phản hồi: {report.resolution}</Text> : null}
      {report.status === "PENDING" ? <Button title="Rút báo cáo" variant="secondary" loading={busyId === report.id} onPress={() => withdraw(report)} /> : null}
    </Card>)}</View>
  </AppScreen>;
}

const styles = StyleSheet.create({ form: { gap: spacing.md }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" }, options: { flexDirection: "row", gap: spacing.xs }, option: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface }, optionSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, optionText: { color: colors.muted, fontSize: 12, fontWeight: "700" }, optionTextSelected: { color: colors.primaryDark }, heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, reportList: { gap: spacing.sm }, report: { gap: spacing.sm }, reportTop: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", justifyContent: "space-between" }, reportCopy: { flex: 1, gap: 4 }, reportTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" }, reportMeta: { color: colors.muted, fontSize: 11 }, reason: { color: colors.ink, fontSize: 14, fontWeight: "600" }, details: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});
