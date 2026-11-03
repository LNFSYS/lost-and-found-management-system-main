import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { PostCard } from "@/components/post-card";
import { countActiveFilters, PostFilterSheet } from "@/components/post-filter-sheet";
import { PostSearchBar } from "@/components/post-search-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { colors, radii, spacing } from "@/constants/theme";
import {
  getApiErrorMessage,
  postService,
  type PostCatalog,
  type PostListFilters,
  type PostSummary,
} from "@/services/api";

type TabMode = "explore" | "mine";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Đang mở",
  MATCHED: "Đã ghép đôi",
  RESOLVED: "Đã giải quyết",
  CLOSED: "Đã đóng",
};

const SORT_LABELS: Record<string, string> = {
  newest: "Mới nhất",
  incident_newest: "Mới xảy ra",
  incident_oldest: "Cũ nhất (sự việc)",
  oldest: "Cũ nhất",
};

export interface PostsScreenProps {
  defaultTab?: TabMode;
}

export default function PostsScreen({ defaultTab }: PostsScreenProps) {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: TabMode = defaultTab ?? (params.tab === "mine" ? "mine" : "explore");

  const [activeTab, setActiveTab] = useState<TabMode>(initialTab);
  const [prevParamTab, setPrevParamTab] = useState<string | undefined>(params.tab);

  // Sync tab during render if params change externally
  if (params.tab !== prevParamTab) {
    setPrevParamTab(params.tab);
    if (params.tab === "mine" || params.tab === "explore") {
      setActiveTab(params.tab);
    }
  }

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [filterSheetVisible, setFilterSheetVisible] = useState<boolean>(false);
  const [catalog, setCatalog] = useState<PostCatalog | null>(null);

  const [filters, setFilters] = useState<PostListFilters>({
    sort: "newest",
    q: "",
    type: undefined,
    status: undefined,
    categoryId: undefined,
  });

  // Load catalog on mount for chip labels and filter sheet
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      postService
        .getPostCatalog()
        .then((data) => {
          if (active) setCatalog(data);
        })
        .catch(() => undefined);
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  // Main fetch function
  const fetchPosts = useCallback(
    async (
      targetTab: TabMode,
      targetFilters: PostListFilters,
      targetPage: number,
      isRefresh = false,
      isLoadMore = false
    ) => {
      if (isLoadMore) {
        setLoadingMore(true);
      } else if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoadingInitial(true);
      }
      setErrorMessage(null);

      const queryParams: PostListFilters = {
        ...targetFilters,
        page: targetPage,
        pageSize,
      };

      try {
        const response =
          targetTab === "mine"
            ? await postService.listMyPosts(queryParams)
            : await postService.listPosts(queryParams);

        setTotal(response.total);
        setPage(targetPage);

        if (targetPage === 1) {
          setPosts(response.items);
        } else {
          setPosts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newItems = response.items.filter((item) => !existingIds.has(item.id));
            return [...prev, ...newItems];
          });
        }
      } catch (err) {
        setErrorMessage(getApiErrorMessage(err));
      } finally {
        setLoadingInitial(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Trigger fetch when tab or filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPosts(activeTab, filters, 1);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab, filters, fetchPosts]);

  // Pull-to-refresh
  const handleRefresh = useCallback(() => {
    fetchPosts(activeTab, filters, 1, true);
  }, [activeTab, filters, fetchPosts]);

  // Infinite scroll load more
  const handleLoadMore = useCallback(() => {
    if (loadingInitial || refreshing || loadingMore) return;
    if (posts.length >= total) return;
    const nextPage = page + 1;
    fetchPosts(activeTab, filters, nextPage, false, true);
  }, [loadingInitial, refreshing, loadingMore, posts.length, total, page, activeTab, filters, fetchPosts]);

  // Search input handler
  const handleSearchChange = useCallback((text: string) => {
    setFilters((prev) => ({
      ...prev,
      q: text.trim() ? text.trim() : undefined,
    }));
  }, []);

  // Filter sheet apply handler
  const handleApplyFilters = useCallback((newFilters: PostListFilters) => {
    setFilters(newFilters);
  }, []);

  // Reset filters handler
  const handleResetFilters = useCallback(() => {
    setFilters({
      sort: "newest",
      q: undefined,
      type: undefined,
      status: undefined,
      categoryId: undefined,
    });
  }, []);

  // Remove specific filter chip
  const removeFilter = (key: keyof PostListFilters) => {
    setFilters((prev) => ({
      ...prev,
      [key]: key === "sort" ? "newest" : undefined,
    }));
  };

  const activeFilterCount = countActiveFilters(filters);
  const categoryName = catalog?.categories.find((c) => c.id === filters.categoryId)?.name;

  const hasAnyFilterOrSearch =
    Boolean(filters.q) ||
    Boolean(filters.type) ||
    Boolean(filters.status) ||
    Boolean(filters.categoryId) ||
    (Boolean(filters.sort) && filters.sort !== "newest");

  // Count suggestions in mine tab
  const totalSuggestionsInMine =
    activeTab === "mine"
      ? posts.reduce((sum, p) => sum + (p.matchSummary?.suggestionCount ?? 0), 0)
      : 0;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.brandRow}>
              <Text style={styles.brandText}>FPTU LOST &amp; FOUND</Text>
            </View>
            <Text style={styles.title}>Bảng tin Thất lạc &amp; Nhặt được</Text>
          </View>
          <Pressable
            onPress={() => router.push("/posts/create")}
            style={({ pressed }) => [
              styles.headerCreateBtn,
              pressed && styles.headerCreateBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Đăng tin mới"
          >
            <MaterialCommunityIcons name="plus" size={18} color={colors.surface} />
            <Text style={styles.headerCreateBtnText}>Đăng tin</Text>
          </Pressable>
        </View>
      </View>

      {/* Segmented Tab Bar */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab("explore")}
          style={[styles.tabButton, activeTab === "explore" && styles.tabButtonActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "explore" }}
        >
          <MaterialCommunityIcons
            name="view-grid-outline"
            size={18}
            color={activeTab === "explore" ? colors.primary : colors.muted}
            style={styles.tabIcon}
          />
          <Text
            style={[styles.tabText, activeTab === "explore" && styles.tabTextActive]}
          >
            Tất cả bài đăng
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("mine")}
          style={[styles.tabButton, activeTab === "mine" && styles.tabButtonActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "mine" }}
        >
          <MaterialCommunityIcons
            name="clipboard-account-outline"
            size={18}
            color={activeTab === "mine" ? colors.primary : colors.muted}
            style={styles.tabIcon}
          />
          <Text
            style={[styles.tabText, activeTab === "mine" && styles.tabTextActive]}
          >
            Bài của tôi
          </Text>
          {totalSuggestionsInMine > 0 ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {totalSuggestionsInMine > 99 ? "99+" : totalSuggestionsInMine}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Search Bar + Filter Action Button */}
      <View style={styles.searchRow}>
        <PostSearchBar
          value={filters.q || ""}
          onChangeText={handleSearchChange}
          placeholder="Tìm theo đồ vật, địa điểm, tiêu đề…"
          style={styles.searchBar}
        />

        <Pressable
          onPress={() => setFilterSheetVisible(true)}
          style={[
            styles.filterButton,
            activeFilterCount > 0 && styles.filterButtonActive,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Bộ lọc bài đăng"
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={20}
            color={activeFilterCount > 0 ? colors.primary : colors.ink}
          />
          {activeFilterCount > 0 ? (
            <View style={styles.filterCountBadge}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Active Filter Chips Row */}
      {hasAnyFilterOrSearch ? (
        <View style={styles.chipsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
          >
            {filters.q ? (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText} numberOfLines={1}>
                  {`"${filters.q}"`}
                </Text>
                <Pressable
                  onPress={() => removeFilter("q")}
                  hitSlop={6}
                  style={styles.removeChipButton}
                >
                  <MaterialCommunityIcons name="close" size={14} color={colors.primaryDark} />
                </Pressable>
              </View>
            ) : null}

            {filters.type ? (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>
                  {filters.type === "LOST" ? "Đồ mất" : "Đồ nhặt"}
                </Text>
                <Pressable
                  onPress={() => removeFilter("type")}
                  hitSlop={6}
                  style={styles.removeChipButton}
                >
                  <MaterialCommunityIcons name="close" size={14} color={colors.primaryDark} />
                </Pressable>
              </View>
            ) : null}

            {filters.status ? (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>
                  {STATUS_LABELS[filters.status] || filters.status}
                </Text>
                <Pressable
                  onPress={() => removeFilter("status")}
                  hitSlop={6}
                  style={styles.removeChipButton}
                >
                  <MaterialCommunityIcons name="close" size={14} color={colors.primaryDark} />
                </Pressable>
              </View>
            ) : null}

            {filters.categoryId && categoryName ? (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText} numberOfLines={1}>
                  {categoryName}
                </Text>
                <Pressable
                  onPress={() => removeFilter("categoryId")}
                  hitSlop={6}
                  style={styles.removeChipButton}
                >
                  <MaterialCommunityIcons name="close" size={14} color={colors.primaryDark} />
                </Pressable>
              </View>
            ) : null}

            {filters.sort && filters.sort !== "newest" ? (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>
                  {SORT_LABELS[filters.sort] || filters.sort}
                </Text>
                <Pressable
                  onPress={() => removeFilter("sort")}
                  hitSlop={6}
                  style={styles.removeChipButton}
                >
                  <MaterialCommunityIcons name="close" size={14} color={colors.primaryDark} />
                </Pressable>
              </View>
            ) : null}

            <Pressable
              onPress={handleResetFilters}
              style={styles.clearAllChip}
              hitSlop={6}
            >
              <Text style={styles.clearAllText}>Xóa tất cả</Text>
            </Pressable>
          </ScrollView>
        </View>
      ) : null}

      {/* Suggestion Callout banner on My Posts tab if suggestions exist */}
      {activeTab === "mine" && totalSuggestionsInMine > 0 ? (
        <View style={styles.suggestionBanner}>
          <MaterialCommunityIcons name="radar" size={20} color={colors.accent} />
          <Text style={styles.suggestionBannerText}>
            Bạn có <Text style={styles.suggestionHighlight}>{totalSuggestionsInMine}</Text> gợi ý
            ghép đôi cần xác nhận trên các bài đăng của mình!
          </Text>
        </View>
      ) : null}

      {/* Main FlatList Feed */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          errorMessage ? (
            <View style={styles.errorContainer}>
              <ErrorBanner message={errorMessage} onRetry={handleRefresh} />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          loadingInitial ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Đang tải danh sách bài đăng…</Text>
            </View>
          ) : !errorMessage ? (
            <View style={styles.emptyContainer}>
              {activeTab === "mine" ? (
                <EmptyState
                  icon="clipboard-outline"
                  title="Bạn chưa có bài đăng nào"
                  description="Các bài báo mất hoặc báo nhặt do bạn đăng tải sẽ xuất hiện tại đây."
                />
              ) : hasAnyFilterOrSearch ? (
                <View style={styles.emptyFilterWrapper}>
                  <EmptyState
                    icon="text-box-search-outline"
                    title="Không tìm thấy bài đăng phù hợp"
                    description="Hãy thử thay đổi từ khóa hoặc đặt lại bộ lọc để xem các bài khác."
                  />
                  <Pressable
                    onPress={handleResetFilters}
                    style={styles.emptyResetButton}
                  >
                    <MaterialCommunityIcons name="refresh" size={16} color={colors.primary} />
                    <Text style={styles.emptyResetText}>Đặt lại bộ lọc</Text>
                  </Pressable>
                </View>
              ) : (
                <EmptyState
                  icon="newspaper-variant-outline"
                  title="Chưa có bài đăng nào"
                  description="Hiện tại chưa có tin báo mất hoặc nhặt được nào trong hệ thống."
                />
              )}
            </View>
          ) : undefined
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.footerLoaderText}>Đang tải thêm…</Text>
            </View>
          ) : posts.length > 0 && posts.length >= total ? (
            <View style={styles.endListTextContainer}>
              <Text style={styles.endListText}>Đã hiển thị tất cả {total} bài đăng</Text>
            </View>
          ) : undefined
        }
      />

      {/* Filter Bottom Sheet */}
      <PostFilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        filters={filters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        initialCatalog={catalog}
      />

      {/* Floating Action Button */}
      <Pressable
        onPress={() => router.push("/posts/create")}
        style={({ pressed }) => [
          styles.fab,
          pressed && styles.fabPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Đăng tin mới"
      >
        <MaterialCommunityIcons name="plus" size={20} color={colors.surface} />
        <Text style={styles.fabText}>Đăng tin</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  headerCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    gap: 4,
  },
  headerCreateBtnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  headerCreateBtnText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "700",
  },
  fab: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  fabText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "700",
  },
  brandRow: {
    marginBottom: 2,
  },
  brandText: {
    color: colors.primary,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "800",
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: radii.control - 2,
    gap: 6,
    position: "relative",
  },
  tabButtonActive: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabIcon: {
    marginRight: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  tabBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    marginLeft: 2,
  },
  tabBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterCountBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: colors.accent,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  filterCountText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  chipsWrapper: {
    marginTop: spacing.sm,
  },
  chipsContainer: {
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(11, 99, 182, 0.25)",
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: radii.pill,
    gap: 4,
  },
  activeChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primaryDark,
    maxWidth: 140,
  },
  removeChipButton: {
    padding: 2,
  },
  clearAllChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.danger,
  },
  suggestionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(243, 111, 33, 0.25)",
    borderRadius: radii.control,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  suggestionBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "#9A4B13",
    fontWeight: "500",
  },
  suggestionHighlight: {
    fontWeight: "800",
    color: colors.accent,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + 20,
    gap: spacing.md,
  },
  errorContainer: {
    marginBottom: spacing.md,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.muted,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyFilterWrapper: {
    alignItems: "center",
    gap: spacing.md,
  },
  emptyResetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.control,
  },
  emptyResetText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  footerLoaderText: {
    fontSize: 13,
    color: colors.muted,
  },
  endListTextContainer: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  endListText: {
    fontSize: 12,
    color: colors.muted,
  },
});
