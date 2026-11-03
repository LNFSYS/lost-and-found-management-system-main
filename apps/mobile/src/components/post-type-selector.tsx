import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, radii, spacing } from "@/constants/theme";

export type PostType = "LOST" | "FOUND";

export interface PostTypeSelectorProps {
  selectedType: PostType;
  onSelectType: (type: PostType) => void;
  disabled?: boolean;
}

interface TypeOption {
  type: PostType;
  title: string;
  description: string;
  tag: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
  iconBg: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    type: "LOST",
    title: "Tôi làm mất đồ",
    description: "Đăng tin để cộng đồng và bảo vệ hỗ trợ tìm kiếm",
    tag: "BÁO MẤT",
    iconName: "map-marker-question-outline",
    activeColor: "#DC2626",
    activeBg: "#FEF2F2",
    activeBorder: "#DC2626",
    iconBg: "#FEE2E2",
  },
  {
    type: "FOUND",
    title: "Tôi nhặt được đồ",
    description: "Hỗ trợ trao trả đồ thất lạc cho chủ nhân",
    tag: "NHẶT ĐƯỢC",
    iconName: "hand-heart-outline",
    activeColor: "#16A34A",
    activeBg: "#DCFCE7",
    activeBorder: "#16A34A",
    iconBg: "#D1FAE5",
  },
];

export function PostTypeSelector({
  selectedType,
  onSelectType,
  disabled = false,
}: PostTypeSelectorProps) {
  return (
    <View
      style={styles.container}
      accessibilityRole="radiogroup"
      accessibilityLabel="Chọn loại bài đăng"
    >
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Loại bài đăng</Text>
        <Text style={styles.requiredMark}>*</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        Chọn đúng loại bài giúp hệ thống AI ghép đôi và thông báo hiệu quả hơn
      </Text>

      <View style={styles.cardsWrapper}>
        {TYPE_OPTIONS.map((option) => {
          const isSelected = selectedType === option.type;
          return (
            <Pressable
              key={option.type}
              disabled={disabled}
              onPress={() => onSelectType(option.type)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={`${option.title}: ${option.description}`}
              style={({ pressed }) => [
                styles.card,
                isSelected
                  ? {
                      backgroundColor: option.activeBg,
                      borderColor: option.activeBorder,
                      borderWidth: 2,
                    }
                  : {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                disabled && styles.cardDisabled,
                pressed && !disabled && styles.cardPressed,
              ]}
            >
              <View style={styles.topRow}>
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: isSelected
                        ? option.iconBg
                        : colors.surfaceMuted,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={option.iconName}
                    size={26}
                    color={isSelected ? option.activeColor : colors.muted}
                  />
                </View>

                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.tagBadge,
                      {
                        backgroundColor: isSelected
                          ? option.iconBg
                          : colors.surfaceMuted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        {
                          color: isSelected ? option.activeColor : colors.muted,
                        },
                      ]}
                    >
                      {option.tag}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && {
                        borderColor: option.activeColor,
                        backgroundColor: option.activeColor,
                      },
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
              </View>

              <View style={styles.cardContent}>
                <Text
                  style={[
                    styles.cardTitle,
                    isSelected && { color: option.activeColor },
                  ]}
                >
                  {option.title}
                </Text>
                <Text style={styles.cardDescription}>{option.description}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  requiredMark: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.danger,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  cardsWrapper: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radii.control,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  cardContent: {
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
});