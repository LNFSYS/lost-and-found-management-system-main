import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, radii, spacing } from "@/constants/theme";
import type { PostCatalog } from "@/services/api";

export interface CategoryItem {
  id: string;
  name: string;
  parentId: string | null;
}

export interface CategoryPickerModalProps {
  visible: boolean;
  onClose: () => void;
  categories: PostCatalog["categories"];
  selectedCategoryId: string | null;
  onSelectCategory: (category: CategoryItem) => void;
}

function removeDiacritics(str?: string | null): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getCategoryIcon(name?: string | null): keyof typeof MaterialCommunityIcons.glyphMap {
  if (!name) return "tag-outline";
  const lower = removeDiacritics(name);
  if (lower.includes("dien tu") || lower.includes("laptop") || lower.includes("may tinh") || lower.includes("dien thoai") || lower.includes("tai nghe")) {
    return "laptop";
  }
  if (lower.includes("vi") || lower.includes("tien") || lower.includes("bop")) {
    return "wallet-outline";
  }
  if (lower.includes("the") || lower.includes("giay to") || lower.includes("cccd") || lower.includes("can cuoc") || lower.includes("bang lai")) {
    return "card-account-details-outline";
  }
  if (lower.includes("chia khoa") || lower.includes("the xe")) {
    return "key-variant";
  }
  if (lower.includes("balo") || lower.includes("tui") || lower.includes("cap")) {
    return "bag-personal-outline";
  }
  if (lower.includes("sach") || lower.includes("vo") || lower.includes("giao trinh") || lower.includes("tai lieu") || lower.includes("but")) {
    return "book-open-page-variant-outline";
  }
  if (lower.includes("quan ao") || lower.includes("ao") || lower.includes("giay") || lower.includes("mu") || lower.includes("non")) {
    return "tshirt-crew-outline";
  }
  if (lower.includes("dong ho") || lower.includes("trang suc") || lower.includes("kinh")) {
    return "watch";
  }
  if (lower.includes("binh nuoc") || lower.includes("coc")) {
    return "bottle-tonic-outline";
  }
  return "tag-outline";
}

export function CategoryPickerModal({
  visible,
  onClose,
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  // Group categories into parents and child map
  const { parentCategories, childrenByParentId, categoryMap } = useMemo(() => {
    const parents: CategoryItem[] = [];
    const childMap = new Map<string, CategoryItem[]>();
    const allMap = new Map<string, CategoryItem>();

    categories.forEach((cat) => {
      allMap.set(cat.id, cat);
      if (cat.parentId === null || cat.parentId === undefined) {
        parents.push(cat);
      } else {
        const existing = childMap.get(cat.parentId) ?? [];
        existing.push(cat);
        childMap.set(cat.parentId, existing);
      }
    });

    return {
      parentCategories: parents,
      childrenByParentId: childMap,
      categoryMap: allMap,
    };
  }, [categories]);

  // Search results across all categories
  const searchResults = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return [];

    const normQuery = removeDiacritics(query);
    return categories.filter((cat) => {
      const normName = removeDiacritics(cat.name);
      return normName.includes(normQuery);
    });
  }, [searchQuery, categories]);

  const activeParent = selectedParentId ? categoryMap.get(selectedParentId) : null;
  const currentChildren = selectedParentId ? (childrenByParentId.get(selectedParentId) ?? []) : [];

  const handleSelect = (category: CategoryItem) => {
    onSelectCategory(category);
    setSearchQuery("");
    setSelectedParentId(null);
    onClose();
  };

  const handleBackToParents = () => {
    setSelectedParentId(null);
  };

  const handleModalClose = () => {
    setSearchQuery("");
    setSelectedParentId(null);
    onClose();
  };

  const isSearching = searchQuery.trim().length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleModalClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismiss} onPress={handleModalClose} />
        <View style={styles.sheetContainer}>
          <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitles}>
                <Text style={styles.headerTitle}>Chọn danh mục vật phẩm</Text>
                <Text style={styles.headerSubtitle}>
                  Phân loại rõ ràng giúp tìm kiếm và đối chiếu chính xác
                </Text>
              </View>
              <Pressable
                onPress={handleModalClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Đóng modal danh mục"
                style={styles.closeBtn}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBox}>
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color={colors.muted}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm nhanh danh mục (ví dụ: Ví, Thẻ, Tai nghe...)"
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  hitSlop={8}
                  style={styles.clearBtn}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color={colors.muted}
                  />
                </Pressable>
              ) : null}
            </View>

            {/* Content Area */}
            <ScrollView
              style={styles.contentList}
              contentContainerStyle={styles.contentContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {isSearching ? (
                /* Search Results View */
                <View style={styles.listSection}>
                  <Text style={styles.sectionHeader}>
                    Kết quả tìm kiếm ({searchResults.length})
                  </Text>
                  {searchResults.length === 0 ? (
                    <View style={styles.emptyState}>
                      <MaterialCommunityIcons
                        name="file-search-outline"
                        size={48}
                        color={colors.muted}
                      />
                      <Text style={styles.emptyStateTitle}>
                        Không tìm thấy danh mục phù hợp
                      </Text>
                      <Text style={styles.emptyStateDesc}>
                        Thử tìm kiếm với từ khóa khác hoặc duyệt theo danh mục cha
                      </Text>
                    </View>
                  ) : (
                    searchResults.map((item) => {
                      const isSelected = item.id === selectedCategoryId;
                      const parent = item.parentId ? categoryMap.get(item.parentId) : null;
                      const iconName = getCategoryIcon(item.name);

                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => handleSelect(item)}
                          accessibilityRole="button"
                          accessibilityLabel={item.name}
                          style={({ pressed }) => [
                            styles.categoryItem,
                            isSelected && styles.categoryItemSelected,
                            pressed && styles.itemPressed,
                          ]}
                        >
                          <View
                            style={[
                              styles.iconBox,
                              isSelected && styles.iconBoxSelected,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={iconName}
                              size={20}
                              color={isSelected ? colors.primary : colors.ink}
                            />
                          </View>
                          <View style={styles.itemTextContainer}>
                            <Text
                              style={[
                                styles.itemName,
                                isSelected && styles.itemNameSelected,
                              ]}
                            >
                              {item.name}
                            </Text>
                            <Text style={styles.itemSubtext}>
                              {parent ? `Nhóm: ${parent.name}` : "Nhóm danh mục chính"}
                            </Text>
                          </View>
                          {isSelected ? (
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={22}
                              color={colors.primary}
                            />
                          ) : (
                            <MaterialCommunityIcons
                              name="chevron-right"
                              size={20}
                              color={colors.muted}
                            />
                          )}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ) : selectedParentId === null ? (
                /* Level 1: Parent Categories View */
                <View style={styles.listSection}>
                  <Text style={styles.sectionHeader}>Nhóm danh mục chính</Text>
                  {parentCategories.map((parent) => {
                    const children = childrenByParentId.get(parent.id) ?? [];
                    const isDirectlySelected = parent.id === selectedCategoryId;
                    const hasSelectedChild = children.some(
                      (c) => c.id === selectedCategoryId
                    );
                    const iconName = getCategoryIcon(parent.name);

                    return (
                      <Pressable
                        key={parent.id}
                        onPress={() => {
                          if (children.length > 0) {
                            setSelectedParentId(parent.id);
                          } else {
                            handleSelect(parent);
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${parent.name}, ${children.length} danh mục con`}
                        style={({ pressed }) => [
                          styles.categoryItem,
                          (isDirectlySelected || hasSelectedChild) &&
                            styles.categoryItemSelected,
                          pressed && styles.itemPressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.iconBox,
                            (isDirectlySelected || hasSelectedChild) &&
                              styles.iconBoxSelected,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={iconName}
                            size={22}
                            color={
                              isDirectlySelected || hasSelectedChild
                                ? colors.primary
                                : colors.ink
                            }
                          />
                        </View>
                        <View style={styles.itemTextContainer}>
                          <Text
                            style={[
                              styles.itemName,
                              (isDirectlySelected || hasSelectedChild) &&
                                styles.itemNameSelected,
                            ]}
                          >
                            {parent.name}
                          </Text>
                          <Text style={styles.itemSubtext}>
                            {children.length > 0
                              ? `${children.length} danh mục con`
                              : "Danh mục đơn lẻ"}
                          </Text>
                        </View>
                        <View style={styles.itemRight}>
                          {hasSelectedChild && (
                            <View style={styles.activePill}>
                              <Text style={styles.activePillText}>Đã chọn</Text>
                            </View>
                          )}
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={22}
                            color={colors.muted}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                /* Level 2: Subcategories View */
                <View style={styles.listSection}>
                  {/* Back button & Breadcrumb */}
                  <Pressable
                    onPress={handleBackToParents}
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel="Quay lại danh sách nhóm danh mục"
                  >
                    <MaterialCommunityIcons
                      name="arrow-left"
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.backButtonText}>Tất cả nhóm danh mục</Text>
                  </Pressable>

                  <View style={styles.parentTitleBox}>
                    <Text style={styles.parentHeaderLabel}>Nhóm đang chọn:</Text>
                    <Text style={styles.parentHeaderName}>
                      {activeParent?.name}
                    </Text>
                  </View>

                  {/* Option to select parent itself */}
                  {activeParent ? (
                    <Pressable
                      onPress={() => handleSelect(activeParent)}
                      style={({ pressed }) => [
                        styles.categoryItem,
                        styles.parentDirectOption,
                        selectedCategoryId === activeParent.id &&
                          styles.categoryItemSelected,
                        pressed && styles.itemPressed,
                      ]}
                    >
                      <View style={styles.iconBox}>
                        <MaterialCommunityIcons
                          name="folder-outline"
                          size={20}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.itemTextContainer}>
                        <Text style={styles.itemName}>
                          Chọn chung: {activeParent.name}
                        </Text>
                        <Text style={styles.itemSubtext}>
                          Dùng khi chưa xác định rõ loại phụ
                        </Text>
                      </View>
                      {selectedCategoryId === activeParent.id ? (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={22}
                          color={colors.primary}
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="plus-circle-outline"
                          size={22}
                          color={colors.muted}
                        />
                      )}
                    </Pressable>
                  ) : null}

                  <Text style={[styles.sectionHeader, { marginTop: spacing.md }]}>
                    Danh mục chi tiết
                  </Text>

                  {currentChildren.map((child) => {
                    const isSelected = child.id === selectedCategoryId;
                    return (
                      <Pressable
                        key={child.id}
                        onPress={() => handleSelect(child)}
                        accessibilityRole="button"
                        accessibilityLabel={child.name}
                        style={({ pressed }) => [
                          styles.categoryItem,
                          isSelected && styles.categoryItemSelected,
                          pressed && styles.itemPressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.radioDot,
                            isSelected && styles.radioDotSelected,
                          ]}
                        >
                          {isSelected ? (
                            <MaterialCommunityIcons
                              name="check"
                              size={14}
                              color={colors.surface}
                            />
                          ) : null}
                        </View>
                        <View style={styles.itemTextContainer}>
                          <Text
                            style={[
                              styles.itemName,
                              isSelected && styles.itemNameSelected,
                            ]}
                          >
                            {child.name}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  backdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  safeArea: {
    maxHeight: "100%",
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerTitles: {
    flex: 1,
    paddingRight: spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    height: "100%",
  },
  clearBtn: {
    padding: 4,
  },
  contentList: {
    flexGrow: 0,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  listSection: {
    gap: spacing.xs,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginVertical: spacing.xs,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  categoryItemSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  itemPressed: {
    opacity: 0.8,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxSelected: {
    backgroundColor: colors.surface,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  itemNameSelected: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  itemSubtext: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  itemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  activePill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.control,
    backgroundColor: colors.primarySoft,
    gap: 6,
    marginBottom: spacing.xs,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  parentTitleBox: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  parentHeaderLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  parentHeaderName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 2,
  },
  parentDirectOption: {
    borderStyle: "dashed",
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  radioDotSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  emptyStateDesc: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
});