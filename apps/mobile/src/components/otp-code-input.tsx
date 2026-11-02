import { useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";

export function OtpCodeInput({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Mã xác thực (6 chữ số)</Text>
      <Pressable accessibilityRole="none" onPress={() => inputRef.current?.focus()} style={styles.cells}>
        {Array.from({ length: 6 }, (_, index) => (
          <View key={index} style={[styles.cell, focused && index === Math.min(value.length, 5) && styles.activeCell, error && styles.invalidCell]}>
            <Text style={styles.digit}>{value[index] ?? ""}</Text>
          </View>
        ))}
        <TextInput
          ref={inputRef}
          accessibilityLabel="Mã xác thực gồm sáu chữ số"
          accessibilityHint="Nhập hoặc dán mã đã nhận qua email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          maxLength={6}
          onBlur={() => setFocused(false)}
          onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, 6))}
          onFocus={() => setFocused(true)}
          selectionColor="transparent"
          textContentType="oneTimeCode"
          style={styles.hiddenInput}
          value={value}
        />
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  cells: { flexDirection: "row", gap: spacing.sm, position: "relative" },
  cell: { flex: 1, minWidth: 0, height: 54, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, backgroundColor: colors.surface },
  activeCell: { borderColor: colors.primary, borderWidth: 2 },
  invalidCell: { borderColor: colors.danger },
  digit: { color: colors.ink, fontSize: 21, fontWeight: "700", fontVariant: ["tabular-nums"] },
  hiddenInput: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.02, color: "transparent", fontSize: 20 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
