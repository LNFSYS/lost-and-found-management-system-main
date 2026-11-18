import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";

interface InputProps extends TextInputProps { label: string; error?: string }

export function Input({ label, error, multiline, onFocus, onBlur, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        multiline={multiline}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        placeholderTextColor={colors.muted}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.multiline, focused && styles.focused, error && styles.invalid, props.style]}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  input: { minHeight: 48, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, color: colors.ink, backgroundColor: colors.surface, fontSize: 16 },
  multiline: { minHeight: 112, paddingTop: spacing.md },
  focused: { borderColor: colors.primary, borderWidth: 2, paddingHorizontal: spacing.md - 1 },
  invalid: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
