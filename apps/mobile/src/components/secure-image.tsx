import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View, type ImageResizeMode, type ImageStyle, type StyleProp } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors } from "@/constants/theme";
import { loadMediaDataUri } from "@/services/api";

const mediaCache = new Map<string, string>();
const MAX_CACHE_SIZE = 80;

function setCachedMedia(key: string, value: string) {
  if (mediaCache.size >= MAX_CACHE_SIZE) {
    const oldest = mediaCache.keys().next().value;
    if (oldest) mediaCache.delete(oldest);
  }
  mediaCache.set(key, value);
}

interface SecureImageProps {
  url: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  accessibilityLabel?: string;
  fallbackIcon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
}

export function SecureImage({
  url,
  style,
  resizeMode = "cover",
  accessibilityLabel,
  fallbackIcon = "image-off-outline",
}: SecureImageProps) {
  const cachedUri = url ? mediaCache.get(url) ?? null : null;
  const [dataUri, setDataUri] = useState<string | null>(cachedUri);
  const [loading, setLoading] = useState<boolean>(Boolean(url && !cachedUri));
  const [hasError, setHasError] = useState(!url);

  useEffect(() => {
    if (!url) return;

    const cached = mediaCache.get(url);
    if (cached) {
      return;
    }

    let active = true;

    loadMediaDataUri(url)
      .then((uri) => {
        setCachedMedia(url, uri);
        if (active) {
          setDataUri(uri);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setHasError(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  if (loading) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (hasError || !dataUri) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        <MaterialCommunityIcons name={fallbackIcon} size={28} color={colors.muted} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: dataUri }}
      style={style}
      resizeMode={resizeMode}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
});
