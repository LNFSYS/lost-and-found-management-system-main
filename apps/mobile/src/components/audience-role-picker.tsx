import { useState } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";

export type AudienceRole = "STUDENT" | "LECTURER";
const options: { value: AudienceRole; label: string; detail: string }[] = [
  { value: "STUDENT", label: "Sinh viên", detail: "Tài khoản sinh viên" },
  { value: "LECTURER", label: "Giảng viên", detail: "Tài khoản giảng viên" },
];

export function AudienceRolePicker({ value, onChange }: { value: AudienceRole; onChange: (value: AudienceRole) => void }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Bạn là</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Vai trò: ${selected.label}`}
        accessibilityHint="Mở danh sách vai trò"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <View style={styles.copy}><Text style={styles.selected}>{selected.label}</Text><Text style={styles.detail}>{selected.detail}</Text></View>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.primary} />
      </Pressable>
      {open ? (
        <View style={styles.menu}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === option.value }}
              onPress={() => { onChange(option.value); setOpen(false); }}
              style={[styles.option, value === option.value && styles.selectedOption]}
            >
              <View style={styles.copy}><Text style={styles.selected}>{option.label}</Text><Text style={styles.detail}>{option.detail}</Text></View>
              {value === option.value ? <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  trigger: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, backgroundColor: colors.surface },
  pressed: { opacity: 0.82 },
  menu: { overflow: "hidden", borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, backgroundColor: colors.surface },
  option: { minHeight: 58, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  selectedOption: { backgroundColor: colors.primarySoft },
  copy: { gap: 2 },
  selected: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  detail: { color: colors.muted, fontSize: 12 },
});
