import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { SecureImage } from "@/components/secure-image";
import { StaffNavigation, WarehouseStatusPill, pickStaffImage, staffDateTime } from "@/components/staff/staff-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import { getApiErrorMessage, staffService, type StaffClaimReview, type StaffWarehouseImage, type StaffWarehouseItem, type StaffWarehouseStorageLog, type StaffReturnWarehousePayload, type WarehouseItemStatus } from "@/services/api";

type ProofImage = { id: string; uri: string };

const provenanceLabels: Record<StaffWarehouseImage["provenance"], string> = { SOURCE_POST: "Ảnh bài đăng", CONTACT_PHOTO: "Ảnh đối chiếu", INTAKE: "Ảnh nhập kho", RETURN: "Ảnh bàn giao" };
const actionLabels: Record<string, string> = { RECEIVED: "Tiếp nhận", STORED: "Đưa vào lưu kho", CLAIMED: "Giữ cho người nhận", RETURNED: "Đã trả đồ", EXPIRED: "Đánh dấu quá hạn", OVERDUE_MARKED: "Ghi nhận quá hạn", CONDITION_UPDATED: "Cập nhật hồ sơ", DISPOSED: "Đã xử lý", DONATED: "Đã quyên góp", TRANSFERRED: "Đã chuyển giao" };

export default function WarehouseItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const [item, setItem] = useState<StaffWarehouseItem | null>(null);
  const [images, setImages] = useState<StaffWarehouseImage[]>([]);
  const [logs, setLogs] = useState<StaffWarehouseStorageLog[]>([]);
  const [claimReviews, setClaimReviews] = useState<StaffClaimReview[]>([]);
  const [recipients, setRecipients] = useState<{ claimId: string; recipientId: string; fullName: string }[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [statusDraft, setStatusDraft] = useState<WarehouseItemStatus | "">("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [storageCode, setStorageCode] = useState("");
  const [updateNote, setUpdateNote] = useState("");
  const [claimReason, setClaimReason] = useState("");
  const [claimChecked, setClaimChecked] = useState(false);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverIdentity, setReceiverIdentity] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [proofs, setProofs] = useState<ProofImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!itemId) return;
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      const found = await staffService.getWarehouseItem(itemId);
      setItem(found);
      setStatusDraft(found.status);
      setConditionNotes(found.conditionNotes ?? "");
      setStorageCode(found.storageCode ?? "");
      const [imageResult, logResult, reviewResult, recipientResult] = await Promise.allSettled([
        staffService.getWarehouseImages(found.id), staffService.listWarehouseLogs(found.id),
        staffService.getReturnClaimReviews(found.id), staffService.getReturnRecipients(found.id),
      ]);
      setImages(imageResult.status === "fulfilled" ? imageResult.value : []);
      setLogs(logResult.status === "fulfilled" ? logResult.value : []);
      setClaimReviews(reviewResult.status === "fulfilled" ? reviewResult.value : []);
      setRecipients(recipientResult.status === "fulfilled" ? recipientResult.value : []);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [itemId]);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);

  const eligibleStatuses = useMemo(() => {
    if (!item) return [] as WarehouseItemStatus[];
    const transitions: Partial<Record<WarehouseItemStatus, WarehouseItemStatus[]>> = {
      RECEIVED: ["RECEIVED", "STORED", "EXPIRED"],
      STORED: ["STORED", "EXPIRED"],
      PENDING_APPROVAL: ["PENDING_APPROVAL", "RECEIVED"],
      CLAIMED: ["CLAIMED"],
      EXPIRED: ["EXPIRED"],
      RETURNED: ["RETURNED"], DISPOSED: ["DISPOSED"], DONATED: ["DONATED"], TRANSFERRED: ["TRANSFERRED"],
    };
    return transitions[item.status] ?? [item.status];
  }, [item]);

  const saveChanges = async () => {
    if (!item || busy) return;
    if (statusDraft === "STORED" && !storageCode.trim()) { setError("Nhập mã vị trí lưu kho trước khi chuyển trạng thái sang Đang lưu kho."); return; }
    setBusy(true);
    setError(null);
    try {
      await staffService.updateWarehouseItem(item.id, {
        status: statusDraft || undefined,
        conditionNotes: conditionNotes.trim() || null,
        storageCode: storageCode.trim() || null,
        note: updateNote.trim() || undefined,
      });
      setUpdateNote("");
      await load(true);
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      setBusy(false);
    }
  };

  const verifyClaim = async (review: StaffClaimReview) => {
    if (!item || !claimChecked || claimReason.trim().length < 10 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await staffService.verifyWarehouseClaim(item.id, { claimId: review.claimId, recipientId: review.recipientId, verified: true, reason: claimReason.trim() });
      setClaimReviews(updated);
      setSelectedClaimId(review.claimId);
      setClaimChecked(false);
      setClaimReason("");
    } catch (verifyError) {
      setError(getApiErrorMessage(verifyError));
    } finally {
      setBusy(false);
    }
  };

  const uploadProof = async (source: "camera" | "library") => {
    if (!item || proofs.length >= 5 || uploadingProof) return;
    setError(null);
    try {
      const selected = await pickStaffImage(source);
      if (!selected) return;
      setUploadingProof(true);
      const saved = await staffService.uploadWarehouseProof(selected.file, item.id);
      setProofs((current) => [...current, { id: saved.id, uri: selected.uri }]);
    } catch (proofError) {
      setError(getApiErrorMessage(proofError));
    } finally {
      setUploadingProof(false);
    }
  };

  const submitReturn = async () => {
    if (!item || busy) return;
    const name = receiverName.trim();
    const phone = receiverPhone.trim();
    const identity = receiverIdentity.trim();
    if (name.length < 2 || name.length > 150) { setError("Họ tên người nhận cần từ 2 đến 150 ký tự."); return; }
    if (phone.length < 9 || phone.length > 20) { setError("Số điện thoại cần từ 9 đến 20 ký tự."); return; }
    if (identity.length < 3 || identity.length > 100) { setError("Mã thẻ hoặc giấy tờ cần từ 3 đến 100 ký tự."); return; }
    if (!proofs.length) { setError("Tải lên ít nhất một ảnh biên bản hoặc bằng chứng bàn giao."); return; }
    const selectedRecipient = recipients.find((recipient) => recipient.claimId === selectedClaimId);
    if (item.status === "CLAIMED" && !selectedRecipient) { setError("Vật phẩm đang được giữ cho một yêu cầu nhận lại; hãy chọn đúng người đã được xác minh."); return; }
    if (selectedRecipient && !claimReviews.some((review) => review.claimId === selectedRecipient.claimId && review.verified)) { setError("Xác minh người nhận tại quầy trước khi hoàn tất trả đồ."); return; }
    setBusy(true);
    setError(null);
    try {
      const payload: StaffReturnWarehousePayload = {
        receiverName: name,
        receiverPhone: phone,
        receiverIdentity: identity,
        proofImage: proofs.map((proof) => proof.id).join("\n"),
        note: returnNote.trim() || null,
        ...(selectedRecipient ? { claimId: selectedRecipient.claimId, recipientId: selectedRecipient.recipientId } : {}),
      };
      await staffService.returnWarehouseItem(item.id, payload);
      await load(true);
      setReceiverName(""); setReceiverPhone(""); setReceiverIdentity(""); setReturnNote(""); setProofs([]);
    } catch (returnError) {
      setError(getApiErrorMessage(returnError));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><StaffNavigation active="warehouse" /><LoadingSpinner label="Đang tải hồ sơ vật phẩm…" /></SafeAreaView>;
  if (!item) return <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}><StaffNavigation active="warehouse" /><View style={styles.missing}><ErrorBanner message={error ?? "Không tìm thấy vật phẩm."} onRetry={() => void load(true)} /><Button title="Quay lại kho" variant="secondary" onPress={() => router.replace("/staff/warehouse" as never)} /></View></SafeAreaView>;

  const canReturn = ["RECEIVED", "STORED", "CLAIMED", "EXPIRED"].includes(item.status);
  const selectedReview = claimReviews.find((review) => review.claimId === selectedClaimId);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StaffNavigation active="warehouse" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}><Pressable accessibilityRole="button" accessibilityLabel="Quay lại kho vật phẩm" onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={21} color={colors.primary} /></Pressable><View style={styles.headingCopy}><Text style={styles.eyebrow}>HỒ SƠ KHO</Text><Text accessibilityRole="header" style={styles.title}>{item.itemName}</Text></View><WarehouseStatusPill status={item.status} compact /></View>
        {error ? <ErrorBanner message={error} /> : null}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryGrid}><View style={styles.summaryCell}><Text style={styles.label}>Mã vị trí</Text><Text style={styles.value}>{item.storageCode || "Chưa gán"}</Text></View><View style={styles.summaryCell}><Text style={styles.label}>Điểm bàn giao</Text><Text numberOfLines={2} style={styles.value}>{item.handoverPoint?.name || "Chưa rõ"}</Text></View><View style={styles.summaryCell}><Text style={styles.label}>Ngày tiếp nhận</Text><Text style={styles.value}>{staffDateTime(item.receivedAt, false)}</Text></View><View style={styles.summaryCell}><Text style={styles.label}>Hạn lưu giữ</Text><Text style={[styles.value, item.status === "EXPIRED" ? styles.dangerText : null]}>{staffDateTime(item.retentionDeadline, false)}</Text></View></View>
          <View style={styles.summaryDivider} /><Text style={styles.label}>Người gửi</Text><Text style={styles.value}>{item.finder.name || item.finder.userName || "Chưa ghi nhận"}</Text>
          {item.description ? <View><Text style={styles.label}>Mô tả</Text><Text style={styles.description}>{item.description}</Text></View> : null}
          {item.receivedQuantity != null ? <View style={styles.summaryGrid}><View style={styles.summaryCell}><Text style={styles.label}>Số lượng</Text><Text style={styles.value}>{item.receivedQuantity}</Text></View><View style={styles.summaryCell}><Text style={styles.label}>Phụ kiện</Text><Text style={styles.value}>{item.accessories || "Chưa ghi nhận"}</Text></View></View> : null}
          {item.conditionNotes ? <View style={styles.conditionBox}><Text style={styles.label}>Tình trạng</Text><Text style={styles.description}>{item.conditionNotes}</Text></View> : null}
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}><View style={styles.sectionCopy}><Text style={styles.sectionTitle}>Bộ sưu tập ảnh kho</Text><Text style={styles.sectionSubtitle}>Ảnh nguồn, lúc nhập kho và lúc bàn giao.</Text></View><Text style={styles.imageCount}>{images.length}</Text></View>
          {images.length ? <View style={styles.imageGrid}>{images.map((image) => <View key={image.id} style={styles.imageTile}><SecureImage url={staffService.warehouseImagePath(image)} style={styles.warehouseImage} accessibilityLabel={provenanceLabels[image.provenance]} /><Text style={styles.imageLabel}>{provenanceLabels[image.provenance]}</Text><Text style={styles.imageDate}>{staffDateTime(image.uploadedAt, false)}</Text></View>)}</View> : <Text style={styles.emptyText}>Chưa có ảnh lưu trong hồ sơ.</Text>}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Cập nhật hồ sơ</Text><Text style={styles.sectionSubtitle}>Các trạng thái kết thúc phải đi qua quy trình xác minh riêng.</Text>
          <Text style={styles.fieldLabel}>Trạng thái</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusOptions}>{eligibleStatuses.map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: statusDraft === value }} onPress={() => setStatusDraft(value)} style={[styles.statusOption, statusDraft === value && styles.statusOptionSelected]}><WarehouseStatusPill status={value} compact /></Pressable>)}</ScrollView>
          <Input label="Mã vị trí kệ" value={storageCode} onChangeText={setStorageCode} maxLength={60} placeholder="Ví dụ: WH-A1-02" />
          <Input label="Tình trạng / ghi chú kỹ thuật" value={conditionNotes} onChangeText={setConditionNotes} multiline maxLength={2000} placeholder="Cập nhật tình trạng quan sát được…" />
          <Input label="Ghi chú nhật ký (không bắt buộc)" value={updateNote} onChangeText={setUpdateNote} multiline maxLength={1000} placeholder="Lý do di chuyển hoặc cập nhật…" />
          <Button title="Lưu thay đổi" onPress={() => void saveChanges()} loading={busy} />
        </Card>

        {claimReviews.length ? <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}><View style={styles.sectionCopy}><Text style={styles.sectionTitle}>Xác minh yêu cầu nhận đồ</Text><Text style={styles.sectionSubtitle}>Đối chiếu quyền nhận tại quầy và ghi lý do xác minh.</Text></View><MaterialCommunityIcons name="account-check-outline" size={21} color={colors.primary} /></View>
          <View style={styles.claimList}>{claimReviews.map((review) => <Pressable key={review.claimId} accessibilityRole="radio" accessibilityState={{ selected: selectedClaimId === review.claimId }} onPress={() => setSelectedClaimId(review.claimId)} style={[styles.claimRow, selectedClaimId === review.claimId && styles.claimRowSelected]}><MaterialCommunityIcons name={review.verified ? "check-decagram-outline" : selectedClaimId === review.claimId ? "radiobox-marked" : "radiobox-blank"} size={19} color={review.verified ? colors.success : colors.primary} /><View style={styles.sectionCopy}><Text style={styles.claimName}>{review.fullName}</Text><Text style={styles.sectionSubtitle}>{review.description || review.status}</Text></View><Text style={[styles.verifyState, { color: review.verified ? colors.success : colors.warning }]}>{review.verified ? "Đã xác minh" : "Chờ đối chiếu"}</Text></Pressable>)}</View>
          {selectedReview && !selectedReview.verified ? <><Input label="Lý do / điểm đã đối chiếu (tối thiểu 10 ký tự)" value={claimReason} onChangeText={setClaimReason} multiline maxLength={1000} placeholder="Ghi dấu hiệu nhận diện đã đối chiếu với người nhận…" /><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: claimChecked }} onPress={() => setClaimChecked((value) => !value)} style={styles.confirmRow}><MaterialCommunityIcons name={claimChecked ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={claimChecked ? colors.success : colors.muted} /><Text style={styles.confirmText}>Tôi đã trực tiếp đối chiếu quyền nhận tại quầy.</Text></Pressable><Button title="Xác nhận người nhận" onPress={() => void verifyClaim(selectedReview)} loading={busy} disabled={!claimChecked || claimReason.trim().length < 10} /></> : null}
        </Card> : null}

        {canReturn ? <Card style={styles.returnCard}>
          <View style={styles.sectionHeader}><View style={styles.returnIcon}><MaterialCommunityIcons name="package-variant-closed-check" size={21} color={colors.success} /></View><View style={styles.sectionCopy}><Text style={styles.sectionTitle}>Ghi nhận trả đồ</Text><Text style={styles.sectionSubtitle}>Thông tin chỉ dùng để xác nhận người nhận và bằng chứng bàn giao.</Text></View></View>
          {recipients.length ? <><Text style={styles.fieldLabel}>Người nhận đã được xác minh</Text><View style={styles.claimList}>{recipients.map((recipient) => { const verified = claimReviews.some((review) => review.claimId === recipient.claimId && review.verified); return <Pressable key={recipient.claimId} accessibilityRole="radio" accessibilityState={{ selected: selectedClaimId === recipient.claimId }} onPress={() => setSelectedClaimId(recipient.claimId)} style={[styles.claimRow, selectedClaimId === recipient.claimId && styles.claimRowSelected]}><MaterialCommunityIcons name={selectedClaimId === recipient.claimId ? "radiobox-marked" : "radiobox-blank"} size={19} color={selectedClaimId === recipient.claimId ? colors.primary : colors.muted} /><View style={styles.sectionCopy}><Text style={styles.claimName}>{recipient.fullName}</Text><Text style={styles.sectionSubtitle}>{verified ? "Đã xác minh tại quầy" : "Cần xác minh ở mục phía trên"}</Text></View></Pressable>; })}</View></> : <Text style={styles.sectionSubtitle}>Không có người nhận gắn với vật phẩm này. Ghi lại thông tin người đến nhận tại quầy.</Text>}
          <Input label="Họ và tên người nhận" value={receiverName} onChangeText={setReceiverName} maxLength={150} placeholder="2–150 ký tự" />
          <Input label="Số điện thoại liên hệ" value={receiverPhone} onChangeText={setReceiverPhone} keyboardType="phone-pad" maxLength={20} placeholder="9–20 ký tự" />
          <Input label="Mã thẻ SV / CMND / CCCD" value={receiverIdentity} onChangeText={setReceiverIdentity} maxLength={100} placeholder="3–100 ký tự" />
          <Input label="Ghi chú trao trả (không bắt buộc)" value={returnNote} onChangeText={setReturnNote} multiline maxLength={1000} placeholder="Ghi nhận tình trạng hoặc thỏa thuận khi bàn giao…" />
          <View style={styles.photoActions}><Button title="Chụp biên bản" variant="secondary" onPress={() => void uploadProof("camera")} loading={uploadingProof} disabled={proofs.length >= 5 || busy} style={styles.actionButton} /><Button title="Chọn ảnh bằng chứng" variant="secondary" onPress={() => void uploadProof("library")} loading={uploadingProof} disabled={proofs.length >= 5 || busy} style={styles.actionButton} /></View>
          {proofs.length ? <View style={styles.proofList}>{proofs.map((proof) => <Image key={proof.id} source={{ uri: proof.uri }} style={styles.proofImage} accessibilityLabel="Ảnh biên bản bàn giao" />)}</View> : <Text style={styles.sectionSubtitle}>Cần từ 1 đến 5 ảnh bằng chứng riêng tư.</Text>}
          <Button title="Xác nhận đã trả đồ" onPress={() => void submitReturn()} loading={busy} disabled={!receiverName.trim() || !receiverPhone.trim() || !receiverIdentity.trim() || proofs.length === 0 || (item.status === "CLAIMED" && !recipients.some((recipient) => recipient.claimId === selectedClaimId))} />
        </Card> : null}

        <Card style={styles.sectionCard}><View style={styles.sectionHeader}><View style={styles.sectionCopy}><Text style={styles.sectionTitle}>Nhật ký vật phẩm</Text><Text style={styles.sectionSubtitle}>{logs.length} sự kiện lưu kho · hiển thị mới nhất trước.</Text></View><Pressable accessibilityRole="button" onPress={() => router.push(`/staff/logs?itemId=${item.id}` as never)} style={styles.logLink}><MaterialCommunityIcons name="history" size={19} color={colors.primary} /></Pressable></View>
          {logs.length ? logs.slice(0, 5).map((log) => <View key={log.id} style={styles.logRow}><View style={styles.logIcon}><MaterialCommunityIcons name="swap-horizontal" size={16} color={colors.primary} /></View><View style={styles.sectionCopy}><Text style={styles.logTitle}>{actionLabels[log.action] ?? log.action.replaceAll("_", " ")}</Text><Text style={styles.sectionSubtitle}>{log.actor.fullName || "Nhân viên"} · {staffDateTime(log.createdAt)}</Text>{log.note ? <Text style={styles.logNote}>{log.note}</Text> : null}</View></View>) : <Text style={styles.emptyText}>Chưa có sự kiện nhật ký.</Text>}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl }, headingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, backButton: { width: 42, height: 44, alignItems: "center", justifyContent: "center" }, headingCopy: { flex: 1, gap: 3 }, eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }, title: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: "900" },
  summaryCard: { gap: spacing.md }, summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md }, summaryCell: { flex: 1, minWidth: "42%", gap: 4 }, label: { color: colors.muted, fontSize: 10 }, value: { color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: "800" }, dangerText: { color: colors.danger }, summaryDivider: { height: 1, backgroundColor: colors.border }, description: { color: colors.ink, fontSize: 12, lineHeight: 18 }, conditionBox: { padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.surfaceMuted, gap: 4 },
  sectionCard: { gap: spacing.md }, sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, sectionCopy: { flex: 1, gap: 3 }, sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" }, sectionSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 16 }, imageCount: { minWidth: 29, height: 29, textAlign: "center", textAlignVertical: "center", borderRadius: radii.pill, backgroundColor: colors.primarySoft, color: colors.primary, fontSize: 11, fontWeight: "900" }, imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, imageTile: { width: "48%", gap: 4 }, warehouseImage: { width: "100%", height: 118, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, imageLabel: { color: colors.ink, fontSize: 10, fontWeight: "800" }, imageDate: { color: colors.muted, fontSize: 9 }, emptyText: { color: colors.muted, fontSize: 12 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" }, statusOptions: { gap: spacing.xs, paddingRight: spacing.md }, statusOption: { minHeight: 36, justifyContent: "center", padding: 4, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border }, statusOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, claimList: { gap: spacing.xs }, claimRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border }, claimRowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, claimName: { color: colors.ink, fontSize: 12, fontWeight: "800" }, verifyState: { fontSize: 9, fontWeight: "900" }, confirmRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.successSoft }, confirmText: { flex: 1, color: colors.ink, fontSize: 11, lineHeight: 17, fontWeight: "700" },
  returnCard: { gap: spacing.md, borderColor: "#CFE9D8" }, returnIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.successSoft }, photoActions: { flexDirection: "row", gap: spacing.sm }, actionButton: { flex: 1 }, proofList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, proofImage: { width: 82, height: 82, borderRadius: radii.control, backgroundColor: colors.surfaceMuted },
  logLink: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: colors.primarySoft }, logRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }, logIcon: { width: 29, height: 29, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primarySoft }, logTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" }, logNote: { color: colors.muted, fontSize: 10, marginTop: 2 }, missing: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg },
});
