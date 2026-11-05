import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import { colors, radii, spacing } from "@/constants/theme";
import type { MobileImageFile, StaffCustodyStatus, WarehouseItemStatus } from "@/services/api";

type StaffSection = "dashboard" | "custody" | "warehouse" | "logs";

const navigation: { key: StaffSection; title: string; icon: "view-dashboard-outline" | "clipboard-list-outline" | "archive-outline" | "history"; path: string }[] = [
  { key: "dashboard", title: "Dashboard", icon: "view-dashboard-outline", path: "/staff" },
  { key: "custody", title: "Tiếp nhận", icon: "clipboard-list-outline", path: "/staff/custody" },
  { key: "warehouse", title: "Kho vật phẩm", icon: "archive-outline", path: "/staff/warehouse" },
  { key: "logs", title: "Nhật ký", icon: "history", path: "/staff/logs" },
];

export function StaffNavigation({ active }: { active: StaffSection }) {
  return (
    <View style={styles.navigationWrap}>
      <View style={styles.brandRow}>
        <View style={styles.brandIcon}><MaterialCommunityIcons name="warehouse" size={21} color={colors.primary} /></View>
        <View style={styles.brandCopy}><Text style={styles.eyebrow}>FPTU LOST & FOUND</Text><Text style={styles.brandTitle}>Vận hành kho</Text></View>
        <View style={styles.staffTag}><Text style={styles.staffTagText}>STAFF</Text></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navigation}>
        {navigation.map((item) => {
          const selected = item.key === active;
          return <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => router.replace(item.path as never)} style={[styles.navItem, selected && styles.navItemSelected]}>
            <MaterialCommunityIcons name={item.icon} size={17} color={selected ? colors.surface : colors.muted} />
            <Text style={[styles.navText, selected && styles.navTextSelected]}>{item.title}</Text>
          </Pressable>;
        })}
      </ScrollView>
    </View>
  );
}

export function WarehouseStatusPill({ status, compact = false }: { status: WarehouseItemStatus | StaffCustodyStatus; compact?: boolean }) {
  const appearance = statusAppearances[status] ?? { label: status.replaceAll("_", " "), color: colors.neutral, background: colors.neutralSoft };
  return <View style={[styles.statusPill, compact && styles.statusPillCompact, { backgroundColor: appearance.background }]}><Text style={[styles.statusText, { color: appearance.color }]}>{appearance.label}</Text></View>;
}

export function staffDateTime(value: string | null | undefined, withTime = true) {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa ghi nhận";
  return new Intl.DateTimeFormat("vi-VN", withTime
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export async function pickStaffImage(source: "camera" | "library"): Promise<{ file: MobileImageFile; uri: string } | null> {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Cần cấp quyền camera để chụp ảnh tình trạng vật phẩm.");
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error("Cần cấp quyền thư viện ảnh để chọn ảnh vật phẩm.");
  }
  const result = source === "camera"
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.82 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.82 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) throw new Error("Mỗi ảnh cần nhỏ hơn hoặc bằng 5 MB.");
  const extension = asset.mimeType === "image/png" ? "png" : asset.mimeType === "image/webp" ? "webp" : "jpg";
  return {
    uri: asset.uri,
    file: { uri: asset.uri, name: asset.fileName || `warehouse-${Date.now()}.${extension}`, type: asset.mimeType || "image/jpeg", size: asset.fileSize },
  };
}

const statusAppearances: Record<string, { label: string; color: string; background: string }> = {
  PENDING: { label: "Chờ xử lý", color: colors.warning, background: colors.warningSoft },
  ACCEPTED: { label: "Chờ nhập kho", color: colors.primaryDark, background: colors.primarySoft },
  REJECTED: { label: "Đã từ chối", color: colors.danger, background: colors.dangerSoft },
  CANCELLED: { label: "Đã hủy", color: colors.neutral, background: colors.neutralSoft },
  INTAKED: { label: "Đã tiếp nhận", color: colors.success, background: colors.successSoft },
  AWAITING_INTAKE: { label: "Chờ nhập kho", color: colors.primaryDark, background: colors.primarySoft },
  PENDING_APPROVAL: { label: "Chờ phê duyệt", color: colors.warning, background: colors.warningSoft },
  RECEIVED: { label: "Đã tiếp nhận", color: colors.primaryDark, background: colors.primarySoft },
  STORED: { label: "Đang lưu kho", color: colors.success, background: colors.successSoft },
  CLAIMED: { label: "Đang giữ cho người nhận", color: "#9A4B13", background: colors.accentSoft },
  RETURNED: { label: "Đã trả đồ", color: colors.success, background: colors.successSoft },
  EXPIRED: { label: "Quá hạn", color: colors.danger, background: colors.dangerSoft },
  DISPOSED: { label: "Đã xử lý", color: colors.neutral, background: colors.neutralSoft },
  DONATED: { label: "Đã quyên góp", color: colors.neutral, background: colors.neutralSoft },
  TRANSFERRED: { label: "Đã chuyển giao", color: colors.neutral, background: colors.neutralSoft },
};

const styles = StyleSheet.create({
  navigationWrap: { gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.primarySoft },
  brandCopy: { flex: 1, gap: 1 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  brandTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  staffTag: { minHeight: 28, justifyContent: "center", paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: colors.successSoft },
  staffTagText: { color: colors.success, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  navigation: { gap: spacing.xs, paddingRight: spacing.md },
  navItem: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  navItemSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  navText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  navTextSelected: { color: colors.surface },
  statusPill: { alignSelf: "flex-start", minHeight: 26, justifyContent: "center", paddingHorizontal: 10, borderRadius: radii.pill },
  statusPillCompact: { minHeight: 23, paddingHorizontal: 8 },
  statusText: { fontSize: 10, fontWeight: "900" },
});
