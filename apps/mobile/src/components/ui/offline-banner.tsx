import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/constants/theme";
import { useNetworkStatus } from "@/hooks/use-network-status";

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  if (isOnline) return null;
  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <MaterialCommunityIcons name="cloud-off-outline" size={18} color={colors.warning} />
      <Text style={styles.text}>Đang ngoại tuyến · Một số thao tác cần kết nối mạng.</Text>
    </View>
  );
}

const styles = StyleSheet.create({ banner: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.warningSoft, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E4C578" }, text: { flexShrink: 1, color: "#684100", fontSize: 12, lineHeight: 17, fontWeight: "600", textAlign: "center" } });
