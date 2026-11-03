import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, radii, spacing } from "@/constants/theme";

export interface PostSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSearch?: (text: string) => void;
  style?: StyleProp<ViewStyle>;
  debounceMs?: number;
  autoFocus?: boolean;
}

export function PostSearchBar({
  value,
  onChangeText,
  placeholder = "Tìm theo tiêu đề, địa điểm, đồ vật…",
  onSearch,
  style,
  debounceMs = 300,
  autoFocus = false,
}: PostSearchBarProps) {
  const [localText, setLocalText] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);

  // Sync state during render when external prop changes (React recommended pattern)
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalText(value);
  }

  // Debounced notification to parent
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (localText !== value) {
        onChangeText(localText);
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [localText, debounceMs, onChangeText, value]);

  const handleClear = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setLocalText("");
    onChangeText("");
    onSearch?.("");
  };

  const handleSubmit = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onChangeText(localText);
    onSearch?.(localText);
  };

  return (
    <View style={[styles.container, style]}>
      <MaterialCommunityIcons
        name="magnify"
        size={20}
        color={colors.muted}
        style={styles.searchIcon}
      />
      <TextInput
        value={localText}
        onChangeText={setLocalText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        onSubmitEditing={handleSubmit}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      {localText.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xóa tìm kiếm"
          onPress={handleClear}
          hitSlop={8}
          style={styles.clearButton}
        >
          <MaterialCommunityIcons
            name="close-circle"
            size={18}
            color={colors.muted}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 10,
  },
  clearButton: {
    padding: 2,
    marginLeft: spacing.xs,
  },
});
