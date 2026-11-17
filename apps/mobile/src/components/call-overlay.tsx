import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { RTCView } from "react-native-webrtc";
import { colors, radii, spacing } from "@/constants/theme";
import type { CallState } from "@/hooks/use-webrtc-call";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
}

function endReasonText(reason: CallState["endReason"]) {
  switch (reason) {
    case "DECLINED": return "Cuộc gọi bị từ chối";
    case "BUSY": return "Đối phương đang bận";
    case "MISSED": return "Đối phương không trả lời";
    case "TIMEOUT": return "Cuộc gọi đã hết thời gian";
    case "DISCONNECTED": return "Mất kết nối";
    case "ERROR": return "Không thể kết nối cuộc gọi";
    default: return "Cuộc gọi đã kết thúc";
  }
}

function CallButton({
  icon,
  label,
  tone = "neutral",
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  tone?: "neutral" | "danger" | "success";
  onPress: () => void;
}) {
  const color = tone === "danger" ? colors.danger : tone === "success" ? colors.success : colors.ink;
  const backgroundColor = tone === "danger" ? colors.dangerSoft : tone === "success" ? colors.successSoft : colors.surfaceMuted;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.control, { backgroundColor }, pressed && styles.pressed]}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
      <Text style={[styles.controlLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function CallOverlay({
  state,
  peerName,
  onAccept,
  onDecline,
  onEnd,
  onToggleMic,
  onToggleCamera,
}: {
  state: CallState;
  peerName: string;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}) {
  const visible = state.status !== "IDLE";
  const name = peerName.trim() || "Người liên hệ";
  const callLabel = state.callType === "VIDEO" ? "Cuộc gọi video" : "Cuộc gọi thoại";
  const closeCall = state.status === "RINGING" ? onDecline : onEnd;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={closeCall}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <View style={styles.liveDot} />
              <Text style={styles.headerTitle}>
                {state.status === "CALLING" ? "Đang gọi…" : state.status === "RINGING" ? "Cuộc gọi đến" : state.status === "ENDED" ? "Đã kết thúc" : callLabel}
              </Text>
            </View>
            {state.status === "CONNECTED" ? <Text style={styles.duration}>{formatDuration(state.duration)}</Text> : null}
          </View>

          {state.error ? <View style={styles.error}><MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.errorText}>{state.error}</Text></View> : null}

          {state.status === "CALLING" && state.callType === "VIDEO" && state.localStream ? (
            <View style={styles.videoPreview}>
              <RTCView streamURL={state.localStream.toURL()} style={styles.fullVideo} objectFit="cover" mirror />
              <Text style={styles.videoCaption}>Camera của bạn · đang gọi {name}</Text>
            </View>
          ) : null}

          {state.status === "CONNECTED" && state.callType === "VIDEO" ? (
            <View style={styles.videoStage}>
              {state.remoteStream && !state.isRemoteCameraOff ? (
                <RTCView streamURL={state.remoteStream.toURL()} style={styles.fullVideo} objectFit="cover" />
              ) : (
                <View style={styles.videoPlaceholder}><View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View><Text style={styles.statusCopy}>{name} đang tắt camera</Text></View>
              )}
              {state.localStream ? (
                <View style={styles.localVideoFrame}>
                  {state.isCameraOff ? <View style={styles.localVideoOff}><MaterialCommunityIcons name="video-off-outline" size={22} color={colors.surface} /><Text style={styles.localVideoLabel}>Camera tắt</Text></View> : <RTCView streamURL={state.localStream.toURL()} style={styles.localVideo} objectFit="cover" mirror />}
                  <Text style={styles.youLabel}>Bạn</Text>
                </View>
              ) : null}
              {state.isRemoteMicMuted ? <View style={styles.remoteMuted}><MaterialCommunityIcons name="microphone-off" size={15} color={colors.surface} /><Text style={styles.remoteMutedText}>{name} đã tắt micro</Text></View> : null}
            </View>
          ) : null}

          {(state.status === "CALLING" && state.callType === "VOICE") || state.status === "RINGING" || (state.status === "CONNECTED" && state.callType === "VOICE") || state.status === "ENDED" ? (
            <View style={styles.voiceStage}>
              <View style={[styles.avatar, state.status === "RINGING" && styles.incomingAvatar]}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
              <Text style={styles.peerName}>{name}</Text>
              <Text style={styles.statusCopy}>
                {state.status === "CALLING" ? "Đang đổ chuông, vui lòng chờ máy…"
                  : state.status === "RINGING" ? `${name} đang gọi thoại cho bạn.`
                    : state.status === "ENDED" ? endReasonText(state.endReason)
                      : state.isRemoteMicMuted ? "Đối phương đã tắt micro" : "Đang trò chuyện"}
              </Text>
              {state.status === "ENDED" && state.duration > 0 ? <Text style={styles.statusCopy}>Thời lượng: {formatDuration(state.duration)}</Text> : null}
            </View>
          ) : null}

          <View style={styles.footer}>
            {state.status === "RINGING" ? (
              <>
                <CallButton icon="phone-hangup" label="Từ chối" tone="danger" onPress={onDecline} />
                <CallButton icon="phone" label="Trả lời" tone="success" onPress={onAccept} />
              </>
            ) : state.status === "CALLING" ? (
              <CallButton icon="phone-hangup" label="Hủy cuộc gọi" tone="danger" onPress={onEnd} />
            ) : state.status === "CONNECTED" ? (
              <>
                <CallButton icon={state.isMicMuted ? "microphone-off" : "microphone"} label={state.isMicMuted ? "Bật micro" : "Tắt micro"} onPress={onToggleMic} />
                <CallButton icon="phone-hangup" label="Kết thúc" tone="danger" onPress={onEnd} />
                {state.callType === "VIDEO" ? <CallButton icon={state.isCameraOff ? "video-off-outline" : "video-outline"} label={state.isCameraOff ? "Bật camera" : "Tắt camera"} onPress={onToggleCamera} /> : null}
              </>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: spacing.md, backgroundColor: "rgba(13, 31, 48, 0.82)" },
  sheet: { width: "100%", maxWidth: 520, minHeight: 420, alignSelf: "center", justifyContent: "space-between", overflow: "hidden", borderRadius: 26, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 34 },
  headerCopy: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  headerTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  duration: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  error: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17 },
  voiceStage: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", gap: spacing.md },
  avatar: { width: 116, height: 116, alignItems: "center", justifyContent: "center", borderRadius: 58, backgroundColor: colors.primarySoft, borderWidth: 3, borderColor: colors.accentSoft },
  incomingAvatar: { backgroundColor: colors.successSoft, borderColor: colors.successSoft },
  avatarText: { color: colors.primaryDark, fontSize: 45, fontWeight: "900" },
  peerName: { color: colors.ink, fontSize: 21, fontWeight: "900", textAlign: "center" },
  statusCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  videoPreview: { flex: 1, minHeight: 310, overflow: "hidden", borderRadius: radii.card, backgroundColor: "#10253A" },
  videoStage: { flex: 1, minHeight: 310, overflow: "hidden", borderRadius: radii.card, backgroundColor: "#10253A" },
  fullVideo: { ...StyleSheet.absoluteFill, backgroundColor: "#10253A" },
  videoCaption: { position: "absolute", bottom: spacing.md, left: spacing.md, right: spacing.md, color: colors.surface, fontSize: 13, fontWeight: "800" },
  videoPlaceholder: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  localVideoFrame: { position: "absolute", top: spacing.md, right: spacing.md, width: 108, height: 150, overflow: "hidden", borderRadius: radii.control, backgroundColor: colors.ink, borderWidth: 1, borderColor: "rgba(255,255,255,0.7)" },
  localVideo: { ...StyleSheet.absoluteFill },
  localVideoOff: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: spacing.xs, backgroundColor: colors.primaryDark },
  localVideoLabel: { color: colors.surface, fontSize: 10, fontWeight: "700" },
  youLabel: { position: "absolute", left: spacing.xs, bottom: spacing.xs, color: colors.surface, fontSize: 10, fontWeight: "800" },
  remoteMuted: { position: "absolute", left: spacing.sm, bottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: "rgba(10,25,40,0.75)" },
  remoteMutedText: { color: colors.surface, fontSize: 10, fontWeight: "700" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: spacing.md, paddingTop: spacing.sm },
  control: { minWidth: 88, minHeight: 72, alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: spacing.sm, borderRadius: radii.card },
  controlLabel: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
