import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, radii, spacing } from "@/constants/theme";
import { getApiErrorMessage, staffService, type MobileImageFile, type WarehouseConversationMessage, type WarehouseIntakeConversationExtraction } from "@/services/api";
import { pickStaffImage } from "@/components/staff/staff-ui";

type AttachedImage = { file: MobileImageFile; uri: string };
type DisplayMessage = WarehouseConversationMessage & { images?: string[] };

const maxImages = 3;
const maxImageBytes = 5 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function WarehouseConversationAssistant({
  onExtraction,
  disabled = false,
}: {
  onExtraction: (result: WarehouseIntakeConversationExtraction) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<AttachedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectingImage, setSelectingImage] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const messageList = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (open) messageList.current?.scrollToEnd({ animated: true });
  }, [messages, busy, open]);

  const attachImage = async (source: "camera" | "library") => {
    if (disabled || busy || selectingImage || attachments.length >= maxImages) return;
    setError("");
    setSelectingImage(true);
    try {
      const selected = await pickStaffImage(source);
      if (!selected) return;
      const { file } = selected;
      const imageType = file.type || "image/jpeg";
      if (!allowedImageTypes.has(imageType)) {
        setError("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP.");
        return;
      }
      if (file.size !== undefined && file.size > maxImageBytes) {
        setError("Mỗi ảnh chat không được vượt quá 5 MB.");
        return;
      }
      setAttachments((current) => current.length < maxImages ? [...current, { file: { ...file, type: imageType }, uri: selected.uri }] : current);
    } catch (imageError) {
      setError(getApiErrorMessage(imageError));
    } finally {
      setSelectingImage(false);
    }
  };

  const sendMessage = async () => {
    const submittedAttachments = attachments;
    const content = draft.trim() || (submittedAttachments.length ? "Vui lòng kiểm tra ảnh vật phẩm và ghi nhận tình trạng bên ngoài." : "");
    if (!content || busy || disabled) return;
    if (content.length > 2000) {
      setError("Mỗi tin nhắn tối đa 2.000 ký tự.");
      return;
    }

    const submittedDraft = draft;
    const userMessage: DisplayMessage = {
      role: "user",
      content,
      ...(submittedAttachments.length ? { images: submittedAttachments.map((image) => image.uri) } : {}),
    };
    const nextMessages: DisplayMessage[] = [...messages, userMessage].slice(-19);
    while (nextMessages.length > 1 && nextMessages.reduce((total, message) => total + message.content.length, 0) > 12_000) nextMessages.shift();
    const requestMessages: WarehouseConversationMessage[] = nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent }));

    setMessages(nextMessages);
    setDraft("");
    setAttachments([]);
    setError("");
    setStatus("");
    setWarnings([]);
    setBusy(true);
    try {
      const result = await staffService.extractWalkInConversation(requestMessages, submittedAttachments.map((image) => image.file));
      const assistantMessage: DisplayMessage = { role: "assistant", content: result.assistantMessage };
      setMessages([...nextMessages, assistantMessage].slice(-20));
      setWarnings(result.warnings);
      setStatus("Đã phân tích xong. Gợi ý được điền vào các ô còn trống; hãy kiểm tra trước khi lưu hồ sơ.");
      onExtraction(result);
    } catch (requestError) {
      setMessages(messages);
      setDraft(submittedDraft);
      setAttachments(submittedAttachments);
      setError(`${getApiErrorMessage(requestError)} Thông tin biểu mẫu vẫn được giữ nguyên; bạn có thể thử lại hoặc nhập thủ công.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.heading, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <View style={styles.iconBox}><MaterialCommunityIcons name="robot-outline" size={19} color={colors.accent} /></View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Trợ lý AI tiếp nhận tại quầy</Text>
          <Text style={styles.subtitle}>Mô tả vật phẩm hoặc gửi ảnh để gợi ý thông tin</Text>
        </View>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.muted} />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <View style={styles.info}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.primary} />
            <Text style={styles.infoText}>AI chỉ đề xuất dữ liệu từ nội dung bạn gửi. Nhân viên cần kiểm tra vật phẩm thực tế và rà soát biểu mẫu trước khi tạo hồ sơ.</Text>
          </View>

          {messages.length ? (
            <ScrollView ref={messageList} nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.messageList} contentContainerStyle={styles.messageContent}>
              {messages.map((message, index) => (
                <View key={`${index}-${message.role}`} style={[styles.message, message.role === "user" ? styles.userMessage : styles.assistantMessage]}>
                  {message.role === "assistant" ? <Text style={styles.assistantLabel}>TRỢ LÝ AI</Text> : null}
                  <Text style={[styles.messageText, message.role === "user" && styles.userMessageText]}>{message.content}</Text>
                  {message.images?.length ? <View style={styles.imageList}>{message.images.map((uri, imageIndex) => <Image key={`${uri}-${imageIndex}`} source={{ uri }} style={styles.imagePreview} accessibilityLabel="Ảnh gửi cho trợ lý" />)}</View> : null}
                </View>
              ))}
              {busy ? <View style={[styles.message, styles.assistantMessage, styles.thinking]}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.subtitle}>Đang phân tích thông tin…</Text></View> : null}
            </ScrollView>
          ) : (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="message-text-outline" size={19} color={colors.primary} />
              <Text style={styles.emptyText}>Ví dụ: “Một balo đen có khóa kéo bị xước, người mang đến tên Minh.”</Text>
            </View>
          )}

          {attachments.length ? (
            <View style={styles.imageList}>
              {attachments.map((image, index) => (
                <View key={`${image.uri}-${index}`} style={styles.attachedImage}>
                  <Image source={{ uri: image.uri }} style={styles.imagePreview} accessibilityLabel="Ảnh đính kèm" />
                  <Pressable accessibilityRole="button" accessibilityLabel="Gỡ ảnh đính kèm" onPress={() => setAttachments((current) => current.filter((_, imageIndex) => imageIndex !== index))} style={styles.removeImage}>
                    <MaterialCommunityIcons name="close" size={14} color={colors.surface} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <TextInput
            accessibilityLabel="Tin nhắn cho trợ lý AI"
            value={draft}
            onChangeText={setDraft}
            placeholder="Mô tả vật phẩm hoặc tình trạng…"
            placeholderTextColor={colors.muted}
            maxLength={2000}
            multiline
            editable={!busy && !disabled}
            style={styles.input}
            textAlignVertical="top"
          />
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Chụp ảnh gửi trợ lý" disabled={disabled || busy || selectingImage || attachments.length >= maxImages} onPress={() => void attachImage("camera")} style={[styles.iconButton, (busy || disabled || attachments.length >= maxImages) && styles.disabled]}>
              {selectingImage ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialCommunityIcons name="camera-outline" size={19} color={colors.primary} />}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Chọn ảnh gửi trợ lý" disabled={disabled || busy || selectingImage || attachments.length >= maxImages} onPress={() => void attachImage("library")} style={[styles.iconButton, (busy || disabled || attachments.length >= maxImages) && styles.disabled]}>
              <MaterialCommunityIcons name="image-plus-outline" size={19} color={colors.primary} />
            </Pressable>
            <Text style={styles.imageCount}>{attachments.length}/{maxImages} ảnh</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Gửi cho trợ lý AI" disabled={disabled || busy || (!draft.trim() && attachments.length === 0)} onPress={() => void sendMessage()} style={({ pressed }) => [styles.sendButton, (disabled || busy || (!draft.trim() && attachments.length === 0)) && styles.sendDisabled, pressed && styles.pressed]}>
              {busy ? <ActivityIndicator size="small" color={colors.surface} /> : <><MaterialCommunityIcons name="send" size={16} color={colors.surface} /><Text style={styles.sendText}>Gửi</Text></>}
            </Pressable>
          </View>

          {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
          {status ? <Text style={styles.statusText}>{status}</Text> : null}
          {warnings.length ? <View style={styles.warningList}>{warnings.map((warning, index) => <Text key={`${index}-${warning}`} style={styles.warningText}>• {warning}</Text>)}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderColor: "#F2D4BC", borderRadius: radii.card, backgroundColor: colors.surface },
  heading: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBox: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.accentSoft },
  headingCopy: { flex: 1, gap: 3 },
  title: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  body: { gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: "#F2D4BC" },
  info: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.primarySoft },
  infoText: { flex: 1, color: colors.primaryDark, fontSize: 11, lineHeight: 16 },
  messageList: { maxHeight: 230 },
  messageContent: { gap: spacing.xs },
  message: { maxWidth: "92%", gap: 4, padding: spacing.sm, borderRadius: radii.control },
  userMessage: { alignSelf: "flex-end", backgroundColor: colors.primary },
  assistantMessage: { alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  assistantLabel: { color: colors.accent, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  messageText: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  userMessageText: { color: colors.surface },
  thinking: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  empty: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.surfaceMuted },
  emptyText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  imageList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  imagePreview: { width: 64, height: 64, borderRadius: radii.control, backgroundColor: colors.surfaceMuted },
  attachedImage: { position: "relative" },
  removeImage: { position: "absolute", top: -5, right: -5, width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.danger },
  input: { minHeight: 76, maxHeight: 130, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, color: colors.ink, fontSize: 13, lineHeight: 19, backgroundColor: colors.surface },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: colors.primarySoft },
  imageCount: { flex: 1, color: colors.muted, fontSize: 10 },
  sendButton: { minWidth: 74, height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: colors.primary },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: colors.surface, fontSize: 12, fontWeight: "800" },
  errorText: { color: colors.danger, fontSize: 11, lineHeight: 17 },
  statusText: { color: colors.success, fontSize: 11, lineHeight: 17 },
  warningList: { gap: 4, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.warningSoft },
  warningText: { color: colors.warning, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
