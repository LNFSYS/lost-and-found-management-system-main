import { View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";

interface CardProps extends Omit<ViewProps, "style"> { style?: StyleProp<ViewStyle> }

export function Card({ style, ...props }: CardProps) {
  return <View style={[{ padding: spacing.lg, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, style]} {...props} />;
}
