import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import { colors, radii, spacing } from "@/constants/theme";
import { SecureImage } from "@/components/secure-image";
import {
  getApiErrorMessage,
  postService,
  type ImageAnalysisResult,
  type MobileImageFile,
} from "@/services/api";

export const MAX_IMAGE_COUNT = 5;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit matching server policy

export interface ApplyAiDraftPayload {
  title: string;
  description: string;
  suggestedCategoryId?: string | null;
  visualAttributes: string[];
  visibleText: string[];
  confidence: number;
}

export interface PostFormMediaPickerProps {
  images: MobileImageFile[];
  onChangeImages: (images: MobileImageFile[]) => void;
  postType?: "LOST" | "FOUND";
  maxImages?: number;
  disabled?: boolean;
  onApplyAiDraft?: (draft: ApplyAiDraftPayload) => void;
  onAnalysisSuccess?: (result: ImageAnalysisResult) => void;
  initialAiResult?: ImageAnalysisResult | null;
}

const AI_ANALYSIS_STEPS = [
  "Đang tải và chuẩn bị hình ảnh...",
  "AI đang phân tích nhận dạng vật phẩm, màu sắc, văn bản...",
  "Đang trích xuất đặc điểm nhận dạng và chữ trên ảnh...",
  "Đang tổng hợp thông tin và hoàn tất gợi ý bài đăng...",
];

export function PostFormMediaPicker({
  images,
  onChangeImages,
  postType = "FOUND",
  maxImages = MAX_IMAGE_COUNT,
  disabled = false,
  onApplyAiDraft,
  onAnalysisSuccess,
  initialAiResult = null,
}: PostFormMediaPickerProps) {
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0);
  const [aiResult, setAiResult] = useState<ImageAnalysisResult | null>(initialAiResult);
  const [prevInitialAiResult, setPrevInitialAiResult] = useState(initialAiResult);
  const [aiError, setAiError] = useState<string | null>(null);
  const [draftApplied, setDraftApplied] = useState(false);

  if (initialAiResult !== prevInitialAiResult) {
    setPrevInitialAiResult(initialAiResult);
    setAiResult(initialAiResult);
  }

  useEffect(() => {
    if (!isAnalyzing) return;
    const timer = setInterval(() => {
      setAnalysisStepIndex((prev) => (prev + 1) % AI_ANALYSIS_STEPS.length);
    }, 2200);
    return () => clearInterval(timer);
  }, [isAnalyzing]);

  const remainingSlots = Math.max(0, maxImages - images.length);

  const handleOpenSourceChooser = useCallback(() => {
    if (disabled || isAnalyzing) return;
    if (remainingSlots <= 0) {
      Alert.alert(
        "Đã đạt giới hạn ảnh",
        `Bạn chỉ có thể thêm tối đa ${maxImages} hình ảnh cho bài đăng.`
      );
      return;
    }
    setSourceModalVisible(true);
  }, [disabled, isAnalyzing, remainingSlots, maxImages]);

  const handleTakePhoto = useCallback(async () => {
    setSourceModalVisible(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert(
          "Cần quyền Camera",
          "Ứng dụng cần quyền sử dụng máy ảnh để chụp hình vật phẩm. Vui lòng cấp quyền trong phần cài đặt thiết bị để tiếp tục.",
          [{ text: "Đóng", style: "cancel" }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_BYTES) {
          Alert.alert(
            "Ảnh vượt quá kích thước cho phép",
            `Ảnh vừa chụp có dung lượng ${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB, vượt quá giới hạn tối đa 10 MB. Vui lòng chụp lại với độ phân giải thấp hơn.`
          );
          return;
        }
        const newFile: MobileImageFile = {
          uri: asset.uri,
          name: asset.fileName || `camera_${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
          size: asset.fileSize,
        };
        onChangeImages([...images, newFile]);
      }
    } catch (error) {
      Alert.alert("Lỗi chụp ảnh", getApiErrorMessage(error));
    }
  }, [images, onChangeImages]);

  const handlePickFromLibrary = useCallback(async () => {
    setSourceModalVisible(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert(
          "Cần quyền Thư viện ảnh",
          "Ứng dụng cần quyền truy cập thư viện ảnh để chọn ảnh vật phẩm. Vui lòng cấp quyền trong phần cài đặt thiết bị để tiếp tục.",
          [{ text: "Đóng", style: "cancel" }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const oversizedCount = result.assets.filter(
          (a) => a.fileSize && a.fileSize > MAX_FILE_SIZE_BYTES
        ).length;
        const eligibleAssets = result.assets.filter(
          (a) => !a.fileSize || a.fileSize <= MAX_FILE_SIZE_BYTES
        );
        const acceptedAssets = eligibleAssets.slice(0, remainingSlots);
        const imageLimitExcludedCount = eligibleAssets.length - acceptedAssets.length;
        const excludedCount = oversizedCount + imageLimitExcludedCount;

        if (acceptedAssets.length === 0) {
          Alert.alert("Không có ảnh phù hợp", "Các ảnh đã chọn vượt quá giới hạn 10 MB.");
          return;
        }

        const appendAssets = () => {
          const newFiles: MobileImageFile[] = acceptedAssets.map((asset) => ({
            uri: asset.uri,
            name:
              asset.fileName ||
              `library_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`,
            type: asset.mimeType || "image/jpeg",
            size: asset.fileSize,
          }));
          onChangeImages([...images, ...newFiles]);
        };

        if (excludedCount > 0) {
          const details = [
            `Bạn đã chọn ${result.assets.length} ảnh. Có thể thêm ${acceptedAssets.length} ảnh vào bài viết.`,
            imageLimitExcludedCount > 0
              ? `${imageLimitExcludedCount} ảnh vượt quá giới hạn tối đa ${maxImages} ảnh đã bị loại.`
              : "",
            oversizedCount > 0 ? `${oversizedCount} ảnh vượt quá dung lượng 10 MB đã bị loại.` : "",
          ].filter(Boolean).join("\n");
          Alert.alert("Một số ảnh không được thêm", details, [
            { text: "Hủy", style: "cancel" },
            { text: "Thêm ảnh hợp lệ", onPress: appendAssets },
          ]);
          return;
        }

        appendAssets();
      }
    } catch (error) {
      Alert.alert("Lỗi chọn ảnh", getApiErrorMessage(error));
    }
  }, [images, onChangeImages, remainingSlots, maxImages]);

  const handleDeleteImage = useCallback(
    (indexToRemove: number) => {
      if (disabled || isAnalyzing) return;
      const updated = images.filter((_, idx) => idx !== indexToRemove);
      onChangeImages(updated);
    },
    [disabled, isAnalyzing, images, onChangeImages]
  );

  const handleAnalyzeImages = useCallback(async () => {
    if (disabled || isAnalyzing) return;
    if (images.length === 0) {
      Alert.alert(
        "Chưa có ảnh để phân tích",
        "Vui lòng chụp hoặc tải lên ít nhất 1 hình ảnh trước khi dùng tính năng phân tích AI."
      );
      return;
    }

    setAiError(null);
    setAnalysisStepIndex(0);
    setIsAnalyzing(true);
    setDraftApplied(false);

    try {
      const result = await postService.analyzePostImage(postType, images);
      setAiResult(result);
      onAnalysisSuccess?.(result);
    } catch (error) {
      const msg = getApiErrorMessage(error);
      setAiError(msg);
      Alert.alert("Phân tích ảnh thất bại", msg);
    } finally {
      setIsAnalyzing(false);
    }
  }, [disabled, isAnalyzing, images, postType, onAnalysisSuccess]);

  const handleApplyAiDraft = useCallback(() => {
    if (!aiResult) return;
    onApplyAiDraft?.({
      title: aiResult.title,
      description: aiResult.description,
      suggestedCategoryId: aiResult.suggestedCategory?.id ?? null,
      visualAttributes: aiResult.visualAttributes || [],
      visibleText: aiResult.visibleText || [],
      confidence: aiResult.confidence ?? 0.85,
    });
    setDraftApplied(true);
  }, [aiResult, onApplyAiDraft]);

  const handleClearAiResult = useCallback(() => {
    setAiResult(null);
    setAiError(null);
    setDraftApplied(false);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.sectionTitle}>Hình ảnh vật phẩm</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {images.length}/{maxImages}
            </Text>
          </View>
        </View>
        <Text style={styles.headerHint}>
          {images.length === 0
            ? "Tối đa 5 ảnh"
            : "Ảnh đầu tiên là ảnh chính"}
        </Text>
      </View>

      {/* Preview Grid */}
      <View style={styles.gridContainer}>
        {images.map((item, index) => {
          const isPrimary = index === 0;
          const isRemote = Boolean(
            item.id ||
            item.uri.startsWith("/") ||
            item.uri.startsWith("http://") ||
            item.uri.startsWith("https://")
          );
          return (
            <View key={`${item.uri}-${index}`} style={styles.imageTile}>
              {isRemote ? (
                <SecureImage
                  url={item.uri}
                  style={styles.thumbnail}
                  resizeMode="cover"
                  accessibilityLabel={`Ảnh ${index + 1}`}
                />
              ) : (
                <Image
                  source={{ uri: item.uri }}
                  style={styles.thumbnail}
                  contentFit="cover"
                  transition={200}
                  accessibilityLabel={`Ảnh ${index + 1}`}
                />
              )}

              {/* Main image badge on index 0 */}
              {isPrimary && (
                <View style={styles.primaryBadge}>
                  <MaterialCommunityIcons name="star" size={11} color="#FFFFFF" />
                  <Text style={styles.primaryBadgeText}>Ảnh chính</Text>
                </View>
              )}

              {/* Delete button */}
              {!disabled && !isAnalyzing && (
                <Pressable
                  accessibilityLabel={`Xóa ảnh ${index + 1}`}
                  accessibilityRole="button"
                  onPress={() => handleDeleteImage(index)}
                  style={styles.deleteButton}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              )}
            </View>
          );
        })}

        {/* Add photo tile if not full */}
        {remainingSlots > 0 && !disabled && !isAnalyzing && (
          <Pressable
            accessibilityLabel="Thêm ảnh"
            accessibilityRole="button"
            onPress={handleOpenSourceChooser}
            style={({ pressed }) => [
              styles.addTile,
              pressed && styles.addTilePressed,
            ]}
          >
            <View style={styles.addIconCircle}>
              <MaterialCommunityIcons name="plus" size={24} color={colors.primary} />
            </View>
            <Text style={styles.addTileText}>Thêm ảnh</Text>
            <Text style={styles.addTileSub}>
              còn {remainingSlots} chỗ
            </Text>
          </Pressable>
        )}
      </View>

      {/* Helper text under grid */}
      <Text style={styles.instructionNote}>
        Mẹo: Chọn góc chụp sáng rõ, bao quát toàn bộ đồ vật và các chi tiết đặc biệt (logo, tem, số hiệu, vết xước) để AI nhận dạng chính xác nhất.
      </Text>

      {/* Gemini AI Action Card */}
      <View style={styles.aiActionSection}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Phân tích ảnh với AI Gemini"
          disabled={images.length === 0 || isAnalyzing || disabled}
          onPress={handleAnalyzeImages}
          style={({ pressed }) => [
            styles.aiTriggerButton,
            images.length === 0 && styles.aiTriggerButtonDisabled,
            isAnalyzing && styles.aiTriggerButtonAnalyzing,
            pressed && styles.aiTriggerButtonPressed,
          ]}
        >
          <View style={styles.aiButtonLeft}>
            <View style={styles.aiIconBadge}>
              <MaterialCommunityIcons
                name="creation"
                size={22}
                color={images.length === 0 ? colors.muted : "#FFFFFF"}
              />
            </View>
            <View style={styles.aiButtonTextCol}>
              <Text
                style={[
                  styles.aiButtonTitle,
                  images.length === 0 && styles.aiButtonTitleDisabled,
                ]}
              >
                Phân tích ảnh với AI (Gemini)
              </Text>
              <Text
                style={[
                  styles.aiButtonSubtitle,
                  images.length === 0 && styles.aiButtonSubtitleDisabled,
                ]}
              >
                Tự động tạo tiêu đề, mô tả & nhận diện đồ vật
              </Text>
            </View>
          </View>

          {isAnalyzing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={images.length === 0 ? colors.muted : "#FFFFFF"}
            />
          )}
        </Pressable>
      </View>

      {/* Analyzing Progress Card */}
      {isAnalyzing && (
        <View style={styles.analyzingCard}>
          <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
          <View style={styles.analyzingTextWrap}>
            <Text style={styles.analyzingTitle}>Trợ lý AI đang làm việc</Text>
            <Text style={styles.analyzingSubtitle}>
              {AI_ANALYSIS_STEPS[analysisStepIndex]}
            </Text>
          </View>
        </View>
      )}

      {/* AI Error Banner */}
      {aiError && !isAnalyzing && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} />
          <Text style={styles.errorBannerText}>{aiError}</Text>
          <Pressable onPress={() => setAiError(null)} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={16} color={colors.danger} />
          </Pressable>
        </View>
      )}

      {/* AI Results Display */}
      {aiResult && !isAnalyzing && (
        <View style={styles.aiResultCard}>
          {/* Header of AI Card */}
          <View style={styles.aiResultHeader}>
            <View style={styles.aiResultHeaderLeft}>
              <View style={styles.sparkleIconWrap}>
                <MaterialCommunityIcons name="creation" size={18} color="#7C3AED" />
              </View>
              <View>
                <Text style={styles.aiResultHeaderTitle}>Gợi ý từ Gemini AI</Text>
                <Text style={styles.aiModelTag}>
                  Mô hình: {aiResult.model || "Gemini 2.5 Flash"}
                </Text>
              </View>
            </View>

            {typeof aiResult.confidence === "number" && (
              <View style={styles.confidenceBadge}>
                <MaterialCommunityIcons name="check-decagram" size={13} color={colors.success} />
                <Text style={styles.confidenceText}>
                  {Math.round(aiResult.confidence * 100)}% tin cậy
                </Text>
              </View>
            )}
          </View>

          {/* Suggested Category */}
          {aiResult.suggestedCategory?.name && (
            <View style={styles.resultFieldRow}>
              <Text style={styles.fieldLabel}>Danh mục gợi ý:</Text>
              <View style={styles.categoryBadge}>
                <MaterialCommunityIcons name="folder-outline" size={14} color={colors.primary} />
                <Text style={styles.categoryBadgeText}>
                  {aiResult.suggestedCategory.name}
                </Text>
              </View>
            </View>
          )}

          {/* Suggested Title */}
          <View style={styles.resultFieldBlock}>
            <Text style={styles.fieldLabel}>Tiêu đề đề xuất:</Text>
            <View style={styles.titleBox}>
              <Text style={styles.titleBoxText} numberOfLines={2}>
                {aiResult.title}
              </Text>
            </View>
          </View>

          {/* Suggested Description */}
          <View style={styles.resultFieldBlock}>
            <Text style={styles.fieldLabel}>Mô tả chi tiết:</Text>
            <View style={styles.descBox}>
              <Text style={styles.descBoxText}>{aiResult.description}</Text>
            </View>
          </View>

          {/* Visual Attributes Chips */}
          {aiResult.visualAttributes && aiResult.visualAttributes.length > 0 && (
            <View style={styles.resultFieldBlock}>
              <Text style={styles.fieldLabel}>Đặc điểm trực quan (Visual attributes):</Text>
              <View style={styles.chipsWrap}>
                {aiResult.visualAttributes.map((attr, idx) => (
                  <View key={`attr-${idx}`} style={styles.attributeChip}>
                    <Text style={styles.attributeChipText}>#{attr}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Extracted Visible Text (OCR) */}
          {aiResult.visibleText && aiResult.visibleText.length > 0 && (
            <View style={styles.resultFieldBlock}>
              <View style={styles.ocrLabelRow}>
                <MaterialCommunityIcons name="text-recognition" size={15} color={colors.ink} />
                <Text style={styles.fieldLabel}>Văn bản / Số hiệu phát hiện (OCR):</Text>
              </View>
              <View style={styles.chipsWrap}>
                {aiResult.visibleText.map((txt, idx) => (
                  <View key={`ocr-${idx}`} style={styles.ocrChip}>
                    <Text style={styles.ocrChipText}>&quot;{txt}&quot;</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Warnings from AI */}
          {aiResult.warnings && aiResult.warnings.length > 0 && (
            <View style={styles.warningBox}>
              <MaterialCommunityIcons name="alert-outline" size={16} color={colors.warning} />
              <View style={styles.warningContent}>
                {aiResult.warnings.map((warn, idx) => (
                  <Text key={`warn-${idx}`} style={styles.warningText}>
                    • {warn}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* Applied Status Banner */}
          {draftApplied && (
            <View style={styles.appliedSuccessBanner}>
              <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
              <Text style={styles.appliedSuccessText}>
                Đã áp dụng các thông tin gợi ý vào biểu mẫu!
              </Text>
            </View>
          )}

          {/* Action Buttons for AI Card */}
          <View style={styles.aiActionRow}>
            {onApplyAiDraft && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Áp dụng bản nháp AI"
                onPress={handleApplyAiDraft}
                style={({ pressed }) => [
                  styles.applyDraftBtn,
                  draftApplied && styles.applyDraftBtnDone,
                  pressed && styles.btnPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name={draftApplied ? "check" : "auto-fix"}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.applyDraftBtnText}>
                  {draftApplied ? "Đã áp dụng vào form" : "Áp dụng bản nháp AI"}
                </Text>
              </Pressable>
            )}

            <View style={styles.secondaryActionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Phân tích lại"
                onPress={handleAnalyzeImages}
                disabled={isAnalyzing}
                style={({ pressed }) => [
                  styles.reAnalyzeBtn,
                  pressed && styles.btnPressed,
                ]}
              >
                <MaterialCommunityIcons name="refresh" size={16} color={colors.primary} />
                <Text style={styles.reAnalyzeBtnText}>Phân tích lại</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xóa kết quả AI"
                onPress={handleClearAiResult}
                style={({ pressed }) => [
                  styles.clearAiBtn,
                  pressed && styles.btnPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={16}
                  color={colors.muted}
                />
                <Text style={styles.clearAiBtnText}>Xóa gợi ý</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Source Selection Bottom Sheet / Modal */}
      <Modal
        visible={sourceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSourceModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSourceModalVisible(false)}
        >
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn nguồn ảnh</Text>
              <Pressable
                onPress={() => setSourceModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Bạn có thể chụp ảnh trực tiếp bằng Camera hoặc chọn ảnh sẵn có trong máy (còn lại {remainingSlots} ảnh).
            </Text>

            <View style={styles.modalOptionsWrap}>
              <Pressable
                style={({ pressed }) => [
                  styles.sourceOption,
                  pressed && styles.sourceOptionPressed,
                ]}
                onPress={handleTakePhoto}
              >
                <View style={[styles.sourceIconBadge, { backgroundColor: colors.primarySoft }]}>
                  <MaterialCommunityIcons name="camera" size={24} color={colors.primary} />
                </View>
                <View style={styles.sourceTextWrap}>
                  <Text style={styles.sourceOptionTitle}>Chụp ảnh trực tiếp</Text>
                  <Text style={styles.sourceOptionDesc}>
                    Mở camera để chụp ngay vật phẩm trước mặt
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.sourceOption,
                  pressed && styles.sourceOptionPressed,
                ]}
                onPress={handlePickFromLibrary}
              >
                <View style={[styles.sourceIconBadge, { backgroundColor: "#F3E8FF" }]}>
                  <MaterialCommunityIcons
                    name="image-multiple-outline"
                    size={24}
                    color="#7C3AED"
                  />
                </View>
                <View style={styles.sourceTextWrap}>
                  <Text style={styles.sourceOptionTitle}>Chọn từ thư viện ảnh</Text>
                  <Text style={styles.sourceOptionDesc}>
                    Chọn một hoặc nhiều ảnh từ album của máy
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
              </Pressable>
            </View>

            <Pressable
              style={styles.modalCancelBtn}
              onPress={() => setSourceModalVisible(false)}
            >
              <Text style={styles.modalCancelBtnText}>Hủy bỏ</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  countBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  headerHint: {
    fontSize: 13,
    color: colors.muted,
  },

  /* Grid Layout */
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  imageTile: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: radii.control,
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  primaryBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(11, 99, 182, 0.92)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  primaryBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  deleteButton: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: "rgba(25, 49, 75, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: radii.control,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xs,
  },
  addTilePressed: {
    opacity: 0.7,
  },
  addIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  addTileText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  addTileSub: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  instructionNote: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },

  /* AI Trigger Button */
  aiActionSection: {
    marginBottom: spacing.md,
  },
  aiTriggerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F70C9",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    shadowColor: "#0B63B6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  aiTriggerButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  aiTriggerButtonAnalyzing: {
    backgroundColor: colors.primaryDark,
  },
  aiTriggerButtonPressed: {
    opacity: 0.88,
  },
  aiButtonLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  aiIconBadge: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  aiButtonTextCol: {
    flex: 1,
  },
  aiButtonTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  aiButtonTitleDisabled: {
    color: colors.muted,
  },
  aiButtonSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
  },
  aiButtonSubtitleDisabled: {
    color: colors.muted,
  },

  /* Analyzing State Card */
  analyzingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#B8D9F8",
    padding: spacing.md,
    borderRadius: radii.control,
    marginBottom: spacing.md,
  },
  spinner: {
    marginLeft: 4,
  },
  analyzingTextWrap: {
    flex: 1,
  },
  analyzingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  analyzingSubtitle: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },

  /* Error Banner */
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: spacing.md,
    borderRadius: radii.control,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },

  /* AI Results Card */
  aiResultCard: {
    backgroundColor: "#FDFCFE",
    borderWidth: 1.5,
    borderColor: "#DDD6FE",
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  aiResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE9FE",
    marginBottom: spacing.md,
  },
  aiResultHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sparkleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  aiResultHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#5B21B6",
  },
  aiModelTag: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.success,
  },

  resultFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  resultFieldBlock: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 4,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  categoryBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  titleBox: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  titleBoxText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 20,
  },
  descBox: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    padding: spacing.md,
    maxHeight: 120,
  },
  descBoxText: {
    fontSize: 13,
    color: colors.ink,
    lineHeight: 19,
  },

  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  attributeChip: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  attributeChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6D28D9",
  },

  ocrLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  ocrChip: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  ocrChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: undefined,
  },

  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    padding: spacing.sm,
    borderRadius: radii.control,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  warningContent: {
    flex: 1,
  },
  warningText: {
    fontSize: 12,
    color: colors.warning,
    lineHeight: 17,
  },

  appliedSuccessBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: spacing.sm,
    borderRadius: radii.control,
    marginVertical: spacing.sm,
  },
  appliedSuccessText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.success,
  },

  /* Action Buttons */
  aiActionRow: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  applyDraftBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "#16A34A",
    minHeight: 46,
    borderRadius: radii.control,
    paddingHorizontal: spacing.lg,
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  applyDraftBtnDone: {
    backgroundColor: colors.success,
  },
  applyDraftBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  reAnalyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
    minHeight: 40,
    borderRadius: radii.control,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  reAnalyzeBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  clearAiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceMuted,
  },
  clearAiBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  btnPressed: {
    opacity: 0.8,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.card + 4,
    borderTopRightRadius: radii.card + 4,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  modalOptionsWrap: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sourceOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sourceOptionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  sourceIconBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.control,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceTextWrap: {
    flex: 1,
  },
  sourceOptionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  sourceOptionDesc: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  modalCancelBtn: {
    minHeight: 46,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
});
