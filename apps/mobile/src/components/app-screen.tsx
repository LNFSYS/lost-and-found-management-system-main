import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/constants/theme";

export function AppScreen({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}>
          <Text style={styles.brand}>FPTU LOST &amp; FOUND</Text>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  heading: { gap: spacing.sm },
  brand: { color: colors.primary, fontSize: 11, letterSpacing: 1.2, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: "800" },
  description: { maxWidth: 520, color: colors.muted, fontSize: 15, lineHeight: 22 },
});
