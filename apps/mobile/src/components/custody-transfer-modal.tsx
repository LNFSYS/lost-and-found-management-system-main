import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, radii, spacing } from "@/constants/theme";
import {
  getApiErrorMessage,
  postService,
  type HandoverPoint,
} from "@/services/api";

interface CustodyTransferModalProps {
  visible: boolean;
  postId: string;
  postTitle?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface IntakePreset {
  label: string;
  date: Date;
}

function getIntakePresets(): IntakePreset[] {
  const now = new Date();

  const createDate = (daysAhead: number, hours: number, minutes: number) => {
    const d = new Date();
    d.setDate(now.getDate() + daysAhead);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const presets: IntakePreset[] = [];

  if (now.getHours() < 11) {
    presets.push({
      label: "Hôm nay · Sáng (10:00)",
      date: createDate(0, 10, 0),
    });
  }
  if (now.getHours() < 16) {
    presets.push({
      label: "Hôm nay · Chiều (15:00)",
      date: createDate(0, 15, 0),
    });
  }

  presets.push({
    label: "Ngày mai · Sáng (09:30)",
    date: createDate(1, 9, 30),
  });
  presets.push({
    label: "Ngày mai · Chiều (14:30)",
    date: createDate(1, 14, 30),
  });
  presets.push({
    label: "Ngày kia · Sáng (09:30)",
    date: createDate(2, 9, 30),
  });

  return presets;
}

function formatPresetDisplay(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${hours}:${minutes} - ${day}/${month}/${year}`;
}

export function CustodyTransferModal({
  visible,
  postId,
  postTitle,
  onClose,
  onSuccess,
}: CustodyTransferModalProps) {
  const [handoverPoints, setHandoverPoints] = useState<HandoverPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [pointsError, setPointsError] = useState("");

  const [selectedPointId, setSelectedPointId] = useState<string>("");
  const [selectedIntakeDate, setSelectedIntakeDate] = useState<Date>(() => {
    const presets = getIntakePresets();
    return presets[0]?.date ?? new Date(Date.now() + 2 * 3600 * 1000);
  });
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let active = true;

    postService
      .listPublicHandoverPoints()
      .then((res) => {
        if (!active) return;
        const points = res.handoverPoints || [];
        setHandoverPoints(points);
        if (points.length > 0) {
          setSelectedPointId((prev) => prev || points[0].id);
        }
      })
      .catch((err) => {
        if (!active) return;
        setPointsError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoadingPoints(false);
      });

    return () => {
      active = false;
    };
  }, [visible]);

  const handleClose = () => {
    setSubmitError("");
    setSubmitSuccess(false);
    onClose();
  };

  const presets = getIntakePresets();

  const handleSubmit = async () => {
    if (!selectedPointId) {
      setSubmitError("Vui lòng chọn quầy tiếp nhận bàn giao.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      await postService.createCustodyRequest({
        postId,
        handoverPointId: selectedPointId,
        requestedIntakeAt: selectedIntakeDate.toISOString(),
        reason: notes.trim() || undefined,
        intakeType: "CUSTODY_TRANSFER",
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        onSuccess();
      }, 1200);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={handleClose} />
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.iconBadge}>
                <MaterialCommunityIcons
                  name="archive-arrow-down-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Bàn giao vào kho Staff</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {postTitle || "Gửi vật phẩm nhặt được đến quầy tiếp nhận"}
                </Text>
              </View>
            </View>
            <Pressable
              hitSlop={12}
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityLabel="Đóng modal"
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {submitSuccess ? (
              <View style={styles.successBox}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={48}
                  color={colors.success}
                />
                <Text style={styles.successTitle}>Đã gửi yêu cầu bàn giao!</Text>
                <Text style={styles.successDesc}>
                  Staff đã nhận được thông báo. Bạn vui lòng mang đồ đến quầy theo lịch hẹn đã đăng ký.
                </Text>
              </View>
            ) : (
              <>
                {/* Information Callout */}
                <View style={styles.infoCallout}>
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.infoText}>
                    Khi bàn giao vào quầy Staff, vật phẩm sẽ được gắn mã kiểm kê và bảo quản tập trung tại kho an toàn.
                  </Text>
                </View>

                {/* Handover Points Selector */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    1. Chọn quầy tiếp nhận bàn giao <Text style={styles.req}>*</Text>
                  </Text>
                  {loadingPoints ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.loadingText}>Đang tải danh sách quầy...</Text>
                    </View>
                  ) : pointsError ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{pointsError}</Text>
                    </View>
                  ) : (
                    <View style={styles.pointsList}>
                      {handoverPoints.map((point) => {
                        const isSelected = selectedPointId === point.id;
                        return (
                          <Pressable
                            key={point.id}
                            onPress={() => setSelectedPointId(point.id)}
                            style={[
                              styles.pointCard,
                              isSelected && styles.pointCardSelected,
                            ]}
                          >
                            <View style={styles.radioIndicator}>
                              <MaterialCommunityIcons
                                name={
                                  isSelected
                                    ? "radiobox-marked"
                                    : "radiobox-blank"
                                }
                                size={20}
                                color={
                                  isSelected ? colors.primary : colors.muted
                                }
                              />
                            </View>
                            <View style={styles.pointInfo}>
                              <Text
                                style={[
                                  styles.pointName,
                                  isSelected && styles.pointNameSelected,
                                ]}
                              >
                                {point.name}
                              </Text>
                              {point.address ? (
                                <View style={styles.pointDetailRow}>
                                  <MaterialCommunityIcons
                                    name="map-marker-outline"
                                    size={14}
                                    color={colors.muted}
                                  />
                                  <Text style={styles.pointDetailText}>
                                    {point.address}
                                  </Text>
                                </View>
                              ) : null}
                              {point.openingHours ? (
                                <View style={styles.pointDetailRow}>
                                  <MaterialCommunityIcons
                                    name="clock-outline"
                                    size={14}
                                    color={colors.muted}
                                  />
                                  <Text style={styles.pointDetailText}>
                                    {point.openingHours}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Intake Time Selector */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    2. Thời gian dự kiến mang đồ đến <Text style={styles.req}>*</Text>
                  </Text>
                  <Text style={styles.sectionHelp}>
                    Lựa chọn khung giờ thuận tiện nhất để mang đồ tới quầy Staff:
                  </Text>
                  <View style={styles.presetChips}>
                    {presets.map((preset, idx) => {
                      const isSelected =
                        Math.abs(
                          selectedIntakeDate.getTime() - preset.date.getTime()
                        ) < 60000;
                      return (
                        <Pressable
                          key={idx}
                          onPress={() => setSelectedIntakeDate(preset.date)}
                          style={[
                            styles.chip,
                            isSelected && styles.chipSelected,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="calendar-clock"
                            size={14}
                            color={isSelected ? colors.primary : colors.ink}
                          />
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextSelected,
                            ]}
                          >
                            {preset.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.selectedTimeBadge}>
                    <Text style={styles.selectedTimeLabel}>Lịch hẹn đã chọn:</Text>
                    <Text style={styles.selectedTimeValue}>
                      {formatPresetDisplay(selectedIntakeDate)}
                    </Text>
                  </View>
                </View>

                {/* Notes Input */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    3. Ghi chú / Lời nhắn cho Staff (không bắt buộc)
                  </Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Mô tả thêm tình trạng đồ vật khi nhặt được, vị trí cụ thể, hoặc lời nhắn hẹn..."
                    placeholderTextColor={colors.muted}
                    multiline
                    maxLength={1000}
                    numberOfLines={3}
                    textAlignVertical="top"
                    value={notes}
                    onChangeText={setNotes}
                  />
                </View>

                {/* Error Banner */}
                {submitError ? (
                  <View style={styles.errorBanner}>
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={18}
                      color={colors.danger}
                    />
                    <Text style={styles.errorBannerText}>{submitError}</Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>

          {/* Action Footer */}
          {!submitSuccess ? (
            <View style={styles.footer}>
              <Pressable
                onPress={handleClose}
                disabled={submitting}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={submitting || loadingPoints || !selectedPointId}
                style={[
                  styles.submitBtn,
                  (submitting || loadingPoints || !selectedPointId) &&
                    styles.submitBtnDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="send-outline"
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.submitBtnText}>Gửi yêu cầu bàn giao</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 24, 40, 0.55)",
    justifyContent: "flex-end",
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.card + 4,
    borderTopRightRadius: radii.card + 4,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: radii.control,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.neutralSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  contentContainer: {
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  infoCallout: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radii.control,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.primaryDark,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  sectionHelp: {
    fontSize: 12,
    color: colors.muted,
  },
  req: {
    color: colors.danger,
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  loadingText: {
    fontSize: 13,
    color: colors.muted,
  },
  errorBox: {
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.control,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  pointsList: {
    gap: spacing.sm,
  },
  pointCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
    borderRadius: radii.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  pointCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  radioIndicator: {
    marginTop: 2,
  },
  pointInfo: {
    flex: 1,
    gap: 3,
  },
  pointName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  pointNameSelected: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  pointDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pointDetailText: {
    fontSize: 12,
    color: colors.muted,
    flex: 1,
  },
  presetChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  selectedTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.control,
    marginTop: 4,
  },
  selectedTimeLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  selectedTimeValue: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: "700",
  },
  notesInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    padding: spacing.md,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.control,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
  successBox: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.success,
  },
  successDesc: {
    fontSize: 14,
    color: colors.ink,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  submitBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.control,
    backgroundColor: colors.primary,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
