import { useId, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { colors, radii, spacing } from "@/constants/theme";

export type IncidentPickerMode = "date" | "time" | "datetime";

export interface IncidentDateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  mode?: IncidentPickerMode;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  maximumDate?: Date;
  minimumDate?: Date;
  error?: string;
}

/**
 * Format date in friendly Vietnamese format:
 * e.g. "14:30, 03/11/2026 (Hôm nay)"
 */
export function formatVietnameseDateTime(
  date: Date,
  mode: IncidentPickerMode = "datetime"
): string {
  if (!date || isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const pad = (n: number) => n.toString().padStart(2, "0");
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();

  let relativeTag = "";
  if (isToday) relativeTag = " (Hôm nay)";
  else if (isYesterday) relativeTag = " (Hôm qua)";
  else if (isTomorrow) relativeTag = " (Ngày mai)";

  if (mode === "time") {
    return `${hours}:${minutes}${relativeTag}`;
  }

  if (mode === "date") {
    return `${day}/${month}/${year}${relativeTag}`;
  }

  return `${hours}:${minutes}, ${day}/${month}/${year}${relativeTag}`;
}

/**
 * Format date for HTML input element:
 * datetime-local: YYYY-MM-DDTHH:mm
 * date: YYYY-MM-DD
 * time: HH:mm
 */
function formatForWebInput(date: Date, mode: IncidentPickerMode): string {
  if (!date || isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());

  if (mode === "time") return `${hh}:${mm}`;
  if (mode === "date") return `${yyyy}-${MM}-${dd}`;
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

export function IncidentDateTimePicker({
  value,
  onChange,
  mode = "datetime",
  label = "Thời gian xảy ra sự việc",
  helperText = "Thời điểm bạn làm mất hoặc nhặt được vật phẩm",
  disabled = false,
  maximumDate,
  minimumDate,
  error,
}: IncidentDateTimePickerProps) {
  const [iosModalVisible, setIosModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value);
  const webInputId = useId();

  // Handlers for Android native dialog
  const handleOpenAndroid = () => {
    if (mode === "date") {
      DateTimePickerAndroid.open({
        value,
        mode: "date",
        maximumDate,
        minimumDate,
        onChange: (event, selectedDate) => {
          if (event.type === "set" && selectedDate) {
            onChange(selectedDate);
          }
        },
      });
      return;
    }

    if (mode === "time") {
      DateTimePickerAndroid.open({
        value,
        mode: "time",
        is24Hour: true,
        onChange: (event, selectedDate) => {
          if (event.type === "set" && selectedDate) {
            onChange(selectedDate);
          }
        },
      });
      return;
    }

    // Default "datetime": Step 1 = Date, Step 2 = Time
    DateTimePickerAndroid.open({
      value,
      mode: "date",
      maximumDate,
      minimumDate,
      onChange: (dateEvent, selectedDate) => {
        if (dateEvent.type === "set" && selectedDate) {
          // Open time picker immediately after date is chosen
          DateTimePickerAndroid.open({
            value: selectedDate,
            mode: "time",
            is24Hour: true,
            onChange: (timeEvent, finalTime) => {
              if (timeEvent.type === "set" && finalTime) {
                const combined = new Date(selectedDate);
                combined.setHours(
                  finalTime.getHours(),
                  finalTime.getMinutes(),
                  0,
                  0
                );
                onChange(combined);
              } else if (timeEvent.type === "dismissed") {
                onChange(selectedDate);
              }
            },
          });
        }
      },
    });
  };

  const handleOpenPress = () => {
    if (disabled) return;

    if (Platform.OS === "android") {
      handleOpenAndroid();
    } else if (Platform.OS === "ios") {
      setTempDate(value);
      setIosModalVisible(true);
    }
  };

  const handleIosConfirm = () => {
    onChange(tempDate);
    setIosModalVisible(false);
  };

  const handleIosCancel = () => {
    setTempDate(value);
    setIosModalVisible(false);
  };

  const formattedDisplay = formatVietnameseDateTime(value, mode);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.requiredMark}>*</Text>
        </View>
        <View style={styles.modeBadge}>
          <MaterialCommunityIcons
            name={mode === "time" ? "clock-outline" : "calendar-clock"}
            size={13}
            color={colors.primary}
          />
          <Text style={styles.modeBadgeText}>
            {mode === "time" ? "Giờ" : mode === "date" ? "Ngày" : "Ngày & Giờ"}
          </Text>
        </View>
      </View>

      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      {/* Main Trigger Card */}
      <View style={styles.triggerContainer}>
        <Pressable
          disabled={disabled}
          onPress={handleOpenPress}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${formattedDisplay}`}
          style={({ pressed }) => [
            styles.trigger,
            Boolean(error) && styles.triggerError,
            disabled && styles.triggerDisabled,
            pressed && !disabled && styles.triggerPressed,
          ]}
        >
          <View style={styles.leftGroup}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons
                name={mode === "time" ? "clock-outline" : "calendar-outline"}
                size={22}
                color={colors.primary}
              />
            </View>

            <View style={styles.textGroup}>
              <Text style={styles.displayValue}>{formattedDisplay}</Text>
              <Text style={styles.subHint}>Nhấn để thay đổi</Text>
            </View>
          </View>

          <MaterialCommunityIcons
            name="pencil-outline"
            size={18}
            color={colors.muted}
          />
        </Pressable>

        {/* Web Fallback Hidden Native Input */}
        {Platform.OS === "web" && (
          <input
            id={webInputId}
            type={
              mode === "time"
                ? "time"
                : mode === "date"
                ? "date"
                : "datetime-local"
            }
            value={formatForWebInput(value, mode)}
            disabled={disabled}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                const parsed = new Date(val);
                if (!isNaN(parsed.getTime())) {
                  onChange(parsed);
                }
              }
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          />
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* iOS Modal BottomSheet */}
      {Platform.OS === "ios" && (
        <Modal
          visible={iosModalVisible}
          transparent
          animationType="slide"
          onRequestClose={handleIosCancel}
        >
          <View style={iosStyles.backdrop}>
            <Pressable
              style={iosStyles.backdropDismiss}
              onPress={handleIosCancel}
            />
            <View style={iosStyles.sheet}>
              <SafeAreaView edges={["bottom"]}>
                <View style={iosStyles.toolbar}>
                  <Pressable
                    onPress={handleIosCancel}
                    hitSlop={8}
                    style={iosStyles.toolbarBtn}
                  >
                    <Text style={iosStyles.cancelText}>Hủy</Text>
                  </Pressable>

                  <Text style={iosStyles.toolbarTitle}>
                    {mode === "time"
                      ? "Chọn giờ"
                      : mode === "date"
                      ? "Chọn ngày"
                      : "Chọn ngày & giờ"}
                  </Text>

                  <Pressable
                    onPress={handleIosConfirm}
                    hitSlop={8}
                    style={iosStyles.toolbarBtn}
                  >
                    <Text style={iosStyles.confirmText}>Xong</Text>
                  </Pressable>
                </View>

                <View style={iosStyles.pickerContainer}>
                  <DateTimePicker
                    value={tempDate}
                    mode={mode === "datetime" ? "datetime" : mode}
                    display="spinner"
                    is24Hour
                    maximumDate={maximumDate}
                    minimumDate={minimumDate}
                    onChange={(_, selectedDate) => {
                      if (selectedDate) setTempDate(selectedDate);
                    }}
                    textColor={colors.ink}
                  />
                </View>
              </SafeAreaView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  requiredMark: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.danger,
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  helperText: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 16,
    marginBottom: 2,
  },
  triggerContainer: {
    position: "relative",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  triggerError: {
    borderColor: colors.danger,
  },
  triggerDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.6,
  },
  triggerPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  textGroup: {
    flex: 1,
    gap: 1,
  },
  displayValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  subHint: {
    fontSize: 12,
    color: colors.muted,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 2,
  },
});

const iosStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolbarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  toolbarBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelText: {
    fontSize: 15,
    color: colors.muted,
    fontWeight: "500",
  },
  confirmText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: "700",
  },
  pickerContainer: {
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
});