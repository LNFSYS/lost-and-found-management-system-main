import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type TextInputProps } from "react-native";
import { colors, spacing } from "@/constants/theme";
import { Input } from "@/components/ui/input";

export function PasswordInput({ label, error, style, ...props }: TextInputProps & { label: string; error?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Input {...props} label={label} error={error} maxLength={72} secureTextEntry={!visible} style={[style, styles.input]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        accessibilityState={{ selected: visible }}
        hitSlop={8}
        onPress={() => setVisible((current) => !current)}
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>{visible ? "Ẩn" : "Hiện"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { paddingRight: 88 },
  toggle: { position: "absolute", right: spacing.sm, top: 28, minWidth: 72, minHeight: 44, alignItems: "center", justifyContent: "center" },
  toggleText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
});
