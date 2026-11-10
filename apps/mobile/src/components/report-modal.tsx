import React, { useState } from "react";
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
import { getApiErrorMessage, postService } from "@/services/api";

interface ReportModalProps {
  visible: boolean;
  postId: string;
  postTitle?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface ReportOption {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
}

const REPORT_REASONS: ReportOption[] = [
  {
    key: "SPAM",
    label: "SPAM",
    description: "Tin rác, quảng cáo, đăng bài trùng lặp liên tục",
    icon: "email-alert-outline",
  },
  {
    key: "LỪA ĐẢO / GIAN LẬN",
    label: "LỪA ĐẢO / GIAN LẬN",
    description: "Yêu cầu tiền chuộc, nhận vơ đồ, mạo danh chủ sở hữu",
    icon: "shield-alert-outline",
  },
  {
    key: "THÔNG TIN SAI SỰ THẬT",
    label: "THÔNG TIN SAI SỰ THẬT",
    description: "Địa điểm, thời điểm hoặc hình ảnh giả mạo",
    icon: "alert-octagon-outline",
  },
  {
    key: "NỘI DUNG KHÔNG PHÙ HỢP",
    label: "NỘI DUNG KHÔNG PHÙ HỢP",
    description: "Ngôn từ thô tục, công kích cá nhân, phản cảm",
    icon: "cancel",
  },
  {
    key: "KHÁC",
    label: "KHÁC",
    description: "Các vấn đề khác cần ban quản trị và nhân viên hỗ trợ xem xét",
    icon: "dots-horizontal-circle-outline",
  },
];

export function ReportModal({
  visible,
  postId,
  postTitle,
  onClose,
  onSuccess,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("SPAM");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    setError("");
    setSuccess(false);
    setDetails("");
    setSelectedReason("SPAM");
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError("Vui lòng chọn lý do báo cáo.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await postService.submitReport({
        targetType: "POST",
        targetId: postId,
        reason: selectedReason,
        details: details.trim() || undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 1200);
    } catch (err) {
      setError(getApiErrorMessage(err));
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
                  name="flag-outline"
                  size={20}
                  color={colors.danger}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Báo cáo bài viết</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {postTitle || `Mã bài viết: ${postId}`}
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
            {success ? (
              <View style={styles.successBox}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={48}
                  color={colors.success}
                />
                <Text style={styles.successTitle}>Đã gửi báo cáo thành công</Text>
                <Text style={styles.successDesc}>
                  Cảm ơn bạn đã phản hồi. Đội ngũ kiểm duyệt FPTU sẽ xác minh và xử lý bài viết trong thời gian sớm nhất.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.instruction}>
                  Vui lòng chọn lý do bạn muốn báo cáo bài đăng này:
                </Text>

                {/* Chips Grid */}
                <View style={styles.chipsContainer}>
                  {REPORT_REASONS.map((opt) => {
                    const isSelected = selectedReason === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => setSelectedReason(opt.key)}
                        style={[
                          styles.chip,
                          isSelected && styles.chipSelected,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={opt.icon}
                          size={16}
                          color={isSelected ? colors.danger : colors.ink}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Selected Reason Description */}
                {selectedReason ? (
                  <View style={styles.reasonDescCard}>
                    <Text style={styles.reasonDescText}>
                      {
                        REPORT_REASONS.find((r) => r.key === selectedReason)
                          ?.description
                      }
                    </Text>
                  </View>
                ) : null}

                {/* Additional Details */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    Chi tiết bổ sung (tùy chọn)
                  </Text>
                  <TextInput
                    style={styles.detailsInput}
                    placeholder="Mô tả cụ thể thông tin vi phạm để hỗ trợ kiểm duyệt nhanh hơn..."
                    placeholderTextColor={colors.muted}
                    multiline
                    maxLength={500}
                    numberOfLines={4}
                    textAlignVertical="top"
                    value={details}
                    onChangeText={setDetails}
                  />
                </View>

                {/* Error Banner */}
                {error ? (
                  <View style={styles.errorBanner}>
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={18}
                      color={colors.danger}
                    />
                    <Text style={styles.errorBannerText}>{error}</Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>

          {/* Action Footer */}
          {!success ? (
            <View style={styles.footer}>
              <Pressable
                onPress={handleClose}
                disabled={submitting}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={submitting || !selectedReason}
                style={[
                  styles.submitBtn,
                  (submitting || !selectedReason) && styles.submitBtnDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="flag-variant"
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.submitBtnText}>Gửi báo cáo</Text>
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
    maxHeight: "85%",
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
    backgroundColor: colors.dangerSoft,
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
    gap: spacing.md,
  },
  instruction: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: "600",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
  },
  chipTextSelected: {
    color: colors.danger,
    fontWeight: "700",
  },
  reasonDescCard: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radii.control,
  },
  reasonDescText: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  detailsInput: {
    minHeight: 90,
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
    backgroundColor: colors.danger,
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
