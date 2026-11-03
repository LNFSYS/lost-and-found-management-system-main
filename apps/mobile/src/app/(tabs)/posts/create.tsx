import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { colors, radii, spacing } from "@/constants/theme";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  PostFormMediaPicker,
  type ApplyAiDraftPayload,
} from "@/components/post-form-media-picker";
import { PostTypeSelector, type PostType } from "@/components/post-type-selector";
import {
  CategoryPickerModal,
  getCategoryIcon,
} from "@/components/category-picker-modal";
import {
  CampusLocationPicker,
  type CampusLocationPickerErrors,
} from "@/components/campus-location-picker";
import { IncidentDateTimePicker } from "@/components/incident-datetime-picker";
import {
  VisibilityModeToggle,
  type VisibilityMode,
} from "@/components/visibility-mode-toggle";
import { useAuth } from "@/context/auth-context";
import {
  getApiErrorMessage,
  postService,
  type CreatePostPayload,
  type ImageAnalysisResult,
  type MobileImageFile,
  type PostCatalog,
  type PostSummary,
  type UpdatePostPayload,
} from "@/services/api";

interface SubmissionProgress {
  message: string;
  current: number;
  total: number;
}

export default function CreateOrEditPostScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { editPostId, demoPreset } = useLocalSearchParams<{ editPostId?: string; demoPreset?: string }>();
  const isEdit = Boolean(editPostId);

  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Loading states
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingPost, setLoadingPost] = useState(isEdit);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Catalog data
  const [catalog, setCatalog] = useState<PostCatalog | null>(null);

  // Form states
  const [postType, setPostType] = useState<PostType>("LOST");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [roomText, setRoomText] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [selectedHandoverPointId, setSelectedHandoverPointId] = useState<string | null>(null);
  const [contactInfoInput, setContactInfo] = useState<string | null>(null);
  const contactInfo =
    contactInfoInput !== null
      ? contactInfoInput
      : (!isEdit && user ? (user.phoneNumber || user.email || "") : "");
  const [incidentDate, setIncidentDate] = useState<Date>(new Date());
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>("PUBLIC");
  const [images, setImages] = useState<MobileImageFile[]>([]);
  const [initialMediaIds, setInitialMediaIds] = useState<string[]>([]);
  const [analysisSignals, setAnalysisSignals] = useState<{
    visualAttributes: string[];
    visibleText: string[];
    confidence: number;
  } | null>(null);

  // Modals & submission state
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<SubmissionProgress | null>(null);
  const [formErrors, setFormErrors] = useState<{
    title?: string;
    categoryId?: string;
    location?: string;
    contactInfo?: string;
  }>({});

  // 1. Load catalog
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      postService
        .getPostCatalog()
        .then((data) => {
          if (active) setCatalog(data);
        })
        .catch((err) => {
          if (active) setGlobalError(getApiErrorMessage(err));
        })
        .finally(() => {
          if (active) setLoadingCatalog(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  // 2. Load existing post in edit mode
  useEffect(() => {
    let active = true;
    if (!editPostId) return;

    const timer = setTimeout(() => {
      postService
        .getPost(editPostId)
        .then((data: PostSummary) => {
          if (!active) return;
          if (!data.canEdit) {
            Alert.alert(
              "Không có quyền",
              "Bạn không có quyền chỉnh sửa bài đăng này.",
              [{ text: "Quay lại", onPress: () => router.back() }]
            );
            return;
          }

          setPostType(data.type);
          setTitle(data.title || "");
          setDescription(data.description || "");
          setSelectedCategoryId(data.category?.id || null);
          setSelectedAreaId(data.location?.area?.id || null);
          setSelectedBuildingId(data.location?.building?.id || null);
          setRoomText(data.location?.roomText || "");
          setCustomLocation(data.location?.customLocation || "");
          setSelectedHandoverPointId(data.handoverPoint?.id || null);
          setContactInfo(data.contactInfo || "");
          setIncidentDate(data.lostFoundAt ? new Date(data.lostFoundAt) : new Date());
          setVisibilityMode(data.visibilityMode || "PUBLIC");

          if (data.media && data.media.length > 0) {
            const mappedMedia: MobileImageFile[] = data.media.map((m) => ({
              id: m.id,
              uri: m.url,
              name: `media_${m.id}.jpg`,
            }));
            setImages(mappedMedia);
            setInitialMediaIds(data.media.map((m) => m.id));
          }
        })
        .catch((err) => {
          if (!active) return;
          setGlobalError(getApiErrorMessage(err));
        })
        .finally(() => {
          if (active) setLoadingPost(false);
        });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [editPostId]);

  // Demo presets for screenshots & testing
  useEffect(() => {
    if (isEdit || !demoPreset) return;
    const timer = setTimeout(() => {
      if (demoPreset === "with_images") {
        setImages([
          {
            uri: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzFlMjkzYiIvPjx0ZXh0IHg9IjMwMCIgeT0iMjAwIiBmaWxsPSIjZmZmIiBmb250LXNpemU9IjYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7wn5KRPC90ZXh0Pjwvc3ZnPg==",
            name: "macbook_pro_14.jpg",
            size: 1024 * 780,
          },
          {
            uri: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzQ3NTU2OSIvPjx0ZXh0IHg9IjMwMCIgeT0iMjAwIiBmaWxsPSIjZmZmIiBmb250LXNpemU9IjYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7wn5SlPC90ZXh0Pjwvc3ZnPg==",
            name: "magsafe_charger.jpg",
            size: 1024 * 320,
          },
        ]);
      } else if (demoPreset === "ai_applied") {
        setPostType("LOST");
        setImages([
          {
            uri: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzFlMjkzYiIvPjx0ZXh0IHg9IjMwMCIgeT0iMjAwIiBmaWxsPSIjZmZmIiBmb250LXNpemU9IjYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7wn5KRPC90ZXh0Pjwvc3ZnPg==",
            name: "macbook_pro_14.jpg",
            size: 1024 * 780,
          },
        ]);
        setTitle("Để quên MacBook Pro 14 M2 Space Gray tại phòng 302 Alpha");
        setDescription("Máy để trong túi chống sốc màu xám đen, mặt ngoài dán sticker logo Dev Club FPTU. Bị quên trên bàn dãy 3 lúc 11h trưa nay sau giờ học môn PRN231.");
        setSelectedCategoryId("cat_1");
        setSelectedAreaId("area_1");
        setSelectedBuildingId("bld_1");
        setRoomText("Phòng 302");
        setCustomLocation("Bàn dãy 3 cạnh cửa sổ");
        setContactInfo("0987654321");
        setVisibilityMode("PUBLIC");
        setAnalysisSignals({
          visualAttributes: ["apple-macbook-pro", "mau-xam-space-gray", "kich-thuoc-14-inch", "sticker-dev-club"],
          visibleText: ["FPTU Dev Club", "Model A2779"],
          confidence: 0.94,
        });
      } else if (demoPreset === "found_handover") {
        setPostType("FOUND");
        setTitle("Nhặt được Ví da nam màu nâu tại khu vực Canteen");
        setDescription("Ví da dáng đứng màu nâu đậm, bên trong có thẻ sinh viên và thẻ xe máy.");
        setSelectedCategoryId("cat_4");
        setSelectedAreaId("area_2");
        setSelectedBuildingId("bld_3");
        setRoomText("Tầng 1 Canteen");
        setSelectedHandoverPointId("hp_1");
        setContactInfo("0987654321");
        setVisibilityMode("PRIVATE_DETAILS");
      } else if (demoPreset === "submitting") {
        setIsSubmitting(true);
        setUploadProgress({
          message: "Đang tải ảnh 1/2 lên máy chủ FPTU...",
          current: 1,
          total: 2,
        });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [demoPreset, isEdit]);

  // Category breadcrumbs computation
  const selectedCategory = useMemo(() => {
    if (!catalog || !selectedCategoryId) return null;
    return catalog.categories.find((c) => c.id === selectedCategoryId) || null;
  }, [catalog, selectedCategoryId]);

  const parentCategory = useMemo(() => {
    if (!catalog || !selectedCategory?.parentId) return null;
    return catalog.categories.find((c) => c.id === selectedCategory.parentId) || null;
  }, [catalog, selectedCategory]);

  const categoryPathLabel = useMemo(() => {
    if (!selectedCategory) return null;
    if (parentCategory) {
      return `${parentCategory.name} > ${selectedCategory.name}`;
    }
    return selectedCategory.name;
  }, [selectedCategory, parentCategory]);

  // Errors for CampusLocationPicker
  const locationPickerErrors: CampusLocationPickerErrors = useMemo(() => {
    return {
      customLocation: formErrors.location,
      areaId: formErrors.location,
      handoverPointId: formErrors.location,
      contactInfo: formErrors.contactInfo,
    };
  }, [formErrors]);

  // AI draft application handler
  const handleApplyAiDraft = useCallback((draft: ApplyAiDraftPayload) => {
    if (draft.title) {
      setTitle(draft.title);
      setFormErrors((prev) => ({ ...prev, title: undefined }));
    }
    if (draft.description) {
      setDescription(draft.description);
    }
    if (draft.suggestedCategoryId) {
      setSelectedCategoryId(draft.suggestedCategoryId);
      setFormErrors((prev) => ({ ...prev, categoryId: undefined }));
    }
    setAnalysisSignals({
      visualAttributes: draft.visualAttributes || [],
      visibleText: draft.visibleText || [],
      confidence: draft.confidence || 0.9,
    });
    Alert.alert(
      "Đã áp dụng bản nháp AI",
      "Thông tin tiêu đề, mô tả và danh mục gợi ý bởi Gemini đã được điền vào biểu mẫu."
    );
  }, []);

  const handleAnalysisSuccess = useCallback((result: ImageAnalysisResult) => {
    if (result.visualAttributes || result.visibleText) {
      setAnalysisSignals({
        visualAttributes: result.visualAttributes || [],
        visibleText: result.visibleText || [],
        confidence: result.confidence || 0.9,
      });
    }
  }, []);

  // Back confirmation
  const handleBackPress = useCallback(() => {
    const hasData = Boolean(
      title.trim() ||
      description.trim() ||
      images.length > (initialMediaIds.length || 0) ||
      selectedCategoryId
    );

    if (hasData && !isSubmitting) {
      Alert.alert(
        "Hủy thay đổi?",
        "Thông tin bạn vừa nhập chưa được lưu. Bạn có chắc chắn muốn rời khỏi không?",
        [
          { text: "Ở lại", style: "cancel" },
          {
            text: "Rời khỏi",
            style: "destructive",
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/posts");
              }
            },
          },
        ]
      );
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/posts");
      }
    }
  }, [title, description, images.length, initialMediaIds.length, selectedCategoryId, isSubmitting]);

  // Handle hardware back button on Android
  useEffect(() => {
    const onHardwareBack = () => {
      handleBackPress();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
    return () => sub.remove();
  }, [handleBackPress]);

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Tiêu đề không được để trống";
    } else if (title.trim().length < 3) {
      newErrors.title = "Tiêu đề cần ít nhất 3 ký tự";
    }

    if (!selectedCategoryId) {
      newErrors.categoryId = "Vui lòng chọn danh mục cho đồ vật";
    }

    if (postType === "FOUND") {
      if (!selectedHandoverPointId && !selectedAreaId && !customLocation.trim()) {
        newErrors.location = "Vui lòng chọn điểm bàn giao hoặc khu vực nhặt được";
      }
    } else {
      if (!selectedAreaId && !customLocation.trim()) {
        newErrors.location = "Vui lòng chọn khu vực hoặc mô tả vị trí thất lạc";
      }
    }

    if (!contactInfo.trim()) {
      newErrors.contactInfo = "Vui lòng nhập thông tin liên hệ (SĐT / Email)";
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submission pipeline
  const handleSubmit = async () => {
    if (!validateForm()) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      Alert.alert(
        "Thiếu thông tin bắt buộc",
        "Vui lòng hoàn thành các mục đánh dấu sao đỏ trước khi gửi bài."
      );
      return;
    }

    setIsSubmitting(true);
    setUploadProgress({
      message: isEdit ? "Đang lưu thay đổi bài viết..." : "Đang tạo bài viết mới...",
      current: 0,
      total: 1,
    });

    try {
      let targetPostId = editPostId;

      if (isEdit && editPostId) {
        // 1. Update post details
        const updatePayload: UpdatePostPayload = {
          title: title.trim(),
          description: description.trim(),
          categoryId: selectedCategoryId!,
          areaId: selectedAreaId,
          buildingId: selectedBuildingId,
          roomText: roomText.trim() || null,
          customLocation: customLocation.trim() || null,
          contactInfo: contactInfo.trim(),
          lostFoundAt: incidentDate.toISOString(),
          handoverPointId: postType === "FOUND" ? selectedHandoverPointId : null,
          visibilityMode,
        };
        await postService.updatePost(editPostId, updatePayload);

        // 2. Delete removed images
        const deletedMediaIds = initialMediaIds.filter(
          (oldId) => !images.some((img) => img.id === oldId)
        );
        for (const delId of deletedMediaIds) {
          try {
            await postService.deletePostMedia(editPostId, delId);
          } catch {
            // Non-fatal if deletion fails
          }
        }
      } else {
        // Create new post
        const createPayload: CreatePostPayload = {
          type: postType,
          title: title.trim(),
          description: description.trim(),
          categoryId: selectedCategoryId!,
          areaId: selectedAreaId,
          buildingId: selectedBuildingId,
          roomText: roomText.trim() || null,
          customLocation: customLocation.trim() || null,
          contactInfo: contactInfo.trim(),
          lostFoundAt: incidentDate.toISOString(),
          handoverPointId: postType === "FOUND" ? selectedHandoverPointId : null,
          visibilityMode,
          analysisSignals: analysisSignals || undefined,
        };
        const created = await postService.createPost(createPayload);
        targetPostId = created.id;
      }

      // 3. Upload new images
      const newImages = images.filter((img) => !img.id);
      let failedUploadCount = 0;

      if (targetPostId && newImages.length > 0) {
        for (let i = 0; i < newImages.length; i++) {
          setUploadProgress({
            message: `Đang tải ảnh ${i + 1}/${newImages.length} lên máy chủ...`,
            current: i + 1,
            total: newImages.length,
          });
          try {
            await postService.uploadPostMedia(targetPostId, newImages[i], "ITEM");
          } catch {
            failedUploadCount++;
          }
        }
      }

      setIsSubmitting(false);
      setUploadProgress(null);

      // 4. Feedback and navigation
      if (failedUploadCount > 0) {
        Alert.alert(
          isEdit ? "Cập nhật thành công một phần" : "Đăng bài thành công một phần",
          `Bài viết đã được ${isEdit ? "cập nhật" : "tạo"}, nhưng có ${failedUploadCount} ảnh tải lên thất bại. Bạn có thể bổ sung lại ảnh sau.`,
          [
            {
              text: "Xem bài đăng",
              onPress: () => {
                router.replace(`/posts/${targetPostId}`);
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "Thành công",
          isEdit
            ? "Bài viết của bạn đã được cập nhật thành công!"
            : "Bài viết của bạn đã được xuất bản lên bảng tin FPTU Lost & Found!",
          [
            {
              text: "Xem bài đăng",
              onPress: () => {
                router.replace(`/posts/${targetPostId}`);
              },
            },
          ]
        );
      }
    } catch (err) {
      setIsSubmitting(false);
      setUploadProgress(null);
      Alert.alert("Lỗi lưu bài viết", getApiErrorMessage(err));
    }
  };

  if (loadingPost || (loadingCatalog && !catalog)) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.centerContainer}>
        <LoadingSpinner
          label={isEdit ? "Đang tải dữ liệu bài đăng..." : "Đang chuẩn bị danh mục..."}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleBackPress}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.ink} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {isEdit ? "Chỉnh sửa bài đăng" : "Đăng tin mới"}
            </Text>
            <View
              style={[
                styles.modeBadge,
                isEdit ? styles.modeBadgeEdit : styles.modeBadgeCreate,
              ]}
            >
              <Text
                style={[
                  styles.modeBadgeText,
                  isEdit ? styles.modeBadgeTextEdit : styles.modeBadgeTextCreate,
                ]}
              >
                {isEdit ? "CHỈNH SỬA" : "TẠO BÀI"}
              </Text>
            </View>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {globalError ? (
          <View style={styles.errorBannerContainer}>
            <ErrorBanner message={globalError} />
          </View>
        ) : null}

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section 1: Post Type Selector */}
          <View style={styles.sectionCard}>
            <PostTypeSelector
              selectedType={postType}
              onSelectType={(newType) => {
                setPostType(newType);
                setFormErrors((prev) => ({ ...prev, location: undefined }));
              }}
              disabled={isEdit}
            />
            {isEdit ? (
              <View style={styles.editModeNote}>
                <MaterialCommunityIcons
                  name="shield-lock-outline"
                  size={15}
                  color={colors.muted}
                />
                <Text style={styles.editModeNoteText}>
                  Loại bài đăng được giữ cố định khi chỉnh sửa để bảo toàn dữ liệu ghép đôi.
                </Text>
              </View>
            ) : null}
          </View>

          {/* Section 2: Media Picker & AI Gemini Analysis */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <MaterialCommunityIcons
                  name="image-multiple-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.sectionTitle}>Hình ảnh vật phẩm</Text>
              </View>
              <Text style={styles.sectionCounter}>
                {images.length}/5 ảnh
              </Text>
            </View>
            <Text style={styles.sectionDescription}>
              Tải lên tối đa 5 hình ảnh rõ nét. Sử dụng AI Gemini để nhận diện vật phẩm và tự động điền bản nháp.
            </Text>

            <PostFormMediaPicker
              images={images}
              onChangeImages={setImages}
              postType={postType}
              maxImages={5}
              disabled={isSubmitting}
              onApplyAiDraft={handleApplyAiDraft}
              onAnalysisSuccess={handleAnalysisSuccess}
              initialAiResult={
                demoPreset === "ai_applied"
                  ? {
                      title: "Để quên MacBook Pro 14 M2 Space Gray tại phòng 302 Alpha",
                      description:
                        "Máy để trong túi chống sốc màu xám đen, mặt ngoài dán sticker logo Dev Club FPTU. Bị quên trên bàn dãy 3 lúc 11h trưa nay sau giờ học môn PRN231.",
                      suggestedCategory: {
                        id: "cat_1",
                        name: "Laptop & Máy tính",
                        parentId: "cat_root_1",
                      },
                      visualAttributes: [
                        "apple-macbook-pro",
                        "mau-xam-space-gray",
                        "kich-thuoc-14-inch",
                        "sticker-dev-club",
                      ],
                      visibleText: ["FPTU Dev Club", "Model A2779"],
                      confidence: 0.94,
                      warnings: [],
                      assistedBy: "Gemini 1.5 Pro",
                      model: "gemini-1.5-pro",
                      imageCount: 1,
                    }
                  : null
              }
            />
          </View>

          {/* Section 3: Post Details (Title, Category, Description) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <MaterialCommunityIcons
                  name="text-box-edit-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.sectionTitle}>Thông tin chi tiết</Text>
              </View>
            </View>

            {/* Title Input */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Tiêu đề bài viết</Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>
              <TextInput
                style={[styles.textInput, formErrors.title && styles.textInputError]}
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  if (formErrors.title) {
                    setFormErrors((prev) => ({ ...prev, title: undefined }));
                  }
                }}
                placeholder={
                  postType === "LOST"
                    ? "VD: Đánh rơi ví da nam màu nâu tại sảnh Alpha..."
                    : "VD: Nhặt được tai nghe AirPods 3 gần thư viện..."
                }
                placeholderTextColor={colors.muted}
                maxLength={120}
              />
              {formErrors.title ? (
                <Text style={styles.errorText}>{formErrors.title}</Text>
              ) : null}
            </View>

            {/* Category Selector Button */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Danh mục vật phẩm</Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>
              <Pressable
                onPress={() => setCategoryModalVisible(true)}
                style={({ pressed }) => [
                  styles.categorySelectorButton,
                  formErrors.categoryId && styles.categorySelectorButtonError,
                  pressed && styles.categorySelectorButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Chọn danh mục"
              >
                <View
                  style={[
                    styles.categoryIconCircle,
                    selectedCategory && styles.categoryIconCircleSelected,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      selectedCategory
                        ? getCategoryIcon(selectedCategory.name)
                        : "tag-outline"
                    }
                    size={22}
                    color={selectedCategory ? colors.primary : colors.muted}
                  />
                </View>
                <View style={styles.categoryInfo}>
                  <Text
                    style={[
                      styles.categoryMainText,
                      !selectedCategory && styles.categoryPlaceholderText,
                    ]}
                    numberOfLines={1}
                  >
                    {categoryPathLabel || "Chọn danh mục cho đồ vật..."}
                  </Text>
                  <Text style={styles.categorySubText}>
                    {selectedCategory
                      ? "Chạm để thay đổi danh mục"
                      : "Phân loại giúp AI tìm kiếm và đối soát chuẩn xác"}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={colors.muted}
                />
              </Pressable>
              {formErrors.categoryId ? (
                <Text style={styles.errorText}>{formErrors.categoryId}</Text>
              ) : null}
            </View>

            {/* Description Textarea */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Mô tả chi tiết</Text>
              </View>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Mô tả chi tiết: đặc điểm nhận dạng, màu sắc, hãng sản xuất, vết trầy xước, phụ kiện đi kèm..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>
                Mẹo: Mô tả càng chi tiết sẽ giúp xác minh chính xác và giảm thiểu nhầm lẫn khi nhận lại đồ.
              </Text>
            </View>
          </View>

          {/* Section 4: Location & Handover Point */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <MaterialCommunityIcons
                  name="map-marker-radius-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.sectionTitle}>Vị trí & Điểm bàn giao</Text>
              </View>
            </View>

            <CampusLocationPicker
              postType={postType}
              areas={catalog?.areas || []}
              buildings={catalog?.buildings || []}
              handoverPoints={catalog?.handoverPoints || []}
              selectedAreaId={selectedAreaId}
              onSelectAreaId={(areaId) => {
                setSelectedAreaId(areaId);
                setSelectedBuildingId(null);
                if (formErrors.location) {
                  setFormErrors((prev) => ({ ...prev, location: undefined }));
                }
              }}
              selectedBuildingId={selectedBuildingId}
              onSelectBuildingId={setSelectedBuildingId}
              roomText={roomText}
              onChangeRoomText={setRoomText}
              customLocation={customLocation}
              onChangeCustomLocation={(text) => {
                setCustomLocation(text);
                if (formErrors.location) {
                  setFormErrors((prev) => ({ ...prev, location: undefined }));
                }
              }}
              selectedHandoverPointId={selectedHandoverPointId}
              onSelectHandoverPointId={(id) => {
                setSelectedHandoverPointId(id);
                if (formErrors.location) {
                  setFormErrors((prev) => ({ ...prev, location: undefined }));
                }
              }}
              contactInfo={contactInfo}
              onChangeContactInfo={(text) => {
                setContactInfo(text);
                if (formErrors.contactInfo) {
                  setFormErrors((prev) => ({ ...prev, contactInfo: undefined }));
                }
              }}
              disabled={isSubmitting}
              errors={locationPickerErrors}
            />
          </View>

          {/* Section 5: Incident Time */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <MaterialCommunityIcons
                  name="clock-time-four-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.sectionTitle}>Thời gian sự việc</Text>
              </View>
            </View>

            <IncidentDateTimePicker
              value={incidentDate}
              onChange={setIncidentDate}
              mode="datetime"
              label={postType === "LOST" ? "Thời gian làm mất" : "Thời gian nhặt được"}
              helperText="Ước tính thời gian xảy ra sự việc để hỗ trợ bộ lọc và đối soát ghép đôi"
              maximumDate={new Date()}
            />
          </View>

          {/* Section 6: Visibility Mode */}
          <View style={styles.sectionCard}>
            <VisibilityModeToggle
              mode={visibilityMode}
              onChangeMode={setVisibilityMode}
              disabled={isSubmitting}
            />
          </View>
        </ScrollView>

        {/* Bottom Action Dock */}
        <View
          style={[
            styles.bottomDock,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          <Button
            title={isEdit ? "Lưu thay đổi bài đăng" : "Đăng bài ngay"}
            onPress={handleSubmit}
            loading={isSubmitting}
            style={styles.submitButton}
          />
        </View>

        {/* Category Picker Modal */}
        <CategoryPickerModal
          visible={categoryModalVisible}
          onClose={() => setCategoryModalVisible(false)}
          categories={catalog?.categories || []}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={(category) => {
            setSelectedCategoryId(category.id);
            setFormErrors((prev) => ({ ...prev, categoryId: undefined }));
          }}
        />

        {/* Submission & Upload Progress Overlay */}
        <Modal
          visible={isSubmitting}
          transparent
          animationType="fade"
        >
          <View style={styles.progressBackdrop}>
            <View style={styles.progressCard}>
              <ActivityIndicator size="large" color={colors.primary} style={styles.progressSpinner} />
              <Text style={styles.progressTitle}>
                {isEdit ? "Đang lưu thay đổi..." : "Đang xuất bản bài đăng..."}
              </Text>
              {uploadProgress ? (
                <Text style={styles.progressMessage}>{uploadProgress.message}</Text>
              ) : null}
              <Text style={styles.progressTip}>
                Vui lòng giữ ứng dụng mở trong giây lát để hệ thống tải dữ liệu lên hoàn tất.
              </Text>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  backBtnPressed: {
    opacity: 0.75,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  modeBadgeCreate: {
    backgroundColor: colors.successSoft,
  },
  modeBadgeEdit: {
    backgroundColor: colors.warningSoft,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modeBadgeTextCreate: {
    color: colors.success,
  },
  modeBadgeTextEdit: {
    color: colors.warning,
  },
  headerSpacer: {
    width: 40,
  },
  errorBannerContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
  },
  sectionCounter: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  sectionDescription: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  editModeNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
    marginTop: spacing.sm,
  },
  editModeNoteText: {
    fontSize: 12,
    color: colors.muted,
    flex: 1,
    lineHeight: 16,
  },
  formGroup: {
    marginTop: spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  requiredStar: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.danger,
    marginLeft: 3,
  },
  textInput: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  textInputError: {
    borderColor: colors.danger,
    backgroundColor: "#FEF2F2",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  helperText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 5,
    lineHeight: 16,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
    fontWeight: "600",
  },
  categorySelectorButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    padding: spacing.md,
    gap: spacing.md,
  },
  categorySelectorButtonError: {
    borderColor: colors.danger,
    backgroundColor: "#FEF2F2",
  },
  categorySelectorButtonPressed: {
    backgroundColor: colors.border,
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryIconCircleSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryMainText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  categoryPlaceholderText: {
    color: colors.muted,
    fontWeight: "500",
  },
  categorySubText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  bottomDock: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  submitButton: {
    width: "100%",
  },
  progressBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  progressCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.xl,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  progressSpinner: {
    marginBottom: spacing.md,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  progressMessage: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  progressTip: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 16,
  },
});
