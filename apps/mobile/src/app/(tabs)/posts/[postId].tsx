import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { colors, radii, spacing } from "@/constants/theme";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SecureImage } from "@/components/secure-image";
import { CustodyTransferModal } from "@/components/custody-transfer-modal";
import { ReportModal } from "@/components/report-modal";
import {
  getApiErrorMessage,
  postService,
  type CustodyRequest,
  type PostSummary,
} from "@/services/api";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Chưa xác định";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Chưa xác định";
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const y = d.getFullYear();
    return `${h}:${m}, ${day}/${month}/${y}`;
  } catch {
    return "Chưa xác định";
  }
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "Vừa xong";
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngày trước`;
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  } catch {
    return "";
  }
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatLocation(location: PostSummary["location"]): string {
  const parts: string[] = [];
  if (location.roomText) parts.push(`Phòng ${location.roomText}`);
  if (location.building?.name) parts.push(location.building.name);
  if (location.area?.name) parts.push(location.area.name);
  if (parts.length > 0) return parts.join(" · ");
  if (location.customLocation) return location.customLocation;
  return "Khuôn viên FPTU";
}

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<PostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gallery state
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Custody transfer status (for FOUND owner)
  const [custodyInfo, setCustodyInfo] = useState<{
    request: CustodyRequest | null;
    warehouseItem?: { id: string; status: string } | null;
  } | null>(null);

  // Related posts
  const [relatedPosts, setRelatedPosts] = useState<PostSummary[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Modals
  const [custodyModalVisible, setCustodyModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // Action states
  const [connectingChat, setConnectingChat] = useState(false);

  const loadPost = useCallback(
    async (isRefresh = false) => {
      if (!postId) return;
      if (isRefresh) setRefreshing(true);
      setError(null);

      try {
        const postData = await postService.getPost(postId);
        setPost(postData);

        // If FOUND owner, check custody status
        if (postData.type === "FOUND" && postData.canEdit) {
          try {
            const custodyData = await postService.getMyCustodyRequestByPost(
              postData.id
            );
            setCustodyInfo(custodyData);
          } catch {
            setCustodyInfo(null);
          }
        }

        // Fetch related posts (opposite type, same category)
        const counterType = postData.type === "LOST" ? "FOUND" : "LOST";
        setLoadingRelated(true);
        postService
          .listPosts({
            type: counterType,
            categoryId: postData.category?.id,
            page: 1,
            pageSize: 3,
          })
          .then((res) => {
            const items = (res.items || []).filter(
              (item) => item.id !== postData.id
            );
            setRelatedPosts(items);
          })
          .catch(() => {
            setRelatedPosts([]);
          })
          .finally(() => {
            setLoadingRelated(false);
          });
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [postId]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPost();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPost]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/posts");
    }
  };

  const handleCustodySuccess = () => {
    setCustodyModalVisible(false);
    if (post) {
      postService
        .getMyCustodyRequestByPost(post.id)
        .then(setCustodyInfo)
        .catch(() => {});
    }
  };

  const handleReportSuccess = () => {
    setReportModalVisible(false);
  };

  const handleStartConversation = async () => {
    if (!post) return;
    setConnectingChat(true);
    try {
      const match = await postService.findConversationByPost(post.id);
      if (match?.id) {
        router.push(`/claims/${match.id}`);
      } else {
        router.push({
          pathname: "/claims",
          params: { composePostId: post.id },
        });
      }
    } catch {
      router.push({
        pathname: "/claims",
        params: { composePostId: post.id },
      });
    } finally {
      setConnectingChat(false);
    }
  };

  const handleEditPost = () => {
    Alert.alert(
      "Chỉnh sửa bài viết",
      `Bạn đang chỉnh sửa bài đăng "${post?.title}". Tính năng chỉnh sửa trực tiếp trên mobile đang đồng bộ hóa với Web Portal. Mã bài đăng: ${post?.id}`
    );
  };

  const onCarouselScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (!carouselWidth) return;
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / carouselWidth);
    setActiveImageIndex(index);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <LoadingSpinner label="Đang tải chi tiết bài viết…" />
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={styles.appHeader}>
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <MaterialCommunityIcons
              name="chevron-left"
              size={28}
              color={colors.ink}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Chi tiết bài đăng</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorBody}>
          <ErrorBanner
            message={error || "Không tìm thấy bài viết này hoặc bài đã bị ẩn."}
            onRetry={() => loadPost()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isLost = post.type === "LOST";
  const mediaList = post.media || [];
  const hasMultipleImages = mediaList.length > 1;
  const matchCount =
    (post.matchSummary?.candidateCount ?? 0) +
    (post.matchSummary?.suggestionCount ?? 0);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        {/* Custom Header */}
        <View style={styles.appHeader}>
          <Pressable
            hitSlop={8}
            onPress={handleBack}
            style={styles.iconButton}
            accessibilityLabel="Quay lại danh sách"
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={28}
              color={colors.ink}
            />
          </Pressable>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {isLost ? "Báo mất đồ" : "Báo nhặt được đồ"}
          </Text>

          <View style={styles.headerActions}>
            {!post.canEdit ? (
              <Pressable
                hitSlop={8}
                onPress={() => setReportModalVisible(true)}
                style={styles.reportHeaderBtn}
                accessibilityLabel="Báo cáo bài viết"
              >
                <MaterialCommunityIcons
                  name="flag-outline"
                  size={18}
                  color={colors.danger}
                />
                <Text style={styles.reportHeaderText}>Báo cáo</Text>
              </Pressable>
            ) : (
              <View style={styles.headerRightOwner}>
                {matchCount > 0 ? (
                  <View style={styles.matchBadgeHeader}>
                    <MaterialCommunityIcons
                      name="creation"
                      size={14}
                      color={colors.accent}
                    />
                    <Text style={styles.matchBadgeHeaderText}>
                      {matchCount}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  hitSlop={8}
                  onPress={handleEditPost}
                  style={styles.editHeaderBtn}
                  accessibilityLabel="Chỉnh sửa bài viết"
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name="square-edit-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.editHeaderText}>Sửa bài</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadPost(true)}
            colors={[colors.primary]}
          />
        }
      >
        {/* Gallery / Image Carousel */}
        <View
          style={styles.carouselContainer}
          onLayout={(e) => setCarouselWidth(e.nativeEvent.layout.width)}
        >
          {mediaList.length === 0 ? (
            <View style={styles.noMediaCard}>
              <MaterialCommunityIcons
                name="image-off-outline"
                size={42}
                color={colors.muted}
              />
              <Text style={styles.noMediaText}>Bài đăng không kèm hình ảnh</Text>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onCarouselScroll}
                scrollEventThrottle={16}
                style={{ width: carouselWidth || "100%" }}
              >
                {mediaList.map((media, index) => (
                  <Pressable
                    key={media.id || index}
                    onPress={() => setFullscreenImage(media.url)}
                    style={[
                      styles.carouselSlide,
                      { width: carouselWidth || "100%" },
                    ]}
                  >
                    <SecureImage
                      url={media.url}
                      style={styles.carouselImage}
                      resizeMode="cover"
                      accessibilityLabel={`Hình ảnh ${index + 1} của vật phẩm`}
                    />

                    {/* AI Generated Indicator */}
                    {media.isAiGenerated ? (
                      <View style={styles.aiBadge}>
                        <MaterialCommunityIcons
                          name="creation"
                          size={13}
                          color="#fff"
                        />
                        <Text style={styles.aiBadgeText}>Ảnh AI minh họa</Text>
                      </View>
                    ) : null}

                    {/* Zoom Icon Hint */}
                    <View style={styles.zoomHint}>
                      <MaterialCommunityIcons
                        name="magnify-plus-outline"
                        size={16}
                        color="#fff"
                      />
                    </View>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Page Number Indicator */}
              {hasMultipleImages ? (
                <View style={styles.pageIndicator}>
                  <Text style={styles.pageIndicatorText}>
                    {activeImageIndex + 1} / {mediaList.length}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.mainContent}>
          {/* Status & Type Badges Row */}
          <View style={styles.badgesRow}>
            {/* Type Badge */}
            <View
              style={[
                styles.typeBadge,
                isLost ? styles.typeBadgeLost : styles.typeBadgeFound,
              ]}
            >
              <MaterialCommunityIcons
                name={isLost ? "magnify" : "hand-heart-outline"}
                size={14}
                color={isLost ? colors.danger : colors.success}
              />
              <Text
                style={[
                  styles.typeBadgeText,
                  isLost
                    ? styles.typeBadgeTextLost
                    : styles.typeBadgeTextFound,
                ]}
              >
                {isLost ? "TÌM ĐỒ THẤT LẠC" : "NHẶT ĐƯỢC ĐỒ"}
              </Text>
            </View>

            {/* Post Status */}
            <Badge status={post.status} />

            {/* Privacy Lock Badge */}
            {post.visibilityMode === "PRIVATE_DETAILS" ? (
              <View style={styles.privacyBadge}>
                <MaterialCommunityIcons
                  name="shield-lock"
                  size={13}
                  color={colors.primary}
                />
                <Text style={styles.privacyBadgeText}>
                  Chi tiết được bảo vệ
                </Text>
              </View>
            ) : null}
          </View>

          {/* Post Title */}
          <Text style={styles.postTitle}>{post.title}</Text>

          {/* Owner & Time Card */}
          <View style={styles.ownerCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {getInitials(post.owner.fullName)}
              </Text>
            </View>
            <View style={styles.ownerInfo}>
              <Text style={styles.ownerName}>{post.owner.fullName}</Text>
              <Text style={styles.postDate}>
                {formatRelativeTime(post.createdAt)} ·{" "}
                {formatDateTime(post.createdAt)}
              </Text>
            </View>
          </View>

          {/* Facts Grid (Lưới thông số chi tiết) */}
          <View style={styles.factsGrid}>
            {/* Fact: Category */}
            <View style={styles.factCard}>
              <View
                style={[
                  styles.factIconWrap,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <MaterialCommunityIcons
                  name="tag-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={styles.factTextWrap}>
                <Text style={styles.factLabel}>Danh mục</Text>
                <Text style={styles.factValue} numberOfLines={2}>
                  {post.category?.name || "Chưa phân loại"}
                </Text>
              </View>
            </View>

            {/* Fact: Incident Time */}
            <View style={styles.factCard}>
              <View
                style={[
                  styles.factIconWrap,
                  { backgroundColor: colors.accentSoft },
                ]}
              >
                <MaterialCommunityIcons
                  name="calendar-clock-outline"
                  size={18}
                  color={colors.accent}
                />
              </View>
              <View style={styles.factTextWrap}>
                <Text style={styles.factLabel}>
                  {isLost ? "Thời gian mất" : "Thời gian nhặt"}
                </Text>
                <Text style={styles.factValue} numberOfLines={2}>
                  {formatDateTime(post.lostFoundAt)}
                </Text>
              </View>
            </View>

            {/* Fact: Location */}
            <View style={styles.factCard}>
              <View
                style={[
                  styles.factIconWrap,
                  { backgroundColor: colors.successSoft },
                ]}
              >
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={18}
                  color={colors.success}
                />
              </View>
              <View style={styles.factTextWrap}>
                <Text style={styles.factLabel}>Vị trí xảy ra</Text>
                <Text style={styles.factValue} numberOfLines={2}>
                  {formatLocation(post.location)}
                </Text>
              </View>
            </View>

            {/* Fact: Privacy Mode */}
            <View style={styles.factCard}>
              <View
                style={[
                  styles.factIconWrap,
                  { backgroundColor: colors.neutralSoft },
                ]}
              >
                <MaterialCommunityIcons
                  name="shield-outline"
                  size={18}
                  color={colors.neutral}
                />
              </View>
              <View style={styles.factTextWrap}>
                <Text style={styles.factLabel}>Chế độ hiển thị</Text>
                <Text style={styles.factValue}>
                  {post.visibilityMode === "PUBLIC"
                    ? "Công khai"
                    : "Bảo vệ thông tin"}
                </Text>
              </View>
            </View>
          </View>

          {/* Description Section */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="text-box-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.sectionTitle}>Mô tả nhận dạng</Text>
            </View>
            <Text style={styles.descriptionText}>
              {post.description?.trim() || "Người đăng không để lại mô tả chi tiết."}
            </Text>

            {post.visibilityMode === "PRIVATE_DETAILS" ? (
              <View style={styles.privateDetailsNotice}>
                <MaterialCommunityIcons
                  name="lock-check-outline"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.privateDetailsNoticeText}>
                  Bài đăng này ẩn một số đặc điểm chi tiết để người mất tự đối chiếu khi xác minh quyền sở hữu.
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Handover Point Card (if specified) */}
          {post.handoverPoint ? (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="store-marker-outline"
                  size={18}
                  color={colors.success}
                />
                <Text style={styles.sectionTitle}>Điểm bàn giao tiếp nhận</Text>
              </View>
              <View style={styles.handoverPointContent}>
                <Text style={styles.handoverPointName}>
                  {post.handoverPoint.name}
                </Text>
                {post.handoverPoint.address ? (
                  <View style={styles.handoverRow}>
                    <MaterialCommunityIcons
                      name="map-marker-radius-outline"
                      size={15}
                      color={colors.muted}
                    />
                    <Text style={styles.handoverRowText}>
                      {post.handoverPoint.address}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Card>
          ) : null}

          {/* Custody Transfer Section (Only for FOUND post owner) */}
          {!isLost && post.canEdit ? (
            <Card style={styles.custodyCard}>
              <View style={styles.custodyHeader}>
                <View style={styles.custodyIconWrap}>
                  <MaterialCommunityIcons
                    name="archive-arrow-down-outline"
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.custodyTitle}>
                    Bàn giao vật phẩm vào kho Staff
                  </Text>
                  <Text style={styles.custodyDesc}>
                    {custodyInfo?.warehouseItem
                      ? "Vật phẩm đã được nhân viên Staff lưu trữ an toàn tại quầy tiếp nhận."
                      : custodyInfo?.request?.status === "PENDING"
                      ? "Yêu cầu bàn giao đang chờ Staff tiếp nhận tại quầy theo lịch hẹn."
                      : custodyInfo?.request?.status === "ACCEPTED"
                      ? "Yêu cầu bàn giao đã được chấp nhận. Vui lòng mang đồ đến quầy."
                      : "Gửi vật phẩm nhặt được đến quầy tiếp nhận FPTU để bảo quản an toàn và hỗ trợ tìm chủ nhân."}
                  </Text>
                </View>
              </View>

              {custodyInfo?.warehouseItem ||
              custodyInfo?.request?.status === "PENDING" ||
              custodyInfo?.request?.status === "ACCEPTED" ? (
                <View style={styles.custodyStatusBadge}>
                  <MaterialCommunityIcons
                    name="check-decagram"
                    size={16}
                    color={colors.success}
                  />
                  <Text style={styles.custodyStatusBadgeText}>
                    {custodyInfo.warehouseItem
                      ? "ĐÃ LƯU TRỮ TRONG KHO"
                      : `YÊU CẦU: ${custodyInfo.request?.status}`}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => setCustodyModalVisible(true)}
                  style={styles.custodyActionBtn}
                >
                  <MaterialCommunityIcons
                    name="hand-back-right"
                    size={17}
                    color="#fff"
                  />
                  <Text style={styles.custodyActionBtnText}>
                    Gửi vào kho Staff
                  </Text>
                </Pressable>
              )}
            </Card>
          ) : null}

          {/* Post Processing Progress & History (Tiến trình & Lịch sử xử lý) */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="timeline-clock-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.sectionTitle}>Tiến trình & Lịch sử xử lý bài</Text>
            </View>

            <View style={styles.timelineContainer}>
              {/* Step 1: Created */}
              <View style={styles.timelineItem}>
                <View style={styles.timelineIconCol}>
                  <View style={[styles.timelineDot, styles.timelineDotActive]}>
                    <MaterialCommunityIcons name="check" size={12} color="#fff" />
                  </View>
                  <View
                    style={[
                      styles.timelineLine,
                      (post.status === "MATCHED" ||
                        post.status === "RESOLVED" ||
                        post.status === "CLOSED") &&
                        styles.timelineLineActive,
                    ]}
                  />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStepTitle}>
                    Đăng tin &amp; Tiếp nhận hệ thống
                  </Text>
                  <Text style={styles.timelineStepDate}>
                    {formatDateTime(post.createdAt)}
                  </Text>
                  <Text style={styles.timelineStepDesc}>
                    {isLost
                      ? "Bài đăng tìm đồ thất lạc đã được tiếp nhận công khai trên FPTU Campus."
                      : "Bài đăng nhặt được đồ đã sẵn sàng đối chiếu để tìm chủ nhân."}
                  </Text>
                </View>
              </View>

              {/* Step 2: Matching */}
              <View style={styles.timelineItem}>
                <View style={styles.timelineIconCol}>
                  <View
                    style={[
                      styles.timelineDot,
                      post.status === "MATCHED" || matchCount > 0
                        ? styles.timelineDotActive
                        : styles.timelineDotPending,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={post.status === "MATCHED" ? "check" : "radar"}
                      size={12}
                      color={
                        post.status === "MATCHED" || matchCount > 0
                          ? "#fff"
                          : colors.muted
                      }
                    />
                  </View>
                  <View
                    style={[
                      styles.timelineLine,
                      (post.status === "RESOLVED" ||
                        post.status === "CLOSED") &&
                        styles.timelineLineActive,
                    ]}
                  />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStepTitle}>
                    Đối chiếu &amp; Ghép đôi AI
                  </Text>
                  <Text style={styles.timelineStepDate}>
                    {matchCount > 0
                      ? `Phát hiện ${matchCount} gợi ý trùng khớp khả thi`
                      : "Hệ thống AI tự động phân tích dữ liệu đối ứng"}
                  </Text>
                  <Text style={styles.timelineStepDesc}>
                    {post.status === "MATCHED"
                      ? "Đã xác định ứng viên đối ứng và đang tiến hành xác minh liên hệ."
                      : "Tự động so sánh vị trí, danh mục và đặc điểm nhận dạng theo thời gian thực."}
                  </Text>
                </View>
              </View>

              {/* Step 3: Resolved */}
              <View style={[styles.timelineItem, { marginBottom: 0 }]}>
                <View style={styles.timelineIconCol}>
                  <View
                    style={[
                      styles.timelineDot,
                      post.status === "RESOLVED" || post.status === "CLOSED"
                        ? styles.timelineDotSuccess
                        : styles.timelineDotPending,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="handshake-outline"
                      size={12}
                      color={
                        post.status === "RESOLVED" || post.status === "CLOSED"
                          ? "#fff"
                          : colors.muted
                      }
                    />
                  </View>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStepTitle}>
                    {post.status === "RESOLVED"
                      ? "Đã hoàn tất trao trả thành công"
                      : post.status === "CLOSED"
                      ? "Bài đăng đã đóng lưu trữ"
                      : "Hoàn tất trao trả &amp; Đóng bài"}
                  </Text>
                  <Text style={styles.timelineStepDate}>
                    {post.status === "RESOLVED" || post.status === "CLOSED"
                      ? `Trạng thái: ${post.status}`
                      : "Chờ xác nhận bàn giao giữa các bên"}
                  </Text>
                </View>
              </View>
            </View>
          </Card>

          {/* Related Counterpart Posts */}
          {relatedPosts.length > 0 ? (
            <View style={styles.relatedSection}>
              <View style={styles.relatedHeader}>
                <MaterialCommunityIcons
                  name="sync"
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.relatedTitle}>
                  {isLost
                    ? "Bài báo nhặt gần đây cùng danh mục"
                    : "Bài báo mất gần đây cùng danh mục"}
                </Text>
              </View>

              <View style={styles.relatedList}>
                {relatedPosts.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/posts/${item.id}`)}
                    style={styles.relatedCard}
                  >
                    <View style={styles.relatedThumbWrap}>
                      {item.media && item.media[0] ? (
                        <SecureImage
                          url={item.media[0].url}
                          style={styles.relatedThumb}
                        />
                      ) : (
                        <View style={styles.relatedThumbPlaceholder}>
                          <MaterialCommunityIcons
                            name="image-outline"
                            size={20}
                            color={colors.muted}
                          />
                        </View>
                      )}
                    </View>

                    <View style={styles.relatedInfo}>
                      <View style={styles.relatedTopRow}>
                        <View
                          style={[
                            styles.relatedTypeBadge,
                            item.type === "LOST"
                              ? styles.typeBadgeLost
                              : styles.typeBadgeFound,
                          ]}
                        >
                          <Text
                            style={[
                              styles.relatedTypeBadgeText,
                              item.type === "LOST"
                                ? styles.typeBadgeTextLost
                                : styles.typeBadgeTextFound,
                            ]}
                          >
                            {item.type === "LOST" ? "MẤT" : "NHẶT"}
                          </Text>
                        </View>
                        <Text style={styles.relatedTime}>
                          {formatRelativeTime(item.createdAt)}
                        </Text>
                      </View>
                      <Text style={styles.relatedPostTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.relatedLocation} numberOfLines={1}>
                        <MaterialCommunityIcons
                          name="map-marker-outline"
                          size={12}
                          color={colors.muted}
                        />{" "}
                        {formatLocation(item.location)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : loadingRelated ? (
            <View style={styles.relatedLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.relatedLoadingText}>
                Đang tìm bài đối ứng liên quan...
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom Action Dock */}
      <View
        style={[
          styles.bottomDock,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {!post.canEdit ? (
          post.status === "OPEN" || post.status === "MATCHED" ? (
            <Pressable
              onPress={handleStartConversation}
              disabled={connectingChat}
              style={[
                styles.primaryDockBtn,
                connectingChat && styles.dockBtnDisabled,
              ]}
              accessibilityRole="button"
            >
              {connectingChat ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="message-text-outline"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.primaryDockBtnText}>
                    {isLost
                      ? "Yêu cầu đối chiếu (Claim) / Nhắn tin"
                      : "Yêu cầu nhận lại (Claim) / Nhắn tin"}
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={styles.dockInfoBox}>
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={colors.muted}
              />
              <Text style={styles.dockInfoText}>
                Bài viết này đang ở trạng thái {post.status.toLowerCase()}.
              </Text>
            </View>
          )
        ) : (
          <View style={styles.ownerDockContainer}>
            <Pressable
              onPress={() => {
                if (matchCount > 0) {
                  Alert.alert(
                    "Gợi ý ghép đôi",
                    `Hệ thống AI đã phát hiện ${matchCount} tin có khả năng đối ứng cao. Bạn hãy đối chiếu danh sách bài đối ứng cùng danh mục ở trên hoặc theo dõi mục Thông báo.`
                  );
                } else {
                  Alert.alert(
                    "Gợi ý ghép đôi",
                    "Hiện tại chưa có gợi ý ghép đôi mới. Hệ thống AI đang tự động theo dõi và sẽ gửi thông báo ngay khi có tin đối ứng."
                  );
                }
              }}
              style={[
                styles.matchDockBtn,
                matchCount === 0 && styles.matchDockBtnMuted,
              ]}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="creation"
                size={18}
                color={matchCount === 0 ? colors.muted : "#fff"}
              />
              <Text
                style={[
                  styles.primaryDockBtnText,
                  matchCount === 0 && styles.matchDockBtnTextMuted,
                ]}
              >
                Xem gợi ý ghép đôi{matchCount > 0 ? ` (${matchCount})` : ""}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleEditPost}
              style={styles.editDockBtn}
              accessibilityRole="button"
              accessibilityLabel="Chỉnh sửa bài viết"
            >
              <MaterialCommunityIcons
                name="square-edit-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.editDockBtnText}>Chỉnh sửa bài</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Fullscreen Image Preview Modal */}
      <Modal
        visible={Boolean(fullscreenImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImage(null)}
      >
        <View style={styles.fullscreenBackdrop}>
          <SafeAreaView style={styles.fullscreenHeader}>
            <Pressable
              onPress={() => setFullscreenImage(null)}
              style={styles.fullscreenCloseBtn}
              hitSlop={12}
              accessibilityLabel="Đóng ảnh"
            >
              <MaterialCommunityIcons name="close" size={26} color="#fff" />
            </Pressable>
          </SafeAreaView>

          <View style={styles.fullscreenImageContainer}>
            {fullscreenImage ? (
              <SecureImage
                url={fullscreenImage}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Custody Transfer Modal */}
      <CustodyTransferModal
        visible={custodyModalVisible}
        postId={post.id}
        postTitle={post.title}
        onClose={() => setCustodyModalVisible(false)}
        onSuccess={handleCustodySuccess}
      />

      {/* Report Modal */}
      <ReportModal
        visible={reportModalVisible}
        postId={post.id}
        postTitle={post.title}
        onClose={() => setReportModalVisible(false)}
        onSuccess={handleReportSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeTop: {
    backgroundColor: colors.surface,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorBody: {
    padding: spacing.lg,
  },
  appHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    height: 52,
    backgroundColor: colors.surface,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    flex: 1,
    textAlign: "center",
  },
  headerActions: {
    minWidth: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  reportHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.dangerSoft,
  },
  reportHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
  },
  matchBadgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  matchBadgeHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
  },
  headerRightOwner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  editHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  carouselContainer: {
    width: "100%",
    height: 280,
    backgroundColor: colors.surfaceMuted,
    position: "relative",
  },
  noMediaCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  noMediaText: {
    fontSize: 14,
    color: colors.muted,
  },
  carouselSlide: {
    height: "100%",
    position: "relative",
  },
  carouselImage: {
    width: "100%",
    height: "100%",
  },
  aiBadge: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(11, 99, 182, 0.88)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  zoomHint: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  pageIndicator: {
    position: "absolute",
    bottom: spacing.md,
    right: spacing.md,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  pageIndicatorText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  mainContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  typeBadgeLost: {
    backgroundColor: colors.dangerSoft,
  },
  typeBadgeFound: {
    backgroundColor: colors.successSoft,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  typeBadgeTextLost: {
    color: colors.danger,
  },
  typeBadgeTextFound: {
    color: colors.success,
  },
  privacyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  privacyBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  postTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    lineHeight: 30,
  },
  ownerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  ownerInfo: {
    flex: 1,
    gap: 2,
  },
  ownerName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  postDate: {
    fontSize: 12,
    color: colors.muted,
  },
  factsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  factCard: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  factIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.control,
    alignItems: "center",
    justifyContent: "center",
  },
  factTextWrap: {
    flex: 1,
    gap: 2,
  },
  factLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
  },
  factValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 18,
  },
  sectionCard: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink,
  },
  privateDetailsNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radii.control,
    marginTop: spacing.xs,
  },
  privateDetailsNoticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.primaryDark,
    lineHeight: 16,
  },
  handoverPointContent: {
    gap: 4,
    paddingTop: 2,
  },
  handoverPointName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  handoverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  handoverRowText: {
    fontSize: 13,
    color: colors.muted,
  },
  custodyCard: {
    backgroundColor: colors.primarySoft,
    borderColor: "#B7D9F8",
    gap: spacing.md,
  },
  custodyHeader: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  custodyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  custodyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  custodyDesc: {
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
    marginTop: 2,
  },
  custodyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radii.control,
  },
  custodyActionBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  custodyStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.successSoft,
    paddingVertical: 10,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: "#B9E4C9",
  },
  custodyStatusBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.success,
  },
  timelineContainer: {
    marginTop: spacing.xs,
    paddingLeft: spacing.xs,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  timelineIconCol: {
    alignItems: "center",
    width: 28,
    marginRight: spacing.sm,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
  },
  timelineDotSuccess: {
    backgroundColor: colors.success,
  },
  timelineDotPending: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  timelineLineActive: {
    backgroundColor: colors.primary,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 1,
  },
  timelineStepTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  timelineStepDate: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primaryDark,
    marginTop: 1,
  },
  timelineStepDesc: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
    lineHeight: 16,
  },
  relatedSection: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  relatedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  relatedTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  relatedList: {
    gap: spacing.md,
  },
  relatedCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    alignItems: "center",
  },
  relatedThumbWrap: {
    width: 80,
    height: 80,
  },
  relatedThumb: {
    width: "100%",
    height: "100%",
  },
  relatedThumbPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  relatedInfo: {
    flex: 1,
    padding: spacing.sm,
    gap: 3,
  },
  relatedTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  relatedTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  relatedTypeBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  relatedTime: {
    fontSize: 11,
    color: colors.muted,
  },
  relatedPostTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 18,
  },
  relatedLocation: {
    fontSize: 11,
    color: colors.muted,
  },
  relatedLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    justifyContent: "center",
  },
  relatedLoadingText: {
    fontSize: 13,
    color: colors.muted,
  },
  bottomDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryDockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radii.control,
  },
  matchDockBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radii.control,
  },
  matchDockBtnMuted: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchDockBtnTextMuted: {
    color: colors.muted,
  },
  ownerDockContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  editDockBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radii.control,
  },
  editDockBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  dockBtnDisabled: {
    opacity: 0.6,
  },
  primaryDockBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  dockInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 8,
  },
  dockInfoText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
  },
  fullscreenHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  fullscreenCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  fullscreenImage: {
    width: "100%",
    height: "80%",
  },
});
