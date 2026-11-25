import { ScrollView, StyleSheet, Text, Pressable, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";

const links = [
  { key: "dashboard", title: "Tổng quan", href: "/admin" },
  { key: "users", title: "Người dùng", href: "/admin/users" },
  { key: "reports", title: "Kiểm duyệt", href: "/admin/moderation" },
  { key: "catalog", title: "Danh mục & địa điểm", href: "/admin/catalog" },
  { key: "configs", title: "Cấu hình", href: "/admin/configs" },
] as const;

export function AdminNavigation({ active }: { active: typeof links[number]["key"] }) {
  const { logout } = useAuth();
  return <View style={styles.navigationRow}>
    <ScrollView style={styles.linkScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {links.map((link) => <Pressable key={link.key} accessibilityRole="tab" accessibilityState={{ selected: active === link.key }} onPress={() => router.push(link.href as never)} style={[styles.link, active === link.key && styles.selected]}>
        <Text style={[styles.label, active === link.key && styles.selectedLabel]}>{link.title}</Text>
      </Pressable>)}
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={() => void logout()} style={styles.logoutButton}>
      <MaterialCommunityIcons name="logout" size={17} color={colors.danger} />
      <Text style={styles.logoutLabel}>Thoát</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({ navigationRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg }, linkScroll: { flex: 1 }, container: { gap: spacing.xs, paddingRight: spacing.sm, paddingVertical: spacing.sm }, link: { minHeight: 38, justifyContent: "center", paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, backgroundColor: colors.surface }, selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, label: { color: colors.muted, fontSize: 12, fontWeight: "700" }, selectedLabel: { color: colors.primaryDark }, logoutButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.dangerSoft, borderRadius: radii.pill, backgroundColor: colors.surface }, logoutLabel: { color: colors.danger, fontSize: 12, fontWeight: "800" }, });
