import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/constants/theme";

export function LoadingSpinner({ label = "Đang tải…", size = "large" }: { label?: string; size?: "small" | "large" }) {
  return <View accessibilityRole="progressbar" style={styles.container}><ActivityIndicator size={size} color={colors.primary} /><Text style={styles.label}>{label}</Text></View>;
}

const styles = StyleSheet.create({ container: { alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl }, label: { color: colors.muted, fontSize: 14 } });
