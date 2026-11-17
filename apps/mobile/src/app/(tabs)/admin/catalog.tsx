import { useCallback, useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { colors, radii, spacing } from "@/constants/theme";
import { adminService, getApiErrorMessage, type AdminCatalog, type MobileImageFile } from "@/services/api";

type Section = "categories" | "areas" | "buildings" | "handoverPoints";
const sectionOptions: { key: Section; label: string }[] = [{ key: "categories", label: "Danh mục" }, { key: "areas", label: "Khu vực" }, { key: "buildings", label: "Tòa nhà" }, { key: "handoverPoints", label: "Điểm bàn giao" }];
type RecordItem = { id: string; name: string; isActive: boolean; [key: string]: unknown };
const blankForm = (section: Section): Record<string, string> => section === "categories" ? { name: "", icon: "", parentId: "", sortOrder: "0" }
  : section === "areas" ? { name: "", description: "", sortOrder: "0" }
    : section === "buildings" ? { name: "", areaId: "", sortOrder: "0" }
      : { name: "", address: "", areaId: "", buildingId: "", openingHours: "", contactInfo: "", mapImageUrl: "", mapPositionX: "", mapPositionY: "" };

export default function AdminCatalogScreen() {
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null); const [section, setSection] = useState<Section>("categories"); const [form, setForm] = useState<Record<string, string>>(blankForm("categories")); const [editingId, setEditingId] = useState(""); const [mapFile, setMapFile] = useState<MobileImageFile | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { setError(""); try { setCatalog(await adminService.getCatalog()); } catch (err) { setError(getApiErrorMessage(err)); } finally { setLoading(false); } }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const data: RecordItem[] = catalog ? catalog[section] as unknown as RecordItem[] : [];
  const currentMapImage = editingId ? catalog?.handoverPoints.find((point) => point.id === editingId)?.mapImageUrl ?? "" : "";
  const beginCreate = () => { setEditingId(""); setForm(blankForm(section)); setMapFile(null); };
  const beginEdit = (item: RecordItem) => {
    setEditingId(item.id); const next = blankForm(section);
    for (const key of Object.keys(next)) { const value = item[key]; next[key] = value === null || value === undefined || (key === "mapImageUrl" && typeof value === "string" && value.startsWith("data:")) ? "" : String(value); }
    setForm(next); setMapFile(null);
  };
  const change = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const pickMap = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0]; const extension = asset.fileName?.split(".").pop()?.toLowerCase(); const type = asset.mimeType ?? (extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg");
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) { setError("Ảnh bản đồ cần ở định dạng JPEG, PNG hoặc WEBP."); return; }
    if (asset.fileSize && asset.fileSize > 2_000_000) { setError("Ảnh bản đồ phải nhỏ hơn 2 MB."); return; }
    setMapFile({ uri: asset.uri, name: asset.fileName ?? `handover-map.${extension === "png" ? "png" : "jpg"}`, type }); setError("");
  };
  const payload = () => {
    if (!form.name.trim()) throw new Error("Tên không được để trống.");
    if (section === "categories") return { name: form.name.trim(), icon: form.icon.trim() || null, parentId: form.parentId.trim() || null, sortOrder: Number(form.sortOrder) || 0 };
    if (section === "areas") return { name: form.name.trim(), description: form.description.trim() || null, sortOrder: Number(form.sortOrder) || 0 };
    if (section === "buildings") { if (!form.areaId) throw new Error("Chọn khu vực cho tòa nhà."); return { name: form.name.trim(), areaId: form.areaId, sortOrder: Number(form.sortOrder) || 0 }; }
    if (form.address.trim().length < 2) throw new Error("Địa chỉ cần ít nhất 2 ký tự.");
    const x = form.mapPositionX.trim() ? Number(form.mapPositionX) : null; const y = form.mapPositionY.trim() ? Number(form.mapPositionY) : null;
    if ((x === null) !== (y === null) || (x !== null && (!Number.isFinite(x) || x < 0 || x > 100)) || (y !== null && (!Number.isFinite(y) || y < 0 || y > 100))) throw new Error("Tọa độ X và Y cần nhập cùng nhau, mỗi giá trị từ 0 đến 100.");
    return { name: form.name.trim(), address: form.address.trim(), areaId: form.areaId || null, buildingId: form.buildingId || null, openingHours: form.openingHours.trim() || null, contactInfo: form.contactInfo.trim() || null, mapImageUrl: form.mapImageUrl.trim() || (editingId ? undefined : null), mapPositionX: x, mapPositionY: y };
  };
  const save = async () => {
    setBusy(true); setError("");
    try {
      const value = payload(); let result: unknown;
      if (section === "categories") result = editingId ? await adminService.updateCategory(editingId, value) : await adminService.createCategory(value as { name: string; icon: string | null; parentId: string | null; sortOrder: number });
      else if (section === "areas") result = editingId ? await adminService.updateArea(editingId, value) : await adminService.createArea(value as { name: string; description: string | null; sortOrder: number });
      else if (section === "buildings") result = editingId ? await adminService.updateBuilding(editingId, value) : await adminService.createBuilding(value as { name: string; areaId: string; sortOrder: number });
      else result = editingId ? await adminService.updateHandoverPoint(editingId, value) : await adminService.createHandoverPoint(value);
      const createdId = editingId || (result as { id?: string } | undefined)?.id;
      if (section === "handoverPoints" && mapFile && createdId) await adminService.uploadHandoverMap(createdId, mapFile);
      beginCreate(); await load();
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setBusy(false); }
  };
  const remove = async (item: RecordItem) => {
    setBusy(true); setError("");
    try { if (section === "categories") await adminService.deleteCategory(item.id); else if (section === "areas") await adminService.deleteArea(item.id); else if (section === "buildings") await adminService.deleteBuilding(item.id); else await adminService.deleteHandoverPoint(item.id); if (editingId === item.id) beginCreate(); await load(); }
    catch (err) { setError(getApiErrorMessage(err)); }
    finally { setBusy(false); }
  };
  const toggleActive = async (item: RecordItem) => {
    setBusy(true); setError("");
    try {
      const next = { isActive: item.isActive === false };
      if (section === "categories") await adminService.updateCategory(item.id, next);
      else if (section === "areas") await adminService.updateArea(item.id, next);
      else if (section === "buildings") await adminService.updateBuilding(item.id, next);
      else await adminService.updateHandoverPoint(item.id, next);
      await load();
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setBusy(false); }
  };
  if (loading) return <LoadingSpinner label="Đang tải dữ liệu danh mục…" />;
  return <AppScreen title="Danh mục & địa điểm" description="Quản lý các lựa chọn hiển thị trong bài đăng và điểm bàn giao.">
    <AdminNavigation active="catalog" />
    {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
    <View style={styles.sections}>{sectionOptions.map((option) => <Pressable key={option.key} accessibilityRole="tab" accessibilityState={{ selected: section === option.key }} onPress={() => { setSection(option.key); setEditingId(""); setForm(blankForm(option.key)); setMapFile(null); }} style={[styles.section, section === option.key && styles.sectionSelected]}><Text style={[styles.sectionText, section === option.key && styles.sectionTextSelected]}>{option.label}</Text></Pressable>)}</View>
    <Card style={styles.editor}>
      <Text style={styles.formTitle}>{editingId ? "Chỉnh sửa mục" : "Thêm mục mới"}</Text>
      <Input label={section === "handoverPoints" ? "Tên điểm bàn giao" : "Tên"} value={form.name ?? ""} onChangeText={(value) => change("name", value)} maxLength={100} />
      {section === "categories" ? <>
        <Input label="Icon (tùy chọn)" value={form.icon ?? ""} onChangeText={(value) => change("icon", value)} placeholder="Material Community Icon" />
        <Input label="ID danh mục cha (tùy chọn)" value={form.parentId ?? ""} onChangeText={(value) => change("parentId", value)} autoCapitalize="none" />
        <Input label="Thứ tự sắp xếp" value={form.sortOrder ?? "0"} onChangeText={(value) => change("sortOrder", value)} keyboardType="number-pad" />
      </> : null}
      {section === "areas" ? <><Input label="Mô tả" value={form.description ?? ""} onChangeText={(value) => change("description", value)} maxLength={255} multiline /><Input label="Thứ tự sắp xếp" value={form.sortOrder ?? "0"} onChangeText={(value) => change("sortOrder", value)} keyboardType="number-pad" /></> : null}
      {section === "buildings" ? <>
        <Text style={styles.fieldLabel}>Khu vực</Text><View style={styles.chips}>{(catalog?.areas ?? []).map((area) => <Chip key={area.id} label={area.name} selected={form.areaId === area.id} onPress={() => change("areaId", area.id)} />)}</View>
        <Input label="Thứ tự sắp xếp" value={form.sortOrder ?? "0"} onChangeText={(value) => change("sortOrder", value)} keyboardType="number-pad" />
      </> : null}
      {section === "handoverPoints" ? <>
        <Input label="Địa chỉ" value={form.address ?? ""} onChangeText={(value) => change("address", value)} maxLength={255} />
        <Text style={styles.fieldLabel}>Khu vực</Text><View style={styles.chips}><Chip label="Không chọn" selected={!form.areaId} onPress={() => change("areaId", "")} />{(catalog?.areas ?? []).map((area) => <Chip key={area.id} label={area.name} selected={form.areaId === area.id} onPress={() => { change("areaId", area.id); change("buildingId", ""); }} />)}</View>
        <Text style={styles.fieldLabel}>Tòa nhà</Text><View style={styles.chips}><Chip label="Không chọn" selected={!form.buildingId} onPress={() => change("buildingId", "")} />{(catalog?.buildings ?? []).filter((building) => !form.areaId || building.areaId === form.areaId).map((building) => <Chip key={building.id} label={building.name} selected={form.buildingId === building.id} onPress={() => change("buildingId", building.id)} />)}</View>
        <Input label="Giờ mở cửa" value={form.openingHours ?? ""} onChangeText={(value) => change("openingHours", value)} placeholder="Thứ 2–6: 08:00–17:00" maxLength={255} />
        <Input label="Thông tin liên hệ" value={form.contactInfo ?? ""} onChangeText={(value) => change("contactInfo", value)} maxLength={255} />
        <Input label="URL ảnh bản đồ (nếu có)" value={form.mapImageUrl ?? ""} onChangeText={(value) => change("mapImageUrl", value)} autoCapitalize="none" maxLength={2048} />
        <Button title={mapFile ? `Ảnh đã chọn: ${mapFile.name}` : "Chọn / tải ảnh bản đồ"} variant="secondary" onPress={() => void pickMap()} />
        <Text style={styles.helper}>Chạm vào ảnh để đặt marker. Tọa độ tính theo phần trăm từ góc trên trái.</Text>
        {mapFile || form.mapImageUrl || currentMapImage ? <MapMarkerEditor uri={mapFile?.uri ?? form.mapImageUrl ?? currentMapImage} x={form.mapPositionX ?? ""} y={form.mapPositionY ?? ""} onChange={(x, y) => setForm((current) => ({ ...current, mapPositionX: String(x), mapPositionY: String(y) }))} /> : null}
        <View style={styles.coordinateRow}><Input label="Vị trí X (0–100%)" value={form.mapPositionX ?? ""} onChangeText={(value) => change("mapPositionX", value)} keyboardType="decimal-pad" /><Input label="Vị trí Y (0–100%)" value={form.mapPositionY ?? ""} onChangeText={(value) => change("mapPositionY", value)} keyboardType="decimal-pad" /></View>
      </> : null}
      <View style={styles.formActions}>{editingId ? <Button title="Hủy sửa" variant="secondary" onPress={beginCreate} style={styles.flex} /> : null}<Button title={editingId ? "Lưu thay đổi" : "Tạo mới"} loading={busy} onPress={() => void save()} style={styles.flex} /></View>
    </Card>
    <Text style={styles.listHeading}>{sectionOptions.find((option) => option.key === section)?.label} hiện có ({data.length})</Text>
    {!data.length ? <Card><EmptyState icon="database-outline" title="Chưa có dữ liệu" description="Thêm mục đầu tiên bằng biểu mẫu phía trên." /></Card> : null}
    <View style={styles.list}>{data.map((item) => <Card key={item.id} style={styles.item}>
      <View style={styles.itemTop}><View style={styles.itemCopy}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemMeta}>{section === "handoverPoints" ? `${String(item.address ?? "")} · ${String(item.openingHours ?? "Chưa có giờ mở cửa")}` : section === "buildings" ? String(item.areaName ?? "") : section === "categories" ? String(item.icon ?? "") : String(item.description ?? "")}</Text></View><Badge status={item.isActive === false ? "DISABLED" : "ACTIVE"} /></View>
      {section === "handoverPoints" && typeof item.mapImageUrl === "string" && item.mapImageUrl ? <View style={styles.mapView}><Image source={{ uri: item.mapImageUrl }} accessibilityLabel={`Ảnh bản đồ ${item.name}`} style={styles.mapPreview} resizeMode="cover" />{item.mapPositionX != null && item.mapPositionY != null ? <View pointerEvents="none" style={[styles.mapMarker, { left: `${String(item.mapPositionX)}%`, top: `${String(item.mapPositionY)}%` }]}><Text style={styles.mapMarkerText}>●</Text></View> : null}</View> : null}
      {section === "handoverPoints" && item.mapPositionX != null && item.mapPositionY != null ? <Text style={styles.helper}>Điểm đánh dấu: X {String(item.mapPositionX)}% · Y {String(item.mapPositionY)}%</Text> : null}
      <View style={styles.actions}><Button title="Chỉnh sửa" variant="secondary" onPress={() => beginEdit(item)} style={styles.flex} /><Button title={item.isActive === false ? "Kích hoạt" : "Ngừng hoạt động"} variant="secondary" loading={busy} onPress={() => void toggleActive(item)} style={styles.flex} /><Button title="Xóa" variant="danger" loading={busy} onPress={() => void remove(item)} style={styles.flex} /></View>
    </Card>)}</View>
  </AppScreen>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; }
function MapMarkerEditor({ uri, x, y, onChange }: { uri: string; x: string; y: string; onChange: (x: number, y: number) => void }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const numericX = Number(x); const numericY = Number(y);
  return <View style={styles.mapEditor} onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} onStartShouldSetResponder={() => true} onResponderRelease={(event) => { if (!size.width || !size.height) return; onChange(Math.round(event.nativeEvent.locationX / size.width * 100), Math.round(event.nativeEvent.locationY / size.height * 100)); }}>
    <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="Ảnh bản đồ điểm bàn giao" />
    {x !== "" && y !== "" ? <View pointerEvents="none" style={[styles.mapMarker, { left: `${numericX}%`, top: `${numericY}%` }]}><Text style={styles.mapMarkerText}>●</Text></View> : null}
  </View>;
}
const styles = StyleSheet.create({ sections: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, section: { minHeight: 38, justifyContent: "center", paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, backgroundColor: colors.surface }, sectionSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, sectionText: { color: colors.muted, fontSize: 12, fontWeight: "700" }, sectionTextSelected: { color: colors.primaryDark }, editor: { gap: spacing.md }, formTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" }, fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, chip: { minHeight: 34, justifyContent: "center", paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, backgroundColor: colors.surface }, chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, chipText: { color: colors.muted, fontSize: 11, fontWeight: "700" }, chipTextSelected: { color: colors.primaryDark }, helper: { color: colors.muted, fontSize: 12 }, coordinateRow: { flexDirection: "row", gap: spacing.md }, formActions: { flexDirection: "row", gap: spacing.sm }, flex: { flex: 1 }, listHeading: { color: colors.ink, fontSize: 16, fontWeight: "800" }, list: { gap: spacing.sm }, item: { gap: spacing.md }, itemTop: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }, itemCopy: { flex: 1, gap: 4 }, itemName: { color: colors.ink, fontSize: 15, fontWeight: "800" }, itemMeta: { color: colors.muted, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: "row", gap: spacing.sm }, mapView: { width: "100%", position: "relative" }, mapPreview: { width: "100%", height: 150, borderRadius: 10, backgroundColor: colors.surfaceMuted }, mapEditor: { width: "100%", height: 180, overflow: "hidden", borderRadius: 10, backgroundColor: colors.surfaceMuted }, mapMarker: { position: "absolute", marginLeft: -10, marginTop: -16 }, mapMarkerText: { color: colors.danger, fontSize: 26, fontWeight: "900", textShadowColor: colors.surface, textShadowRadius: 3 }, });
