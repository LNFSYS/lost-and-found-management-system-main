import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, radii, spacing } from "@/constants/theme";
import { API_BASE_URL, loadMediaDataUri, type PostSummary } from "@/services/api";

const uriCache = new Map<string, string>();
const MAX_CACHE_SIZE = 80;

function setCachedUri(key: string, value: string) {
  if (uriCache.size >= MAX_CACHE_SIZE) {
    const oldest = uriCache.keys().next().value;
    if (oldest) uriCache.delete(oldest);
  }
  uriCache.set(key, value);
}

function isDirectUrl(url: string): boolean {
  if (url.startsWith("data:") || url.startsWith("file:") || url.startsWith("blob:")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    const base = new URL(API_BASE_URL);
    return parsed.origin !== base.origin;
  } catch {
    return false;
  }
}

export interface PostImageProps {
  post?: PostSummary;
  mediaUrl?: string | null;
  type?: "LOST" | "FOUND";
  visibilityMode?: "PUBLIC" | "PRIVATE_DETAILS";
  isAiGenerated?: boolean;
  aspectRatio?: number;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  showBadges?: boolean;
}

export function PostImage({
  post,
  mediaUrl,
  type,
  visibilityMode,
  isAiGenerated,
  aspectRatio = 16 / 9,
  height,
  borderRadius = radii.card,
  style,
  imageStyle,
  showBadges = true,
}: PostImageProps) {
  // Resolve media details from post if available
  const postItemMedia = post?.media?.find((m) => m.mediaKind === "ITEM" && !m.isAiGenerated) ??
    post?.media?.find((m) => m.mediaKind === "ITEM") ??
    post?.media?.[0];

  const resolvedUrl = mediaUrl !== undefined ? mediaUrl : postItemMedia?.url ?? null;
  const resolvedType = type ?? post?.type ?? "LOST";
  const resolvedVisibility = visibilityMode ?? post?.visibilityMode ?? "PUBLIC";
  const resolvedIsAi = isAiGenerated !== undefined ? isAiGenerated : Boolean(postItemMedia?.isAiGenerated);

  const initialCached = resolvedUrl ? uriCache.get(resolvedUrl) ?? null : null;
  const [sourceUri, setSourceUri] = useState<string | null>(initialCached);
  const [loading, setLoading] = useState<boolean>(!initialCached && Boolean(resolvedUrl));
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    const timer = setTimeout(() => {
      if (!resolvedUrl) {
        setSourceUri(null);
        setLoading(false);
        setError(false);
        return;
      }

      if (uriCache.has(resolvedUrl)) {
        setSourceUri(uriCache.get(resolvedUrl)!);
        setLoading(false);
        setError(false);
        return;
      }

      if (isDirectUrl(resolvedUrl)) {
        setCachedUri(resolvedUrl, resolvedUrl);
        setSourceUri(resolvedUrl);
        setLoading(false);
        setError(false);
        return;
      }

      setLoading(true);
      setError(false);

      loadMediaDataUri(resolvedUrl)
        .then((dataUri) => {
          if (!active) return;
          setCachedUri(resolvedUrl, dataUri);
          setSourceUri(dataUri);
        })
        .catch(() => {
          if (!active) return;
          setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [resolvedUrl]);

  const containerStyle: StyleProp<ViewStyle> = [
    styles.container,
    { borderRadius },
    height !== undefined ? { height } : { aspectRatio },
    style,
  ];

  const isLost = resolvedType === "LOST";

  return (
    <View style={containerStyle}>
      {sourceUri && !error ? (
        <Image
          source={{ uri: sourceUri }}
          contentFit="cover"
          transition={200}
          style={[styles.image, imageStyle]}
        />
      ) : (
        <View style={styles.placeholderContainer}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialCommunityIcons
              name="image-off-outline"
              size={36}
              color={colors.muted}
            />
          )}
          <Text style={styles.placeholderText}>
            {loading ? "Đang tải ảnh…" : error ? "Không thể tải ảnh" : "Không có hình ảnh"}
          </Text>
        </View>
      )}

      {showBadges ? (
        <View style={styles.overlayContainer} pointerEvents="none">
          {/* Top-Left: Post Type Badge */}
          <View
            style={[
              styles.typeBadge,
              isLost ? styles.lostBadge : styles.foundBadge,
            ]}
          >
            <MaterialCommunityIcons
              name={isLost ? "alert-circle-outline" : "check-circle-outline"}
              size={12}
              color="#FFFFFF"
              style={styles.badgeIcon}
            />
            <Text style={styles.typeBadgeText}>
              {isLost ? "BÁO MẤT" : "BÁO NHẶT"}
            </Text>
          </View>

          {/* Top-Right: Tags for Private & AI Generated */}
          <View style={styles.topRightTags}>
            {resolvedVisibility === "PRIVATE_DETAILS" ? (
              <View style={styles.privateBadge}>
                <MaterialCommunityIcons name="lock" size={12} color="#FFFFFF" />
                <Text style={styles.tagText}>Bảo mật</Text>
              </View>
            ) : null}

            {resolvedIsAi ? (
              <View style={styles.aiBadge}>
                <MaterialCommunityIcons name="auto-fix" size={12} color="#FFFFFF" />
                <Text style={styles.tagText}>Ảnh AI</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholderContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  placeholderText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    justifyContent: "space-between",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  lostBadge: {
    backgroundColor: colors.accent,
  },
  foundBadge: {
    backgroundColor: colors.success,
  },
  badgeIcon: {
    marginRight: 4,
  },
  typeBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  topRightTags: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
  },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(25, 49, 75, 0.82)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(11, 99, 182, 0.85)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  tagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});
