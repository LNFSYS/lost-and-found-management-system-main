import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { StaffNavigation, pickStaffImage } from "@/components/staff/staff-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import { createRequestUuid, getApiErrorMessage, postService, staffService, type HandoverPoint } from "@/services/api";

type IntakePhoto = { id: string; url: string; uri: string };

export default function WalkInIntakeScreen() {
  const [points, setPoints] = useState<HandoverPoint[]>([]);
  const [pointId, setPointId] = useState("");
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [finderName, setFinderName] = useState("");
  const [finderContact, setFinderContact] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [storageCode, setStorageCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [accessories, setAccessories] = useState("");
  const [physicalConfirmed, setPhysicalConfirmed] = useState(false);
  const [photos, setPhotos] = useState<IntakePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intakeKey = useRef(createRequestUuid());

  useEffect(() => {
    let active = true;
    void postService.listPublicHandoverPoints().then((result) => {
      if (!active) return;
      setPoints(result.handoverPoints);
      setPointId(result.handoverPoints[0]?.id ?? "");
    }).catch((loadError) => { if (active) setError(getApiErrorMessage(loadError)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const uploadPhoto = async (source: "camera" | "library") => {
    if (photos.length >= 5 || uploadingPhoto) return;
    setError(null);
    try {
      const selected = await pickStaffImage(source);
      if (!selected) return;
      setUploadingPhoto(true);
      const saved = await staffService.uploadIntakeImage(selected.file, intakeKey.current);
      setPhotos((current) => [...current, { id: saved.id, url: saved.url, uri: selected.uri }]);
    } catch (photoError) {
      setError(getApiErrorMessage(photoError));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async (photo: IntakePhoto) => {
    try {
      await staffService.deleteIntakeImage(photo.id, intakeKey.current);
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
    } catch (removeError) {
      setError(getApiErrorMessage(removeError));
    }
  };

  const createWalkIn = async () => {
    const receivedQuantity = Number(quantity);
    if (!pointId) { setError("Chọn quầy tiếp nhận vật phẩm."); return; }
    if (itemName.trim().length < 1) { setError("Nhập tên vật phẩm."); return; }
    if (!conditionNotes.trim()) { setError("Ghi tình trạng vật phẩm khi tiếp nhận."); return; }
    if (!accessories.trim()) { setError("Ghi phụ kiện thực nhận hoặc nhập ‘Không có’."); return; }
    if (!Number.isInteger(receivedQuantity) || receivedQuantity < 1 || receivedQuantity > 999) { setError("Số lượng cần là số nguyên từ 1 đến 999."); return; }
    if (!physicalConfirmed) { setError("Cần xác nhận đã kiểm tra vật phẩm thực tế."); return; }
    if (photos.length < 1) { setError("Tải lên ít nhất một ảnh tình trạng vật phẩm."); return; }
    setBusy(true);
    setError(null);
    try {
      const item = await staffService.createWalkInWarehouseItem({
        postId: null,
        handoverPointId: pointId,
        itemName: itemName.trim(),
        description: description.trim() || undefined,
        finderName: finderName.trim() || undefined,
        finderContact: finderContact.trim() || undefined,
        conditionNotes: conditionNotes.trim(),
        storageCode: storageCode.trim() || undefined,
        intakeKey: intakeKey.current,
        intakeImageIds: photos.map((photo) => photo.id),
        receivedQuantity,
        accessories: accessories.trim(),
        physicalReviewConfirmed: true,
      });
      router.replace(`/staff/warehouse/${item.id}` as never);
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><StaffNavigation active="custody" /><LoadingSpinner label="Đang tải điểm bàn giao…" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StaffNavigation active="custody" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}><Pressable accessibilityRole="button" accessibilityLabel="Quay lại hàng đợi" onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={21} color={colors.primary} /></Pressable><View style={styles.headingCopy}><Text style={styles.eyebrow}>TIẾP NHẬN TẠI QUẦY</Text><Text accessibilityRole="header" style={styles.title}>Walk-in</Text><Text style={styles.subtitle}>Lập hồ sơ kho khi vật phẩm được mang trực tiếp tới trường.</Text></View></View>
        {error ? <ErrorBanner message={error} /> : null}
        <Card style={styles.formCard}>
          <View style={styles.infoBanner}><MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} /><Text style={styles.infoText}>Ghi nhận thông tin tối thiểu cần thiết. Không nhập giấy tờ hoặc dữ liệu cá nhân không liên quan vào phần ghi chú.</Text></View>
          <Input label="Tên vật phẩm" value={itemName} onChangeText={setItemName} maxLength={255} placeholder="Ví dụ: Bình nước màu xanh" />
          <Input label="Mô tả thêm (không bắt buộc)" value={description} onChangeText={setDescription} multiline maxLength={2000} placeholder="Dấu hiệu nhận dạng bên ngoài…" />
          <View style={styles.formDivider}><Text style={styles.fieldLabel}>Điểm tiếp nhận</Text><View style={styles.pointList}>{points.map((point) => <Pressable key={point.id} accessibilityRole="radio" accessibilityState={{ selected: pointId === point.id }} onPress={() => setPointId(point.id)} style={[styles.pointCard, pointId === point.id && styles.pointCardSelected]}><MaterialCommunityIcons name={pointId === point.id ? "radiobox-marked" : "radiobox-blank"} size={19} color={pointId === point.id ? colors.primary : colors.muted} /><View style={styles.headingCopy}><Text style={styles.pointName}>{point.name}</Text><Text style={styles.pointAddress}>{point.address || "Điểm bàn giao do trường quản lý"}</Text></View></Pressable>)}</View></View>
          <Text style={styles.sectionTitle}>Người mang vật phẩm đến</Text>
          <Input label="Họ tên (không bắt buộc)" value={finderName} onChangeText={setFinderName} maxLength={150} placeholder="Tên người giao" />
          <Input label="Số liên hệ (không bắt buộc)" value={finderContact} onChangeText={setFinderContact} maxLength={255} keyboardType="phone-pad" placeholder="Số điện thoại hoặc thông tin liên hệ" />
          <View style={styles.formDivider} />
          <Input label="Tình trạng vật phẩm" value={conditionNotes} onChangeText={setConditionNotes} multiline maxLength={2000} placeholder="Ghi vết xước, hư hỏng hoặc tình trạng bên ngoài…" />
          <Input label="Mã vị trí lưu kho (để trống để hệ thống tạo)" value={storageCode} onChangeText={setStorageCode} maxLength={60} placeholder="Ví dụ: WH-A1-02" />
          <Input label="Số lượng thực nhận" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" maxLength={3} />
          <Input label="Phụ kiện đi kèm" value={accessories} onChangeText={setAccessories} maxLength={2000} placeholder="Ghi phụ kiện thực nhận hoặc ‘Không có’" />
          <View style={styles.photoHeading}><View style={styles.headingCopy}><Text style={styles.fieldLabel}>Ảnh tình trạng khi nhập kho</Text><Text style={styles.subtitle}>{photos.length}/5 ảnh · cần ít nhất 1 ảnh</Text></View><MaterialCommunityIcons name="camera-outline" size={20} color={colors.primary} /></View>
          <View style={styles.photoActions}><Button title="Chụp ảnh" variant="secondary" onPress={() => void uploadPhoto("camera")} disabled={busy || uploadingPhoto || photos.length >= 5} style={styles.photoButton} /><Button title="Chọn ảnh" variant="secondary" onPress={() => void uploadPhoto("library")} disabled={busy || uploadingPhoto || photos.length >= 5} style={styles.photoButton} /></View>
          {uploadingPhoto ? <View style={styles.uploading}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.subtitle}>Đang tải ảnh lên…</Text></View> : null}
          {photos.length ? <View style={styles.photoList}>{photos.map((photo) => <View key={photo.id} style={styles.photoTile}><Image source={{ uri: photo.uri }} style={styles.photo} accessibilityLabel="Ảnh vật phẩm tiếp nhận" /><Pressable accessibilityRole="button" accessibilityLabel="Xóa ảnh" onPress={() => void removePhoto(photo)} style={styles.removePhoto}><MaterialCommunityIcons name="close" size={15} color={colors.surface} /></Pressable></View>)}</View> : null}
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: physicalConfirmed }} onPress={() => setPhysicalConfirmed((value) => !value)} style={styles.confirmRow}><MaterialCommunityIcons name={physicalConfirmed ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={physicalConfirmed ? colors.success : colors.muted} /><Text style={styles.confirmText}>Tôi đã kiểm tra hiện trạng vật lý, số lượng và phụ kiện thực nhận tại quầy.</Text></Pressable>
          <Button title="Tạo hồ sơ và nhập kho" onPress={() => void createWalkIn()} loading={busy} disabled={!pointId || !itemName.trim() || !conditionNotes.trim() || !accessories.trim() || !physicalConfirmed || !photos.length} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl }, headingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, backButton: { width: 42, height: 44, alignItems: "center", justifyContent: "center" }, headingCopy: { flex: 1, gap: 4 }, eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, title: { color: colors.ink, fontSize: 21, fontWeight: "900" }, subtitle: { color: colors.muted, fontSize: 11, lineHeight: 17 }, formCard: { gap: spacing.md }, infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.primarySoft }, infoText: { flex: 1, color: colors.primaryDark, fontSize: 11, lineHeight: 17 }, fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" }, sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" }, formDivider: { height: 1, backgroundColor: colors.border }, pointList: { gap: spacing.xs, marginTop: spacing.sm }, pointCard: { minHeight: 53, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border }, pointCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, pointName: { color: colors.ink, fontSize: 12, fontWeight: "800" }, pointAddress: { color: colors.muted, fontSize: 10 }, photoHeading: { flexDirection: "row", alignItems: "center" }, photoActions: { flexDirection: "row", gap: spacing.sm }, photoButton: { flex: 1 }, uploading: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: spacing.sm }, photoList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, photoTile: { position: "relative" }, photo: { width: 86, height: 86, borderRadius: radii.control, backgroundColor: colors.surfaceMuted }, removePhoto: { position: "absolute", top: 4, right: 4, width: 25, height: 25, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.danger }, confirmRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.control, backgroundColor: colors.successSoft }, confirmText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: "700" },
});
