import { ScrollView, StyleSheet, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { colors, radii, spacing } from "@/constants/theme";

const links = [
  { key: "dashboard", title: "Tổng quan", href: "/admin" },
  { key: "users", title: "Người dùng", href: "/admin/users" },
  { key: "reports", title: "Kiểm duyệt", href: "/admin/moderation" },
  { key: "catalog", title: "Danh mục & địa điểm", href: "/admin/catalog" },
  { key: "configs", title: "Cấu hình", href: "/admin/configs" },
] as const;

export function AdminNavigation({ active }: { active: typeof links[number]["key"] }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
    {links.map((link) => <Pressable key={link.key} accessibilityRole="tab" accessibilityState={{ selected: active === link.key }} onPress={() => router.push(link.href as never)} style={[styles.link, active === link.key && styles.selected]}>
      <Text style={[styles.label, active === link.key && styles.selectedLabel]}>{link.title}</Text>
    </Pressable>)}
  </ScrollView>;
}

const styles = StyleSheet.create({ container: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }, link: { minHeight: 38, justifyContent: "center", paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, backgroundColor: colors.surface }, selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, label: { color: colors.muted, fontSize: 12, fontWeight: "700" }, selectedLabel: { color: colors.primaryDark }, });
