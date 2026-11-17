import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "@/constants/theme";

const statusStyle: Record<string, { background: string; foreground: string; label?: string }> = {
  OPEN: { background: colors.successSoft, foreground: colors.success },
  MATCHED: { background: colors.accentSoft, foreground: "#9A4B13" },
  RESOLVED: { background: colors.neutralSoft, foreground: colors.neutral },
  PENDING: { background: colors.warningSoft, foreground: colors.warning },
  IN_PROGRESS: { background: colors.primarySoft, foreground: colors.primaryDark, label: "ĐANG XỬ LÝ" },
  REJECTED: { background: colors.dangerSoft, foreground: colors.danger },
  CANCELLED: { background: colors.neutralSoft, foreground: colors.neutral },
  COMPLETED: { background: colors.successSoft, foreground: colors.success },
  VERIFIED: { background: colors.successSoft, foreground: colors.success },
  CLOSED: { background: colors.neutralSoft, foreground: colors.neutral },
};

export function Badge({ status }: { status: string }) {
  const normalized = status.trim().toUpperCase();
  const appearance = statusStyle[normalized] ?? { background: colors.neutralSoft, foreground: colors.neutral };
  const label = appearance.label ?? normalized.replaceAll("_", " ");
  return <View style={[styles.badge, { backgroundColor: appearance.background }]}><Text style={[styles.text, { color: appearance.foreground }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({ badge: { alignSelf: "flex-start", minHeight: 26, paddingHorizontal: 10, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" }, text: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 } });
