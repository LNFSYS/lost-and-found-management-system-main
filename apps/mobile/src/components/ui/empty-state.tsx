import type { ComponentProps } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/constants/theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function EmptyState({ icon = "clipboard-text-outline", title, description }: { icon?: IconName; title: string; description?: string }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}><MaterialCommunityIcons name={icon} size={30} color={colors.primary} /></View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  iconWrap: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  title: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" },
  description: { maxWidth: 320, color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
