import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import { getApiErrorMessage, returnService, type CompletedReturn } from "@/services/api";

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Ngày chưa xác định" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AppointmentsScreen() {
  const [items, setItems] = useState<CompletedReturn[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      const response = await returnService.listCompleted(1);
      setItems(response.items);
      setPage(response.page);
      setHasMore(response.hasMore);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await returnService.listCompleted(page + 1);
      setItems((current) => [...current, ...response.items.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setPage(response.page);
      setHasMore(response.hasMore);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><LoadingSpinner label="Đang tải lịch hẹn…" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
        <View style={styles.header}>
          <View style={styles.headerIcon}><MaterialCommunityIcons name="calendar-check-outline" size={23} color={colors.primary} /></View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>TRAO TRẢ VẬT PHẨM</Text>
            <Text accessibilityRole="header" style={styles.title}>Lịch hẹn & đánh giá</Text>
            <Text style={styles.description}>Theo dõi các lần trao trả đã hoàn tất và gửi đánh giá cho người còn lại.</Text>
          </View>
        </View>

        {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>Lần trao trả gần đây</Text>
          <Text style={styles.count}>{items.length} mục</Text>
        </View>

        {items.length ? items.map((item) => {
          const rated = item.rating !== null;
          return (
            <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/appointments/[appointmentId]", params: { appointmentId: item.id, postTitle: item.postTitle } } as never)}>
              <Card style={styles.returnCard}>
                <View style={styles.cardTop}>
                  <View style={[styles.statusIcon, rated ? styles.ratedIcon : styles.pendingIcon]}>
                    <MaterialCommunityIcons name={rated ? "star-check-outline" : "star-outline"} size={19} color={rated ? colors.success : colors.warning} />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text numberOfLines={2} style={styles.itemTitle}>{item.postTitle}</Text>
                    <Text style={styles.dateText}>{dateTime(item.completedAt)}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={21} color={colors.muted} />
                </View>
                <View style={styles.cardFooter}>
                  {rated ? (
                    <>
                      <View style={styles.ratingStars}>
                        {Array.from({ length: 5 }, (_, index) => <MaterialCommunityIcons key={index} name={index < (item.rating ?? 0) ? "star" : "star-outline"} size={17} color={colors.warning} />)}
                      </View>
                      <Text style={styles.completedLabel}>Đã đánh giá</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.pendingLabel}>Chưa gửi đánh giá</Text>
                      <Text style={styles.rateAction}>Đánh giá</Text>
                    </>
                  )}
                </View>
              </Card>
            </Pressable>
          );
        }) : (
          <Card style={styles.emptyCard}>
            <EmptyState icon="calendar-blank-outline" title="Chưa có lần trao trả hoàn tất" description="Các lượt trao trả đã xác nhận sẽ xuất hiện tại đây để bạn có thể đánh giá." />
          </Card>
        )}

        {hasMore ? (
          <Pressable accessibilityRole="button" onPress={() => void loadMore()} disabled={loadingMore} style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}>
            {loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialCommunityIcons name="history" size={18} color={colors.primary} />}
            <Text style={styles.loadMoreText}>{loadingMore ? "Đang tải…" : "Tải thêm"}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", paddingTop: spacing.md },
  headerIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.primarySoft },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.9 },
  title: { color: colors.ink, fontSize: 23, lineHeight: 29, fontWeight: "900" },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  listHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  count: { color: colors.muted, fontSize: 12 },
  returnCard: { gap: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  statusIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  ratedIcon: { backgroundColor: colors.successSoft },
  pendingIcon: { backgroundColor: colors.warningSoft },
  cardCopy: { flex: 1, gap: 4 },
  itemTitle: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: "800" },
  dateText: { color: colors.muted, fontSize: 12 },
  cardFooter: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  ratingStars: { flexDirection: "row", alignItems: "center", gap: 1 },
  completedLabel: { color: colors.success, fontSize: 12, fontWeight: "800" },
  pendingLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  rateAction: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  emptyCard: { alignItems: "center" },
  loadMore: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  loadMoreText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.75 },
});
