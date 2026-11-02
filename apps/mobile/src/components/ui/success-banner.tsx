import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";

export function SuccessBanner({ message }: { message: string }) {
  return <View accessibilityRole="alert" style={styles.container}><Text style={styles.message}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, borderRadius: radii.control, borderWidth: 1, borderColor: "#B9E4C9", backgroundColor: colors.successSoft },
  message: { color: colors.success, fontSize: 14, lineHeight: 20, fontWeight: "600" },
});
