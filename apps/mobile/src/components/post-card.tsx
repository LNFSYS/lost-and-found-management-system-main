import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, radii, spacing } from "@/constants/theme";
import { postService, type PostSummary } from "@/services/api";
import { PostImage } from "./post-image";

export interface PostCardProps {
  post: PostSummary;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function formatPostLocation(post: PostSummary): string {
  const parts = [
    post.location?.building?.name,
    post.location?.roomText,
    post.location?.area?.name,
    post.location?.customLocation,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" · ");
  }
  return post.handoverPoint?.name || "Chưa công khai vị trí";
}

export function formatIncidentTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Chưa rõ thời gian";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Chưa rõ thời gian";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${hh}:${mm} ${dd}/${MM}/${yyyy}`;
  } catch {
    return "Chưa rõ thời gian";
  }
}

export function getPosterInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PostCard({ post, onPress, style }: PostCardProps) {
  const [chatLoading, setChatLoading] = useState(false);

  const handleCardPress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/posts/${post.id}` as any);
    }
  };

  const handleClaimChat = async () => {
    if (chatLoading) return;
    setChatLoading(true);
    try {
      const existing = await postService.findConversationByPost(post.id);
      if (existing) {
        router.push(`/claims/${existing.id}` as any);
        return;
      }
    } catch {
      // Fallback to composer
    } finally {
      setChatLoading(false);
    }
    router.push(`/claims?composePostId=${encodeURIComponent(post.id)}` as any);
  };

  const canClaim = !post.canEdit && ["OPEN", "MATCHED"].includes(post.status);
  const hasMatchSummary =
    post.canEdit &&
    post.matchSummary &&
    post.matchSummary.suggestionCount > 0;

  const matchTopScoreFormatted =
    post.matchSummary?.topScore !== null && post.matchSummary?.topScore !== undefined
      ? `${Math.round(
          post.matchSummary.topScore <= 1
            ? post.matchSummary.topScore * 100
            : post.matchSummary.topScore
        )}%`
      : null;

  return (
    <Pressable
      onPress={handleCardPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Bài đăng: ${post.title}`}
    >
      {/* Thumbnail with overlay badges */}
      <PostImage
        post={post}
        aspectRatio={16 / 9}
        borderRadius={0}
        style={styles.imageHeader}
      />

      {/* Card Body */}
      <View style={styles.body}>
        {/* Title and Category */}
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2}>
            {post.title}
          </Text>
          {post.category?.name ? (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText} numberOfLines={1}>
                {post.category.name}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Fact metadata: Campus Location & Incident Time */}
        <View style={styles.facts}>
          <View style={styles.factItem}>
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={15}
              color={colors.primary}
              style={styles.factIcon}
            />
            <Text style={styles.factText} numberOfLines={1}>
              {formatPostLocation(post)}
            </Text>
          </View>

          <View style={styles.factItem}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={15}
              color={colors.muted}
              style={styles.factIcon}
            />
            <Text style={styles.factText} numberOfLines={1}>
              {formatIncidentTime(post.lostFoundAt || post.createdAt)}
            </Text>
          </View>
        </View>

        {/* Short description */}
        <Text style={styles.description} numberOfLines={2}>
          {post.description?.trim() ||
            "Chi tiết nhận dạng được giữ riêng để hỗ trợ xác minh quyền sở hữu."}
        </Text>

        {/* Match Summary Highlight Pill (if owner and has suggestions) */}
        {hasMatchSummary ? (
          <Pressable
            onPress={handleCardPress}
            style={styles.matchPill}
            accessibilityRole="button"
          >
            <View style={styles.matchPillLeft}>
              <View style={styles.matchIconWrap}>
                <MaterialCommunityIcons
                  name="radar"
                  size={16}
                  color={colors.primary}
                />
              </View>
              <View style={styles.matchTextWrap}>
                <Text style={styles.matchTitle}>
                  {post.matchSummary!.suggestionCount} gợi ý ghép đôi khả thi
                </Text>
                {matchTopScoreFormatted ? (
                  <Text style={styles.matchScore}>
                    Điểm cao nhất: {matchTopScoreFormatted}
                  </Text>
                ) : null}
              </View>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={colors.primary}
            />
          </Pressable>
        ) : null}

        {/* Action bar: Quick Claim/Chat if eligible */}
        {canClaim ? (
          <Pressable
            onPress={handleClaimChat}
            disabled={chatLoading}
            style={({ pressed }) => [
              styles.claimChatButton,
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
          >
            {chatLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="message-text-outline"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.claimChatText}>
                  Nhắn tin với người đăng
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Footer: Poster Info & Detail Link */}
        <View style={styles.footer}>
          <View style={styles.ownerWrap}>
            <View style={styles.avatar}>
              {post.visibilityMode === "PRIVATE_DETAILS" ? (
                <MaterialCommunityIcons
                  name="incognito"
                  size={16}
                  color={colors.primaryDark}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {getPosterInitials(post.owner?.fullName)}
                </Text>
              )}
            </View>
            <Text style={styles.ownerName} numberOfLines={1}>
              {post.owner?.fullName || "Ẩn danh"}
            </Text>
            {post.visibilityMode === "PRIVATE_DETAILS" ? (
              <View style={styles.privacyBadge}>
                <MaterialCommunityIcons
                  name="shield-lock-outline"
                  size={12}
                  color={colors.muted}
                />
                <Text style={styles.privacyText}>Ẩn danh</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.detailLink}>
            <Text style={styles.detailLinkText}>Xem chi tiết</Text>
            <MaterialCommunityIcons
              name="arrow-right"
              size={14}
              color={colors.primary}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  imageHeader: {
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  categoryChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(11, 99, 182, 0.15)",
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  facts: {
    gap: 4,
  },
  factItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  factIcon: {
    marginRight: 6,
  },
  factText: {
    flex: 1,
    fontSize: 13,
    color: colors.muted,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  matchPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(243, 111, 33, 0.25)",
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginTop: 2,
  },
  matchPillLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  matchIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  matchTextWrap: {
    flex: 1,
  },
  matchTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9A4B13",
  },
  matchScore: {
    fontSize: 11,
    fontWeight: "600",
    color: "#BA5D1B",
  },
  claimChatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    borderRadius: radii.control,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: 2,
  },
  claimChatText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ownerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  ownerName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    flexShrink: 1,
  },
  privacyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  privacyText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.muted,
  },
  detailLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  detailLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
});
