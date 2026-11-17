import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, radii, spacing } from "@/constants/theme";
import { postService, type PostCatalog, type PostListFilters, type PostSummary } from "@/services/api";

export interface PostFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: PostListFilters;
  onApply: (filters: PostListFilters) => void;
  onReset: () => void;
  initialCatalog?: PostCatalog | null;
}

export function countActiveFilters(filters: PostListFilters): number {
  let count = 0;
  if (filters.type) count++;
  if (filters.status) count++;
  if (filters.categoryId) count++;
  if (filters.sort && filters.sort !== "newest") count++;
  return count;
}

export function PostFilterSheet({
  visible,
  onClose,
  filters,
  onApply,
  onReset,
  initialCatalog = null,
}: PostFilterSheetProps) {
  const [draftFilters, setDraftFilters] = useState<PostListFilters>(filters);
  const [prevVisible, setPrevVisible] = useState<boolean>(visible);
  const [catalog, setCatalog] = useState<PostCatalog | null>(initialCatalog);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(!initialCatalog);

  // Sync draft filters when modal opens
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setDraftFilters({ ...filters });
    }
  }

  // Load catalog if needed
  useEffect(() => {
    if (!catalog && visible) {
      let active = true;
      const timer = setTimeout(() => {
        setCatalogLoading(true);
        postService
          .getPostCatalog()
          .then((res) => {
            if (active) setCatalog(res);
          })
          .catch(() => undefined)
          .finally(() => {
            if (active) setCatalogLoading(false);
          });
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [catalog, visible]);

  const handleApply = () => {
    onApply(draftFilters);
    onClose();
  };

  const handleReset = () => {
    const emptyFilters: PostListFilters = {
      q: draftFilters.q,
      type: undefined,
      status: undefined,
      categoryId: undefined,
      sort: "newest",
    };
    setDraftFilters(emptyFilters);
    onReset();
    onClose();
  };

  const postTypes: { label: string; value?: "LOST" | "FOUND" }[] = [
    { label: "Tất cả", value: undefined },
    { label: "Đồ mất (LOST)", value: "LOST" },
    { label: "Đồ nhặt (FOUND)", value: "FOUND" },
  ];

  const postStatuses: { label: string; value?: PostSummary["status"] }[] = [
    { label: "Tất cả", value: undefined },
    { label: "Đang mở", value: "OPEN" },
    { label: "Đã ghép đôi", value: "MATCHED" },
    { label: "Đã giải quyết", value: "RESOLVED" },
    { label: "Đã đóng", value: "CLOSED" },
  ];

  const sortOptions: {
    label: string;
    value: NonNullable<PostListFilters["sort"]>;
  }[] = [
    { label: "Mới đăng nhất", value: "newest" },
    { label: "Mới xảy ra nhất", value: "incident_newest" },
    { label: "Cũ nhất theo sự việc", value: "incident_oldest" },
    { label: "Cũ nhất", value: "oldest" },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.sheetContainer}>
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Bộ lọc tìm kiếm</Text>
              <Text style={styles.headerSubtitle}>Tùy chỉnh danh sách bài đăng</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Đóng bộ lọc"
            >
              <MaterialCommunityIcons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Section: Loại bài đăng */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Loại bài đăng</Text>
              <View style={styles.chipRow}>
                {postTypes.map((item) => {
                  const isSelected = draftFilters.type === item.value;
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          type: item.value,
                        }))
                      }
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                        item.value === "LOST" && isSelected && styles.lostChipSelected,
                        item.value === "FOUND" && isSelected && styles.foundChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Section: Trạng thái */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trạng thái</Text>
              <View style={styles.chipRow}>
                {postStatuses.map((item) => {
                  const isSelected = draftFilters.status === item.value;
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          status: item.value,
                        }))
                      }
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Section: Danh mục */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Danh mục</Text>
              {catalogLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Đang tải danh mục…</Text>
                </View>
              ) : (
                <View style={styles.chipRow}>
                  <Pressable
                    onPress={() =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        categoryId: undefined,
                      }))
                    }
                    style={[
                      styles.chip,
                      !draftFilters.categoryId && styles.chipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        !draftFilters.categoryId && styles.chipTextSelected,
                      ]}
                    >
                      Tất cả danh mục
                    </Text>
                  </Pressable>
                  {catalog?.categories.map((cat) => {
                    const isSelected = draftFilters.categoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            categoryId: cat.id,
                          }))
                        }
                        style={[
                          styles.chip,
                          isSelected && styles.chipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextSelected,
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Section: Sắp xếp */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sắp xếp theo</Text>
              <View style={styles.chipRow}>
                {sortOptions.map((item) => {
                  const isSelected =
                    (draftFilters.sort || "newest") === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          sort: item.value,
                        }))
                      }
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <SafeAreaView edges={["bottom"]} style={styles.footer}>
            <Pressable
              onPress={handleReset}
              style={({ pressed }) => [
                styles.resetButton,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="refresh"
                size={18}
                color={colors.ink}
              />
              <Text style={styles.resetButtonText}>Đặt lại</Text>
            </Pressable>

            <Pressable
              onPress={handleApply}
              style={({ pressed }) => [
                styles.applyButton,
                pressed && { opacity: 0.88 },
              ]}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="check"
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.applyButtonText}>Áp dụng</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "86%",
    minHeight: 460,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.muted,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: 0.2,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  lostChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  foundChipSelected: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    fontSize: 13,
    color: colors.muted,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  resetButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    height: 48,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  applyButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    height: 48,
    borderRadius: radii.control,
    backgroundColor: colors.primary,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
