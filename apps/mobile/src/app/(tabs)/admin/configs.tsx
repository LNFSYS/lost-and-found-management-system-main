import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import { adminService, getApiErrorMessage, type AdminSystemConfig } from "@/services/api";

const valueTypes: AdminSystemConfig["valueType"][] = ["STRING", "INTEGER", "FLOAT", "BOOLEAN", "JSON"];
type HistoryEntry = { id: string; action: string; configKey: string; oldValue: string | null; newValue: string; changedBy: string; changedAt: string; reason: string | null };

export default function AdminConfigsScreen() {
  const [q, setQ] = useState(""); const [items, setItems] = useState<AdminSystemConfig[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [editing, setEditing] = useState<AdminSystemConfig | null>(null); const [historyId, setHistoryId] = useState(""); const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [key, setKey] = useState(""); const [value, setValue] = useState(""); const [type, setType] = useState<AdminSystemConfig["valueType"]>("STRING"); const [description, setDescription] = useState(""); const [reason, setReason] = useState(""); const [isPublic, setIsPublic] = useState(false);
  const load = useCallback(async () => { setError(""); try { setItems((await adminService.listConfigs({ q: q.trim() || undefined, page: 1, pageSize: 100 })).items); } catch (err) { setError(getApiErrorMessage(err)); } finally { setLoading(false); } }, [q]);
  useEffect(() => { const timer = setTimeout(() => void load(), q ? 350 : 0); return () => clearTimeout(timer); }, [load, q]);
  const resetForm = () => { setEditing(null); setKey(""); setValue(""); setType("STRING"); setDescription(""); setReason(""); setIsPublic(false); };
  const edit = (config: AdminSystemConfig) => { setEditing(config); setKey(config.configKey); setValue(config.configValue); setType(config.valueType); setDescription(config.description ?? ""); setIsPublic(config.isPublic); setReason(""); setHistoryId(""); setHistory([]); };
  const save = async () => {
    if (!/^[a-z][a-z0-9]*(\.[a-z0-9_]+)+$/.test(key.trim())) { setError("Khóa cần theo dạng ví dụ: app.feature_enabled."); return; }
    if (!value.trim()) { setError("Giá trị cấu hình không được để trống."); return; }
    if (editing && reason.trim().length < 3) { setError("Nhập lý do thay đổi (ít nhất 3 ký tự)."); return; }
    setBusy(true); setError("");
    try {
      if (editing) await adminService.updateConfig(editing.id, { configKey: key.trim(), configValue: value, valueType: type, description: description.trim() || null, isPublic, reason: reason.trim() });
      else await adminService.createConfig({ configKey: key.trim(), configValue: value, valueType: type, description: description.trim() || null, isPublic, reason: reason.trim() || null });
      resetForm(); await load();
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setBusy(false); }
  };
  const showHistory = async (config: AdminSystemConfig) => {
    setHistoryId(config.id); setHistory([]); setError("");
    try { setHistory(await adminService.getConfigHistory(config.id, 50)); } catch (err) { setError(getApiErrorMessage(err)); }
  };
  const remove = (config: AdminSystemConfig) => {
    if (reason.trim().length < 3) { setError("Nhập lý do xóa cấu hình trước khi tiếp tục."); return; }
    Alert.alert("Xóa cấu hình?", `Xóa ${config.configKey} và ghi lại thay đổi trong lịch sử?`, [
      { text: "Hủy", style: "cancel" }, { text: "Xóa cấu hình", style: "destructive", onPress: () => { setBusy(true); void adminService.deleteConfig(config.id, reason.trim()).then(() => { resetForm(); return load(); }).catch((err) => setError(getApiErrorMessage(err))).finally(() => setBusy(false)); } },
    ]);
  };
  if (loading) return <LoadingSpinner label="Đang tải cấu hình hệ thống…" />;
  return <AppScreen title="Cấu hình hệ thống" description="Xem, cập nhật cấu hình và tra cứu lịch sử thay đổi.">
    <AdminNavigation active="configs" />
    {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
    <Card style={styles.form}>
      <View style={styles.formHeading}><Text style={styles.sectionTitle}>{editing ? "Cập nhật cấu hình" : "Thêm cấu hình"}</Text>{editing ? <Button title="Bỏ chọn" variant="ghost" onPress={resetForm} /> : null}</View>
      <Input label="Khóa cấu hình" value={key} onChangeText={setKey} placeholder="app.feature_enabled" autoCapitalize="none" autoCorrect={false} maxLength={100} />
      <Input label="Giá trị" value={value} onChangeText={setValue} multiline maxLength={5000} />
      <Text style={styles.fieldLabel}>Kiểu dữ liệu</Text><View style={styles.chips}>{valueTypes.map((item) => <Chip key={item} label={item} selected={type === item} onPress={() => setType(item)} />)}</View>
      <Input label="Mô tả" value={description} onChangeText={setDescription} maxLength={255} />
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: isPublic }} onPress={() => setIsPublic(!isPublic)} style={styles.switchRow}><View style={[styles.switch, isPublic && styles.switchOn]}><View style={[styles.switchThumb, isPublic && styles.switchThumbOn]} /></View><Text style={styles.fieldLabel}>Công khai qua API cấu hình công khai</Text></Pressable>
      <Input label={editing ? "Lý do cập nhật" : "Lý do (không bắt buộc)"} value={reason} onChangeText={setReason} maxLength={255} />
      <Button title={editing ? "Lưu cấu hình" : "Tạo cấu hình"} loading={busy} onPress={() => void save()} />
      {editing ? <Button title="Xóa cấu hình" variant="danger" loading={busy} onPress={() => remove(editing)} /> : null}
    </Card>
    <Input label="Tìm cấu hình" value={q} onChangeText={setQ} placeholder="Khóa hoặc mô tả" />
    {items.length === 0 ? <Card><EmptyState icon="tune-variant" title="Không tìm thấy cấu hình" description="Kiểm tra từ khóa hoặc tạo cấu hình mới." /></Card> : null}
    <View style={styles.list}>{items.map((config) => <Card key={config.id} style={styles.config}>
      <Text style={styles.key}>{config.configKey}</Text><Text selectable style={styles.value}>{config.configValue}</Text><Text style={styles.meta}>{config.valueType} · {config.isPublic ? "Công khai" : "Riêng tư"} · Cập nhật {new Date(config.updatedAt).toLocaleString("vi-VN")}</Text>{config.description ? <Text style={styles.meta}>{config.description}</Text> : null}
      <View style={styles.actions}><Button title="Sửa" variant="secondary" onPress={() => edit(config)} style={styles.flex} /><Button title="Lịch sử" variant="secondary" loading={historyId === config.id && busy} onPress={() => void showHistory(config)} style={styles.flex} /></View>
      {historyId === config.id ? <View style={styles.history}><Text style={styles.historyHeading}>Lịch sử thay đổi</Text>{history.length === 0 ? <Text style={styles.meta}>Chưa có thay đổi được ghi nhận.</Text> : history.map((entry) => <View key={entry.id} style={styles.historyEntry}><Text style={styles.historyAction}>{entry.action} · {new Date(entry.changedAt).toLocaleString("vi-VN")}</Text><Text numberOfLines={3} style={styles.meta}>{entry.oldValue ?? "(chưa có)"} → {entry.newValue}</Text>{entry.reason ? <Text style={styles.meta}>Lý do: {entry.reason}</Text> : null}</View>)}</View> : null}
    </Card>)}</View>
  </AppScreen>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ form: { gap: spacing.md }, formHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" }, fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, chip: { minHeight: 34, paddingHorizontal: spacing.md, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, backgroundColor: colors.surface }, chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, chipText: { color: colors.muted, fontSize: 11, fontWeight: "700" }, chipTextSelected: { color: colors.primaryDark }, switchRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: spacing.sm }, switch: { width: 42, height: 25, padding: 3, justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.neutralSoft }, switchOn: { backgroundColor: colors.primary }, switchThumb: { width: 19, height: 19, borderRadius: radii.pill, backgroundColor: colors.surface }, switchThumbOn: { alignSelf: "flex-end" }, list: { gap: spacing.sm }, config: { gap: spacing.sm }, key: { color: colors.ink, fontSize: 15, fontWeight: "800" }, value: { color: colors.primaryDark, fontSize: 13, lineHeight: 19 }, meta: { color: colors.muted, fontSize: 11, lineHeight: 17 }, actions: { flexDirection: "row", gap: spacing.sm }, flex: { flex: 1 }, history: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, historyHeading: { color: colors.ink, fontSize: 13, fontWeight: "800" }, historyEntry: { gap: 3, paddingVertical: spacing.xs }, historyAction: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" }, });
