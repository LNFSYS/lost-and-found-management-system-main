import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import { getApiErrorMessage, notificationService, type NotificationCategory, type NotificationEmailMode, type NotificationPreferences } from "@/services/api";

const categories: { key: NotificationCategory; label: string }[] = [
  { key: "MATCH", label: "Gợi ý khớp" }, { key: "CLAIM", label: "Yêu cầu nhận đồ" }, { key: "CHAT", label: "Tin nhắn" },
  { key: "APPOINTMENT", label: "Lịch hẹn" }, { key: "HANDOVER", label: "Bàn giao" }, { key: "CUSTODY", label: "Tiếp nhận và lưu kho" },
  { key: "OVERDUE", label: "Nhắc hạn" }, { key: "FEEDBACK", label: "Đánh giá" },
];
const modes: { value: NotificationEmailMode; label: string }[] = [
  { value: "IMMEDIATE", label: "Ngay" }, { value: "DELAYED_UNREAD", label: "Nếu chưa đọc" }, { value: "DIGEST", label: "Tổng hợp" }, { value: "DISABLED", label: "Tắt" },
];

export default function NotificationPreferencesScreen() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [timezone, setTimezone] = useState("Asia/Ho_Chi_Minh");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => { let active = true; const timer = setTimeout(() => { void notificationService.getPreferences().then((data) => { if (!active) return; setPreferences(data); setStart(data.quietHoursStart ?? ""); setEnd(data.quietHoursEnd ?? ""); setTimezone(data.timezone); }).catch((err) => { if (active) setError(getApiErrorMessage(err)); }).finally(() => { if (active) setLoading(false); }); }, 0); return () => { active = false; clearTimeout(timer); }; }, []);

  const changeMode = (key: NotificationCategory, emailMode: NotificationEmailMode) => setPreferences((current) => current ? ({ ...current, categories: { ...current.categories, [key]: { ...current.categories[key], emailMode } } }) : current);
  const save = async () => {
    if (!preferences) return;
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if ((start.trim() === "") !== (end.trim() === "") || (start && !timePattern.test(start)) || (end && !timePattern.test(end))) { setError("Nhập cả giờ bắt đầu và kết thúc theo định dạng HH:mm, hoặc để trống cả hai."); return; }
    setSaving(true); setError("");
    try {
      const saved = await notificationService.updatePreferences({ chatMode: preferences.chatMode, claimMode: preferences.claimMode, categories: preferences.categories, quietHoursStart: start || null, quietHoursEnd: end || null, timezone: timezone.trim() });
      setPreferences(saved); setStart(saved.quietHoursStart ?? ""); setEnd(saved.quietHoursEnd ?? ""); setTimezone(saved.timezone); router.back();
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setSaving(false); }
  };
  if (loading) return <LoadingSpinner label="Đang tải tùy chọn…" />;
  return <AppScreen title="Cài đặt thông báo" description="Tùy chỉnh email và khung giờ yên tĩnh cho tài khoản của bạn.">
    {error ? <ErrorBanner message={error} /> : null}
    {!preferences ? <Button title="Thử tải lại" variant="secondary" onPress={() => { setLoading(true); void notificationService.getPreferences().then(setPreferences).catch((err) => setError(getApiErrorMessage(err))).finally(() => setLoading(false)); }} /> : null}
    <Card style={styles.card}>
      <Text style={styles.sectionTitle}>Email theo nhóm</Text>
      <Text style={styles.help}>Thông báo trong ứng dụng vẫn được giữ nguyên.</Text>
      {categories.map(({ key, label }) => <View key={key} style={styles.preferenceRow}>
        <Text style={styles.category}>{label}</Text>
        <View style={styles.modeList}>{modes.map((mode) => <Pressable key={mode.value} accessibilityRole="radio" accessibilityState={{ selected: preferences?.categories[key]?.emailMode === mode.value }} onPress={() => changeMode(key, mode.value)} style={[styles.modeChip, preferences?.categories[key]?.emailMode === mode.value && styles.modeSelected]}>
          <Text style={[styles.modeText, preferences?.categories[key]?.emailMode === mode.value && styles.modeTextSelected]}>{mode.label}</Text>
        </Pressable>)}</View>
      </View>)}
    </Card>
    <Card style={styles.card}>
      <Text style={styles.sectionTitle}>Khung giờ yên tĩnh</Text>
      <Text style={styles.help}>Email bị hoãn trong khung giờ này, theo múi giờ đã chọn.</Text>
      <View style={styles.timeRow}><Input label="Bắt đầu" value={start} onChangeText={setStart} placeholder="22:00" keyboardType="numbers-and-punctuation" maxLength={5} style={styles.timeInput} /><Input label="Kết thúc" value={end} onChangeText={setEnd} placeholder="07:00" keyboardType="numbers-and-punctuation" maxLength={5} style={styles.timeInput} /></View>
      <Input label="Múi giờ IANA" value={timezone} onChangeText={setTimezone} placeholder="Asia/Ho_Chi_Minh" autoCapitalize="none" autoCorrect={false} />
    </Card>
    <Button title="Lưu cài đặt" loading={saving} onPress={() => void save()} />
  </AppScreen>;
}

const styles = StyleSheet.create({ card: { gap: spacing.md }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" }, help: { color: colors.muted, fontSize: 13, lineHeight: 19 }, preferenceRow: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, category: { color: colors.ink, fontSize: 14, fontWeight: "700" }, modeList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, modeChip: { minHeight: 34, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, justifyContent: "center", backgroundColor: colors.surface }, modeSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, modeText: { color: colors.muted, fontSize: 11, fontWeight: "700" }, modeTextSelected: { color: colors.primaryDark }, timeRow: { flexDirection: "row", gap: spacing.md }, timeInput: { flex: 1 },
});
