import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const variantStyle = {
  primary: { backgroundColor: colors.primary, borderColor: colors.primary, textColor: colors.surface },
  secondary: { backgroundColor: colors.surface, borderColor: colors.border, textColor: colors.ink },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger, textColor: colors.surface },
  ghost: { backgroundColor: "transparent", borderColor: "transparent", textColor: colors.primary },
} as const;

export function Button({ title, variant = "primary", loading = false, disabled, style, ...props }: ButtonProps) {
  const appearance = variantStyle[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [styles.button, { backgroundColor: appearance.backgroundColor, borderColor: appearance.borderColor, opacity: isDisabled ? 0.58 : pressed ? 0.82 : 1 }, style]}
      {...props}
    >
      {loading ? <ActivityIndicator color={appearance.textColor} /> : <Text style={[styles.label, { color: appearance.textColor }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: spacing.lg, borderWidth: 1, borderRadius: radii.control, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 15, fontWeight: "700" },
});
