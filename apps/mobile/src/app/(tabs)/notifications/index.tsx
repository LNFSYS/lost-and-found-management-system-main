import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useNotificationCount } from "@/context/notification-count-context";
import { getApiErrorMessage, notificationService, type AppNotification } from "@/services/api";

const labels: Record<string, string> = {
  MATCH_FOUND: "Gợi ý khớp mới", CLAIM_REQUEST_RECEIVED: "Yêu cầu nhận lại đồ", CLAIM_ACCEPTED: "Yêu cầu nhận lại được chấp nhận",
  CLAIM_MORE_INFO_REQUESTED: "Cần thêm thông tin", CLAIM_REJECTED: "Yêu cầu nhận lại bị từ chối", CLAIM_WITHDRAWN: "Yêu cầu nhận lại đã rút",
  APPOINTMENT_PROPOSED: "Lịch hẹn mới", APPOINTMENT_ACCEPTED: "Lịch hẹn được chấp nhận", APPOINTMENT_REJECTED: "Lịch hẹn bị từ chối",
  APPOINTMENT_REMINDER: "Nhắc lịch hẹn", RETURN_COMPLETED: "Đã hoàn tất trao trả", CHAT_MESSAGE_RECEIVED: "Tin nhắn mới",
  CUSTODY_REQUEST_CREATED: "Yêu cầu chuyển kho", CUSTODY_ACCEPTED: "Đã nhận yêu cầu kho", CUSTODY_REJECTED: "Yêu cầu kho bị từ chối",
  CUSTODY_OVERDUE: "Vật phẩm lưu kho quá hạn", WAREHOUSE_OVERDUE: "Vật phẩm lưu kho quá hạn", WAREHOUSE_DUE_SOON: "Sắp đến hạn lưu kho",
  FEEDBACK_RECEIVED: "Đánh giá mới",
};

function notificationRoute(item: AppNotification, isStaff: boolean) {
  const id = item.entityId;
  if (!id) return null;
  const type = item.type.toUpperCase();
  const entity = item.entityType?.toUpperCase();
  if (type === "MATCH_FOUND" || entity === "POST_MATCH") return `/posts/${id}/matches`;
  if (["CLAIM", "CHAT"].includes(entity ?? "") || type.startsWith("CLAIM_") || type === "CHAT_MESSAGE_RECEIVED") return `/claims/${id}`;
  if (entity === "APPOINTMENT" || type.startsWith("APPOINTMENT_") || type === "RETURN_COMPLETED") return `/appointments/${id}`;
  if (entity === "POST" || type === "MATCH_FOUND") return `/posts/${id}`;
  if (["CUSTODY_REQUEST", "CUSTODY"].includes(entity ?? "") || type.startsWith("CUSTODY_")) return isStaff ? `/staff/custody/${id}` : `/custody/${id}`;
  if (["WAREHOUSE_ITEM", "WAREHOUSE"].includes(entity ?? "") || type.startsWith("WAREHOUSE_")) return isStaff ? `/staff/warehouse/${id}` : null;
  return null;
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { refreshUnreadCount } = useNotificationCount();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isStaff = Boolean(user?.roles.some((role) => role === "STAFF" || role === "ADMIN"));
  const load = useCallback(async (refresh = false) => {
    setError("");
    if (refresh) setRefreshing(true);
    try { setItems((await notificationService.list(50)).items); }
    catch (err) { setError(getApiErrorMessage(err)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  const openNotification = async (item: AppNotification) => {
    try {
      if (!item.isRead) {
        await notificationService.markRead(item.id);
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
        await refreshUnreadCount();
      }
      const destination = notificationRoute(item, isStaff);
      if (destination) router.push(destination as never);
    } catch (err) { setError(getApiErrorMessage(err)); }
  };
  const markAll = async () => {
    setBusy(true); setError("");
    try { await notificationService.markAllRead(); setItems((current) => current.map((item) => ({ ...item, isRead: true }))); await refreshUnreadCount(); }
    catch (err) { setError(getApiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  if (loading) return <LoadingSpinner label="Đang tải thông báo…" />;
  return <AppScreen title="Thông báo" description="Cập nhật về gợi ý khớp, yêu cầu nhận đồ, tin nhắn và lịch hẹn.">
    <View style={styles.actions}>
      <Button title="Cài đặt nhận thông báo" variant="secondary" onPress={() => router.push("/notifications/preferences" as never)} style={styles.actionButton} />
      <Button title="Đọc tất cả" variant="ghost" loading={busy} disabled={!items.some((item) => !item.isRead)} onPress={() => void markAll()} style={styles.actionButton} />
    </View>
    {error ? <ErrorBanner message={error} onRetry={() => void load(true)} /> : null}
    {items.length === 0 ? <Card><EmptyState icon="bell-check-outline" title="Bạn đã cập nhật" description="Thông báo mới sẽ xuất hiện ở đây." /></Card> : null}
    <View style={styles.list}>
      {items.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => void openNotification(item)}>
        <Card style={[styles.notification, !item.isRead && styles.unread]}>
          <View style={[styles.icon, { backgroundColor: item.isRead ? colors.surfaceMuted : colors.primarySoft }]}>
            <MaterialCommunityIcons name={notificationIcon(item.type)} size={21} color={item.isRead ? colors.muted : colors.primary} />
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}><Text style={styles.type}>{labels[item.type] ?? item.type.replaceAll("_", " ")}</Text>{!item.isRead ? <View style={styles.unreadDot} /> : null}</View>
            <Text style={styles.title}>{item.title}</Text>
            {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleString("vi-VN")}</Text>
          </View>
        </Card>
      </Pressable>)}
    </View>
    <View style={styles.refresh}><Button title="Tải lại" variant="secondary" loading={refreshing} onPress={() => void load(true)} /></View>
  </AppScreen>;
}

function notificationIcon(type: string): React.ComponentProps<typeof MaterialCommunityIcons>["name"] {
  if (type.includes("MATCH")) return "swap-horizontal";
  if (type.includes("CLAIM")) return "shield-check-outline";
  if (type.includes("APPOINTMENT") || type.includes("RETURN")) return "calendar-check-outline";
  if (type.includes("CHAT")) return "message-text-outline";
  if (type.includes("CUSTODY") || type.includes("WAREHOUSE")) return "archive-outline";
  return "bell-outline";
}
const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, actionButton: { flexGrow: 1 }, list: { gap: spacing.sm },
  notification: { flexDirection: "row", gap: spacing.md, padding: spacing.md }, unread: { borderColor: colors.primary },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, minWidth: 0, gap: 5 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, type: { color: colors.primary, fontSize: 11, fontWeight: "800" }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  title: { color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: "700" }, body: { color: colors.muted, fontSize: 13, lineHeight: 19 }, date: { color: colors.muted, fontSize: 11 }, refresh: { alignSelf: "stretch" },
});
