import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, radii, spacing } from "@/constants/theme";

export type VisibilityMode = "PUBLIC" | "PRIVATE_DETAILS";

export interface VisibilityModeToggleProps {
  mode: VisibilityMode;
  onChangeMode: (mode: VisibilityMode) => void;
  disabled?: boolean;
}

interface VisibilityOption {
  mode: VisibilityMode;
  title: string;
  badge: string;
  description: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  recommendText?: string;
}

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    mode: "PUBLIC",
    title: "Công khai hoàn toàn",
    badge: "Mặc định",
    description: "Công khai toàn bộ chi tiết và hình ảnh cho cộng đồng.",
    iconName: "eye-outline",
    recommendText: "Phù hợp cho đồ vật thông thường, cần tìm kiếm lan tỏa",
  },
  {
    mode: "PRIVATE_DETAILS",
    title: "Ẩn chi tiết nhạy cảm",
    badge: "Bảo mật",
    description:
      "Ẩn một số đặc điểm nhận dạng quan trọng để người mất tự đối chiếu khi xác minh quyền sở hữu.",
    iconName: "shield-check-outline",
    recommendText: "Khuyên dùng cho đồ có giá trị (ví, laptop, điện thoại, CCCD)",
  },
];

export function VisibilityModeToggle({
  mode,
  onChangeMode,
  disabled = false,
}: VisibilityModeToggleProps) {
  return (
    <View
      style={styles.container}
      accessibilityRole="radiogroup"
      accessibilityLabel="Chọn chế độ hiển thị bài đăng"
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons
            name="shield-account-outline"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.title}>Chế độ hiển thị</Text>
        </View>
        <Text style={styles.subtitle}>
          Quyết định mức độ hiển thị đặc điểm nhận dạng để phòng tránh gian lận
        </Text>
      </View>

      <View style={styles.optionsList}>
        {VISIBILITY_OPTIONS.map((opt) => {
          const isSelected = mode === opt.mode;

          return (
            <Pressable
              key={opt.mode}
              disabled={disabled}
              onPress={() => onChangeMode(opt.mode)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={`${opt.title}: ${opt.description}`}
              style={({ pressed }) => [
                styles.optionCard,
                isSelected && styles.optionCardSelected,
                disabled && styles.optionCardDisabled,
                pressed && !disabled && styles.optionCardPressed,
              ]}
            >
              <View style={styles.topRow}>
                <View style={styles.iconAndTitle}>
                  <View
                    style={[
                      styles.iconCircle,
                      isSelected && styles.iconCircleSelected,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={opt.iconName}
                      size={22}
                      color={isSelected ? colors.primary : colors.muted}
                    />
                  </View>

                  <View style={styles.titleGroup}>
                    <View style={styles.titleWithBadge}>
                      <Text
                        style={[
                          styles.optTitle,
                          isSelected && styles.optTitleSelected,
                        ]}
                      >
                        {opt.title}
                      </Text>
                      <View
                        style={[
                          styles.badge,
                          isSelected && styles.badgeSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            isSelected && styles.badgeTextSelected,
                          ]}
                        >
                          {opt.badge}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Radio Circle Indicator */}
                <View
                  style={[
                    styles.radioIndicator,
                    isSelected && styles.radioIndicatorSelected,
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
              </View>

              {/* Description */}
              <Text style={styles.description}>{opt.description}</Text>

              {/* Extra recommendation note */}
              {opt.recommendText ? (
                <View style={styles.recommendRow}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={14}
                    color={isSelected ? colors.primary : colors.muted}
                  />
                  <Text
                    style={[
                      styles.recommendText,
                      isSelected && styles.recommendTextSelected,
                    ]}
                  >
                    {opt.recommendText}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
  },
  optionCardDisabled: {
    opacity: 0.55,
  },
  optionCardPressed: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconAndTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleSelected: {
    backgroundColor: colors.surface,
  },
  titleGroup: {
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  optTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  optTitleSelected: {
    color: colors.primaryDark,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
  },
  badgeSelected: {
    backgroundColor: colors.surface,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
  },
  badgeTextSelected: {
    color: colors.primary,
  },
  radioIndicator: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  radioIndicatorSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  description: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    marginTop: 2,
  },
  recommendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  recommendText: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: "italic",
    flex: 1,
  },
  recommendTextSelected: {
    color: colors.primaryDark,
  },
});