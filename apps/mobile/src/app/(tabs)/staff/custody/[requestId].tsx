import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { createRequestUuid, getApiErrorMessage, postService, staffService, type StaffCustodyAuditEntry, type StaffCustodyIntakeContext, type StaffCustodyRequest, type HandoverPoint } from "@/services/api";

type IntakePhoto = { id: string; url: string; uri: string };

function AuditRow({ event, last }: { event: StaffCustodyAuditEntry; last: boolean }) {
  const labels: Record<string, string> = { CREATED: "Tạo yêu cầu", ACCEPTED: "Chấp nhận bàn giao", REJECTED: "Từ chối yêu cầu", INTAKED: "Xác nhận nhập kho", CANCELLED: "Hủy yêu cầu" };
  return <View style={styles.auditRow}><View style={styles.auditRail}><View style={styles.auditDot} /><View style={[styles.auditLine, last && styles.auditLineHidden]} /></View><View style={styles.auditCopy}><Text style={styles.auditTitle}>{labels[event.action] ?? event.action.replaceAll("_", " ")}</Text><Text style={styles.auditMeta}>{event.actorName || "Nhân viên"} · {staffDateTime(event.createdAt)}</Text>{event.metadata?.reason && typeof event.metadata.reason === "string" ? <Text style={styles.auditNote}>{event.metadata.reason}</Text> : null}</View></View>;
}

export default function CustodyRequestDetailScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const [request, setRequest] = useState<StaffCustodyRequest | null>(null);
  const [audit, setAudit] = useState<StaffCustodyAuditEntry[]>([]);
  const [context, setContext] = useState<StaffCustodyIntakeContext | null>(null);
  const [points, setPoints] = useState<HandoverPoint[]>([]);
  const [handoverPointId, setHandoverPointId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [physicalConfirmed, setPhysicalConfirmed] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [itemName, setItemName] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [storageCode, setStorageCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [accessories, setAccessories] = useState("");
  const [photos, setPhotos] = useState<IntakePhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intakeKey = useRef(createRequestUuid());

  const load = useCallback(async (refresh = false) => {
    if (!requestId) return;
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      const [detail, photoContext, handoverResult] = await Promise.all([
        staffService.getCustodyRequest(requestId),
        staffService.getCustodyIntakeContext(requestId).catch(() => null),
        postService.listPublicHandoverPoints(),
      ]);
      setRequest(detail.request);
      setAudit(detail.audit);
      setContext(photoContext);
      setItemName((current) => current || photoContext?.post.title || detail.request.post?.title || "");
      setConditionNotes((current) => current || "");
      setHandoverPointId((current) => current || detail.request.handoverPoint?.id || handoverResult.handoverPoints[0]?.id || "");
      setPoints(handoverResult.handoverPoints);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId]);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);

  const accept = async () => {
    if (!request || !handoverPointId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await staffService.acceptCustodyRequest(request.id, { handoverPointId });
      setRequest(updated);
      setShowReject(false);
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!request || rejectReason.trim().length < 1 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await staffService.rejectCustodyRequest(request.id, rejectReason.trim());
      setRequest(updated);
      setShowReject(false);
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (source: "camera" | "library") => {
    if (photos.length >= 5 || uploadingPhoto) return;
    setError(null);
    try {
      const selected = await pickStaffImage(source);
      if (!selected) return;
      setUploadingPhoto(true);
      const saved = await staffService.uploadIntakeImage(selected.file, intakeKey.current, requestId);
      setPhotos((current) => [...current, { id: saved.id, url: saved.url, uri: selected.uri }]);
    } catch (photoError) {
      setError(getApiErrorMessage(photoError));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async (photo: IntakePhoto) => {
    setError(null);
    try {
      await staffService.deleteIntakeImage(photo.id, intakeKey.current);
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
    } catch (removeError) {
      setError(getApiErrorMessage(removeError));
    }
  };

  const confirmIntake = async () => {
    if (!request || busy) return;
    if (!context) {
      setError("Chưa tải được ngữ cảnh bàn giao. Vui lòng làm mới.");
      return;
    }
    const parsedQuantity = Number(quantity);
    if (!physicalConfirmed) { setError("Cần xác nhận đã kiểm tra vật phẩm thực tế tại quầy."); return; }
    if (photos.length < 1) { setError("Tải lên ít nhất một ảnh tình trạng lúc tiếp nhận."); return; }
    if (!conditionNotes.trim()) { setError("Ghi rõ tình trạng vật phẩm khi nhận."); return; }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 999) { setError("Số lượng cần là số nguyên từ 1 đến 999."); return; }
    if (!accessories.trim()) { setError("Ghi phụ kiện thực nhận hoặc nhập ‘Không có’."); return; }
    setBusy(true);
    setError(null);
    try {
      const completed = await staffService.confirmCustodyIntake(request.id, {
        physicalReviewConfirmed: true,
        intakeKey: intakeKey.current,
        intakeImageIds: photos.map((photo) => photo.id),
        receivedQuantity: parsedQuantity,
        accessories: accessories.trim(),
        itemName: itemName.trim() || context.post.title,
        conditionNotes: conditionNotes.trim(),
        storageCode: storageCode.trim() || undefined,
      });
      setRequest(completed);
      await load(true);
      if (completed.warehouseItemId) router.replace(`/staff/warehouse/${completed.warehouseItemId}` as never);
    } catch (intakeError) {
      setError(getApiErrorMessage(intakeError));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><StaffNavigation active="custody" /><LoadingSpinner label="Đang tải hồ sơ bàn giao…" /></SafeAreaView>;
  if (!request) return <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}><StaffNavigation active="custody" /><View style={styles.missing}><ErrorBanner message={error ?? "Không tìm thấy yêu cầu tiếp nhận."} onRetry={() => void load(true)} /><Button title="Quay lại hàng đợi" variant="secondary" onPress={() => router.replace("/staff/custody" as never)} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StaffNavigation active="custody" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        <View style={styles.pageHeader}><Pressable accessibilityRole="button" accessibilityLabel="Quay lại hàng đợi" onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={21} color={colors.primary} /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>HỒ SƠ CUSTODY</Text><Text accessibilityRole="header" style={styles.title}>{context?.post.title || request.post?.title || "Yêu cầu bàn giao vật phẩm"}</Text></View><WarehouseStatusPill status={request.status} compact /></View>
        {error ? <ErrorBanner message={error} /> : null}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}><View style={styles.summaryIcon}><MaterialCommunityIcons name="account-arrow-right-outline" size={20} color={colors.primary} /></View><View style={styles.summaryCopy}><Text style={styles.label}>Người nhặt / người gửi</Text><Text style={styles.value}>{request.requester.fullName || context?.post.finderName || "Chưa ghi nhận"}</Text></View></View>
          <View style={styles.summaryRow}><MaterialCommunityIcons name="map-marker-radius-outline" size={19} color={colors.primary} /><View style={styles.summaryCopy}><Text style={styles.label}>Điểm bàn giao</Text><Text style={styles.value}>{request.handoverPoint?.name || "Chọn điểm khi chấp nhận"}</Text></View></View>
          <View style={styles.summaryRow}><MaterialCommunityIcons name="calendar-clock-outline" size={19} color={colors.primary} /><View style={styles.summaryCopy}><Text style={styles.label}>Thời gian dự kiến</Text><Text style={styles.value}>{staffDateTime(request.requestedIntakeAt)}</Text></View></View>
          <View style={styles.reasonBox}><Text style={styles.label}>Lý do chuyển kho</Text><Text style={styles.reasonText}>{request.reason || "Không có lý do kèm theo."}</Text></View>
          {request.claimId ? <Pressable accessibilityRole="button" onPress={() => router.push(`/claims/${request.claimId}` as never)} style={styles.claimLink}><MaterialCommunityIcons name="message-lock-outline" size={17} color={colors.primary} /><Text style={styles.claimLinkText}>Mở phòng xác minh riêng</Text></Pressable> : null}
        </Card>

        {context?.images.length ? <Card style={styles.imageCard}><Text style={styles.sectionTitle}>Ảnh nguồn và đối chiếu</Text><Text style={styles.sectionSubtitle}>Ảnh gốc dùng để nhận diện, không thay thế việc kiểm tra trực tiếp tại quầy.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>{context.images.map((image) => <View key={image.id} style={styles.sourceImageWrap}><SecureImage url={image.url} style={styles.sourceImage} accessibilityLabel="Ảnh nguồn vật phẩm" /><Text style={styles.imageLabel}>{image.provenance === "CONTACT_PHOTO" ? "Ảnh đối chiếu" : "Ảnh bài đăng"}</Text></View>)}</ScrollView></Card> : null}

        {request.status === "PENDING" ? <Card style={styles.actionCard}>
          <Text style={styles.sectionTitle}>Phản hồi yêu cầu</Text><Text style={styles.sectionSubtitle}>Kiểm tra nguồn vật phẩm và xác định điểm bàn giao trước khi chấp nhận.</Text>
          <Text style={styles.fieldLabel}>Điểm tiếp nhận</Text>
          <View style={styles.points}>{points.map((point) => <Pressable key={point.id} accessibilityRole="radio" accessibilityState={{ selected: handoverPointId === point.id }} onPress={() => setHandoverPointId(point.id)} style={[styles.point, handoverPointId === point.id && styles.pointSelected]}><MaterialCommunityIcons name={handoverPointId === point.id ? "radiobox-marked" : "radiobox-blank"} size={18} color={handoverPointId === point.id ? colors.primary : colors.muted} /><View style={styles.summaryCopy}><Text style={styles.pointTitle}>{point.name}</Text><Text style={styles.pointAddress}>{point.address ?? "Điểm bàn giao do trường quản lý"}</Text></View></Pressable>)}</View>
          <Button title="Chấp nhận bàn giao" onPress={() => void accept()} loading={busy} disabled={!handoverPointId} />
          {!showReject ? <Button title="Từ chối yêu cầu" variant="danger" onPress={() => setShowReject(true)} disabled={busy} /> : <><Input label="Lý do từ chối" value={rejectReason} onChangeText={setRejectReason} multiline maxLength={2000} placeholder="Nêu rõ lý do để người gửi biết…" /><View style={styles.actionRow}><Button title="Quay lại" variant="secondary" onPress={() => setShowReject(false)} style={styles.actionButton} /><Button title="Xác nhận từ chối" variant="danger" onPress={() => void reject()} loading={busy} disabled={!rejectReason.trim()} style={styles.actionButton} /></View></>}
        </Card> : null}

        {request.status === "ACCEPTED" ? <Card style={styles.intakeCard}>
          <View style={styles.intakeHeader}><View style={styles.intakeIcon}><MaterialCommunityIcons name="clipboard-check-outline" size={20} color={colors.success} /></View><View style={styles.summaryCopy}><Text style={styles.sectionTitle}>Xác nhận nhập kho</Text><Text style={styles.sectionSubtitle}>Ghi nhận tình trạng và ảnh thực tế khi nhận vật phẩm.</Text></View></View>
          <Input label="Tên vật phẩm" value={itemName} onChangeText={setItemName} maxLength={255} placeholder="Tên vật phẩm" />
          <Input label="Tình trạng khi tiếp nhận" value={conditionNotes} onChangeText={setConditionNotes} multiline maxLength={2000} placeholder="Mô tả vết xước, hư hỏng hoặc tình trạng bên ngoài…" />
          <Input label="Mã vị trí kệ (để trống để hệ thống tạo)" value={storageCode} onChangeText={setStorageCode} maxLength={60} placeholder="Ví dụ: WH-A1-02" />
          <Input label="Số lượng thực nhận" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" maxLength={3} />
          <Input label="Phụ kiện đi kèm" value={accessories} onChangeText={setAccessories} maxLength={2000} placeholder="Ghi phụ kiện thực nhận hoặc ‘Không có’" />
          <View style={styles.photoHeading}><View style={styles.summaryCopy}><Text style={styles.fieldLabel}>Ảnh tình trạng lúc nhập kho</Text><Text style={styles.sectionSubtitle}>{photos.length}/5 ảnh · tối thiểu 1 ảnh</Text></View><MaterialCommunityIcons name="camera-outline" size={20} color={colors.primary} /></View>
          <View style={styles.actionRow}><Button title="Chụp ảnh" variant="secondary" onPress={() => void uploadPhoto("camera")} disabled={photos.length >= 5 || uploadingPhoto} style={styles.actionButton} /><Button title="Chọn ảnh" variant="secondary" onPress={() => void uploadPhoto("library")} disabled={photos.length >= 5 || uploadingPhoto} style={styles.actionButton} /></View>
          {uploadingPhoto ? <View style={styles.uploading}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.sectionSubtitle}>Đang tải ảnh lên…</Text></View> : null}
          {photos.length ? <View style={styles.photoList}>{photos.map((photo) => <View key={photo.id} style={styles.photoTile}><Image source={{ uri: photo.uri }} style={styles.intakeImage} accessibilityLabel="Ảnh tình trạng vật phẩm" /><Pressable accessibilityRole="button" accessibilityLabel="Xóa ảnh" onPress={() => void removePhoto(photo)} style={styles.removeImage}><MaterialCommunityIcons name="close" size={15} color={colors.surface} /></Pressable></View>)}</View> : null}
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: physicalConfirmed }} onPress={() => setPhysicalConfirmed((value) => !value)} style={styles.confirmRow}><MaterialCommunityIcons name={physicalConfirmed ? "checkbox-marked" : "checkbox-blank-outline"} size={23} color={physicalConfirmed ? colors.success : colors.muted} /><Text style={styles.confirmText}>Tôi đã kiểm tra hiện trạng vật lý, số lượng và phụ kiện tại quầy.</Text></Pressable>
          <Button title="Xác nhận nhập kho" onPress={() => void confirmIntake()} loading={busy} disabled={!physicalConfirmed || photos.length === 0 || !conditionNotes.trim() || !accessories.trim()} />
        </Card> : null}

        {request.status === "INTAKED" && request.warehouseItemId ? <Card style={styles.completedCard}><MaterialCommunityIcons name="check-decagram-outline" size={22} color={colors.success} /><View style={styles.summaryCopy}><Text style={styles.sectionTitle}>Đã tạo hồ sơ kho</Text><Text style={styles.sectionSubtitle}>Hồ sơ vật phẩm đã được ghi nhận và có thể theo dõi trong kho.</Text></View><Button title="Mở vật phẩm trong kho" onPress={() => router.push(`/staff/warehouse/${request.warehouseItemId}` as never)} /></Card> : null}

        <Card style={styles.auditCard}><Text style={styles.sectionTitle}>Lịch sử kiểm toán</Text>{audit.length ? audit.map((event, index) => <AuditRow key={event.id} event={event} last={index === audit.length - 1} />) : <Text style={styles.sectionSubtitle}>Chưa có bản ghi audit.</Text>}</Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl },
  pageHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, backButton: { width: 42, height: 44, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, gap: 3 }, eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }, title: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: "900" },
  summaryCard: { gap: spacing.md }, summaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, summaryIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.primarySoft }, summaryCopy: { flex: 1, gap: 2 }, label: { color: colors.muted, fontSize: 10 }, value: { color: colors.ink, fontSize: 13, fontWeight: "800" }, reasonBox: { padding: spacing.md, gap: 4, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, reasonText: { color: colors.ink, fontSize: 12, lineHeight: 18 }, claimLink: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm }, claimLinkText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  imageCard: { gap: spacing.xs }, sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" }, sectionSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 17 }, imageRow: { gap: spacing.sm, paddingTop: spacing.sm }, sourceImageWrap: { gap: 4 }, sourceImage: { width: 128, height: 100, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, imageLabel: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  actionCard: { gap: spacing.md }, fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" }, points: { gap: spacing.xs }, point: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border }, pointSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, pointTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" }, pointAddress: { color: colors.muted, fontSize: 10 }, actionRow: { flexDirection: "row", gap: spacing.sm }, actionButton: { flex: 1 },
  intakeCard: { gap: spacing.md }, intakeHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, intakeIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.successSoft }, photoHeading: { flexDirection: "row", alignItems: "center" }, uploading: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: spacing.xs }, photoList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, photoTile: { position: "relative" }, intakeImage: { width: 86, height: 86, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, removeImage: { position: "absolute", top: 4, right: 4, width: 25, height: 25, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.danger }, confirmRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.successSoft }, confirmText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: "700" }, completedCard: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.md }, auditCard: { gap: spacing.md }, auditRow: { minHeight: 54, flexDirection: "row", gap: spacing.sm }, auditRail: { width: 18, alignItems: "center" }, auditDot: { zIndex: 1, width: 12, height: 12, borderRadius: radii.pill, backgroundColor: colors.primary }, auditLine: { position: "absolute", top: 12, bottom: -5, width: 2, backgroundColor: colors.border }, auditLineHidden: { display: "none" }, auditCopy: { flex: 1, gap: 3, paddingBottom: spacing.md }, auditTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" }, auditMeta: { color: colors.muted, fontSize: 10 }, auditNote: { color: colors.muted, fontSize: 11 }, missing: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg },
});
