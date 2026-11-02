import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.container}>
      <View style={styles.copy}><Text style={styles.title}>Không thể hoàn tất</Text><Text style={styles.message}>{message}</Text></View>
      {onRetry ? <Pressable accessibilityRole="button" hitSlop={8} onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Thử lại</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.control, borderWidth: 1, borderColor: "#F0C7C2", backgroundColor: colors.dangerSoft },
  copy: { flex: 1, gap: spacing.xs },
  title: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  message: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  retry: { minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.sm },
  retryText: { color: colors.danger, fontSize: 13, fontWeight: "700" },
});
