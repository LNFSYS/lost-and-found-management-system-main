import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, radii, spacing } from "@/constants/theme";
import type { PostCatalog } from "@/services/api";

export interface CampusLocationPickerErrors {
  areaId?: string;
  buildingId?: string;
  roomText?: string;
  customLocation?: string;
  handoverPointId?: string;
  contactInfo?: string;
}

export interface CampusLocationPickerProps {
  postType: "LOST" | "FOUND";
  areas: PostCatalog["areas"];
  buildings: PostCatalog["buildings"];
  handoverPoints?: PostCatalog["handoverPoints"];
  selectedAreaId: string | null;
  onSelectAreaId: (areaId: string | null) => void;
  selectedBuildingId: string | null;
  onSelectBuildingId: (buildingId: string | null) => void;
  roomText: string;
  onChangeRoomText: (text: string) => void;
  customLocation: string;
  onChangeCustomLocation: (text: string) => void;
  selectedHandoverPointId?: string | null;
  onSelectHandoverPointId?: (id: string | null) => void;
  contactInfo: string;
  onChangeContactInfo: (text: string) => void;
  disabled?: boolean;
  errors?: CampusLocationPickerErrors;
}

interface SelectOption {
  id: string;
  title: string;
  subtitle?: string;
}

interface SimplePickerSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: SelectOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  allowClear?: boolean;
  clearLabel?: string;
  emptyLabel?: string;
}

function SimplePickerSheet({
  visible,
  title,
  subtitle,
  options,
  selectedId,
  onSelect,
  onClose,
  allowClear = false,
  clearLabel = "Bỏ chọn",
  emptyLabel = "Không có dữ liệu",
}: SimplePickerSheetProps) {
  const [filterText, setFilterText] = useState("");

  const filteredOptions = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.title.toLowerCase().includes(q) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(q))
    );
  }, [options, filterText]);

  const handleClose = () => {
    setFilterText("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={sheetStyles.backdrop}>
        <Pressable style={sheetStyles.backdropDismiss} onPress={handleClose} />
        <View style={sheetStyles.sheet}>
          <SafeAreaView edges={["bottom"]}>
            <View style={sheetStyles.handleBar} />
            <View style={sheetStyles.header}>
              <View style={sheetStyles.headerTitles}>
                <Text style={sheetStyles.title}>{title}</Text>
                {subtitle ? (
                  <Text style={sheetStyles.subtitle}>{subtitle}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={handleClose}
                hitSlop={10}
                style={sheetStyles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Đóng lựa chọn"
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>

            {options.length > 5 ? (
              <View style={sheetStyles.searchBox}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={18}
                  color={colors.muted}
                />
                <TextInput
                  style={sheetStyles.searchInput}
                  placeholder="Tìm kiếm..."
                  placeholderTextColor={colors.muted}
                  value={filterText}
                  onChangeText={setFilterText}
                />
              </View>
            ) : null}

            <ScrollView
              style={sheetStyles.list}
              contentContainerStyle={sheetStyles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {allowClear && selectedId ? (
                <Pressable
                  onPress={() => {
                    onSelect(null);
                    handleClose();
                  }}
                  style={sheetStyles.clearOption}
                >
                  <MaterialCommunityIcons
                    name="close-circle-outline"
                    size={20}
                    color={colors.danger}
                  />
                  <Text style={sheetStyles.clearOptionText}>{clearLabel}</Text>
                </Pressable>
              ) : null}

              {filteredOptions.length === 0 ? (
                <View style={sheetStyles.emptyState}>
                  <Text style={sheetStyles.emptyText}>{emptyLabel}</Text>
                </View>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.id === selectedId;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => {
                        onSelect(opt.id);
                        handleClose();
                      }}
                      style={({ pressed }) => [
                        sheetStyles.optionItem,
                        isSelected && sheetStyles.optionItemSelected,
                        pressed && sheetStyles.optionItemPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={opt.title}
                    >
                      <View style={sheetStyles.optionTextContainer}>
                        <Text
                          style={[
                            sheetStyles.optionTitle,
                            isSelected && sheetStyles.optionTitleSelected,
                          ]}
                        >
                          {opt.title}
                        </Text>
                        {opt.subtitle ? (
                          <Text style={sheetStyles.optionSubtitle}>
                            {opt.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected ? (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={20}
                          color={colors.primary}
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="circle-outline"
                          size={20}
                          color={colors.border}
                        />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

export function CampusLocationPicker({
  postType,
  areas,
  buildings,
  handoverPoints = [],
  selectedAreaId,
  onSelectAreaId,
  selectedBuildingId,
  onSelectBuildingId,
  roomText,
  onChangeRoomText,
  customLocation,
  onChangeCustomLocation,
  selectedHandoverPointId,
  onSelectHandoverPointId,
  contactInfo,
  onChangeContactInfo,
  disabled = false,
  errors,
}: CampusLocationPickerProps) {
  const [areaModalVisible, setAreaModalVisible] = useState(false);
  const [buildingModalVisible, setBuildingModalVisible] = useState(false);

  // Map areas to options
  const areaOptions: SelectOption[] = useMemo(
    () =>
      areas.map((a) => ({
        id: a.id,
        title: a.name,
      })),
    [areas]
  );

  // Filter buildings by selected area
  const filteredBuildings = useMemo(() => {
    if (!selectedAreaId) return [];
    return buildings.filter((b) => b.areaId === selectedAreaId);
  }, [buildings, selectedAreaId]);

  const buildingOptions: SelectOption[] = useMemo(
    () =>
      filteredBuildings.map((b) => ({
        id: b.id,
        title: b.name,
      })),
    [filteredBuildings]
  );

  const selectedArea = areas.find((a) => a.id === selectedAreaId);
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);

  const handleSelectArea = (areaId: string | null) => {
    onSelectAreaId(areaId);
    // If current building does not belong to new area, reset building
    if (selectedBuildingId) {
      const b = buildings.find((item) => item.id === selectedBuildingId);
      if (!b || b.areaId !== areaId) {
        onSelectBuildingId(null);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons
            name="map-marker-radius-outline"
            size={22}
            color={colors.primary}
          />
          <Text style={styles.sectionTitle}>Địa điểm & Liên hệ</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Cung cấp vị trí càng cụ thể giúp người khác hoặc bảo vệ hỗ trợ dễ dàng
        </Text>
      </View>

      {/* Row: Area Picker & Building Picker */}
      <View style={styles.pickerRow}>
        {/* Area Field */}
        <View style={styles.pickerFieldHalf}>
          <Text style={styles.fieldLabel}>Khu vực campus</Text>
          <Pressable
            disabled={disabled}
            onPress={() => setAreaModalVisible(true)}
            style={({ pressed }) => [
              styles.selectorTrigger,
              Boolean(errors?.areaId) && styles.fieldErrorBorder,
              disabled && styles.disabledTrigger,
              pressed && !disabled && styles.pressedTrigger,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              selectedArea ? `Khu vực: ${selectedArea.name}` : "Chọn khu vực"
            }
          >
            <View style={styles.selectorTriggerContent}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={18}
                color={selectedArea ? colors.primary : colors.muted}
              />
              <Text
                style={[
                  styles.selectorTriggerText,
                  !selectedArea && styles.selectorPlaceholder,
                ]}
                numberOfLines={1}
              >
                {selectedArea ? selectedArea.name : "Chọn khu vực..."}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-down"
              size={18}
              color={colors.muted}
            />
          </Pressable>
          {errors?.areaId ? (
            <Text style={styles.errorText}>{errors.areaId}</Text>
          ) : null}
        </View>

        {/* Building Field */}
        <View style={styles.pickerFieldHalf}>
          <Text style={styles.fieldLabel}>Tòa nhà</Text>
          <Pressable
            disabled={disabled || !selectedAreaId}
            onPress={() => setBuildingModalVisible(true)}
            style={({ pressed }) => [
              styles.selectorTrigger,
              Boolean(errors?.buildingId) && styles.fieldErrorBorder,
              (!selectedAreaId || disabled) && styles.disabledTrigger,
              pressed && !disabled && Boolean(selectedAreaId) && styles.pressedTrigger,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              selectedBuilding ? `Tòa nhà: ${selectedBuilding.name}` : "Chọn tòa nhà"
            }
          >
            <View style={styles.selectorTriggerContent}>
              <MaterialCommunityIcons
                name="office-building-outline"
                size={18}
                color={selectedBuilding ? colors.primary : colors.muted}
              />
              <Text
                style={[
                  styles.selectorTriggerText,
                  !selectedBuilding && styles.selectorPlaceholder,
                ]}
                numberOfLines={1}
              >
                {selectedBuilding
                  ? selectedBuilding.name
                  : selectedAreaId
                  ? "Chọn tòa..."
                  : "Chờ chọn khu"}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-down"
              size={18}
              color={colors.muted}
            />
          </Pressable>
          {errors?.buildingId ? (
            <Text style={styles.errorText}>{errors.buildingId}</Text>
          ) : null}
        </View>
      </View>

      {/* Room / Specific Location Text Input (Max 100 chars) */}
      <View style={styles.inputGroup}>
        <View style={styles.inputLabelRow}>
          <Text style={styles.fieldLabel}>Phòng / Vị trí cụ thể trong tòa</Text>
          <Text style={styles.charCounter}>{(roomText || "").length}/100</Text>
        </View>
        <View
          style={[
            styles.inputWrapper,
            Boolean(errors?.roomText) && styles.fieldErrorBorder,
          ]}
        >
          <MaterialCommunityIcons
            name="door-open"
            size={20}
            color={colors.muted}
            style={styles.inputLeadingIcon}
          />
          <TextInput
            style={styles.textInput}
            value={roomText || ""}
            onChangeText={(t) => onChangeRoomText((t || "").slice(0, 100))}
            placeholder="Ví dụ: P.302, Thư viện tầng 2 bàn 14, Căn tin..."
            placeholderTextColor={colors.muted}
            editable={!disabled}
            maxLength={100}
          />
        </View>
        {errors?.roomText ? (
          <Text style={styles.errorText}>{errors.roomText}</Text>
        ) : null}
      </View>

      {/* Custom Location / Outside Campus Input (Max 255 chars) */}
      <View style={styles.inputGroup}>
        <View style={styles.inputLabelRow}>
          <Text style={styles.fieldLabel}>Vị trí khác / Ngoài campus (nếu có)</Text>
          <Text style={styles.charCounter}>{(customLocation || "").length}/255</Text>
        </View>
        <View
          style={[
            styles.inputWrapper,
            Boolean(errors?.customLocation) && styles.fieldErrorBorder,
          ]}
        >
          <MaterialCommunityIcons
            name="compass-outline"
            size={20}
            color={colors.muted}
            style={styles.inputLeadingIcon}
          />
          <TextInput
            style={styles.textInput}
            value={customLocation || ""}
            onChangeText={(t) => onChangeCustomLocation((t || "").slice(0, 255))}
            placeholder="Ví dụ: Quán cafe cổng sau, bãi đỗ xe máy đối diện cổng 1..."
            placeholderTextColor={colors.muted}
            editable={!disabled}
            maxLength={255}
          />
        </View>
        {errors?.customLocation ? (
          <Text style={styles.errorText}>{errors.customLocation}</Text>
        ) : null}
      </View>

      {/* FOUND Post Only: Handover Point Section */}
      {postType === "FOUND" && (
        <View style={styles.handoverSection}>
          <View style={styles.handoverHeader}>
            <View style={styles.handoverTitleRow}>
              <MaterialCommunityIcons
                name="shield-check"
                size={20}
                color={colors.success}
              />
              <Text style={styles.handoverTitle}>Điểm bàn giao hiện vật</Text>
            </View>
            <View style={styles.recommendBadge}>
              <Text style={styles.recommendBadgeText}>Khuyên dùng</Text>
            </View>
          </View>
          <Text style={styles.handoverSubtitle}>
            Gửi đồ tại các quầy trực bảo vệ / Dịch vụ Sinh viên để đảm bảo an
            toàn và bảo vệ quyền sở hữu của người mất.
          </Text>

          {/* Handover Points List */}
          <View style={styles.handoverList}>
            {handoverPoints.map((hp) => {
              const isSelected = selectedHandoverPointId === hp.id;
              return (
                <Pressable
                  key={hp.id}
                  disabled={disabled}
                  onPress={() => onSelectHandoverPointId?.(hp.id)}
                  style={({ pressed }) => [
                    styles.handoverCard,
                    isSelected && styles.handoverCardSelected,
                    pressed && !disabled && styles.pressedTrigger,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${hp.name}, địa chỉ: ${hp.address}`}
                >
                  <View style={styles.handoverRadioBox}>
                    <View
                      style={[
                        styles.handoverRadio,
                        isSelected && styles.handoverRadioActive,
                      ]}
                    >
                      {isSelected ? (
                        <MaterialCommunityIcons
                          name="check"
                          size={12}
                          color={colors.surface}
                        />
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.handoverCardInfo}>
                    <Text
                      style={[
                        styles.handoverPointName,
                        isSelected && styles.handoverPointNameSelected,
                      ]}
                    >
                      {hp.name}
                    </Text>
                    <View style={styles.handoverDetailRow}>
                      <MaterialCommunityIcons
                        name="map-marker-outline"
                        size={14}
                        color={colors.muted}
                      />
                      <Text style={styles.handoverDetailText} numberOfLines={2}>
                        {hp.address}
                      </Text>
                    </View>
                    {hp.openingHours ? (
                      <View style={styles.handoverDetailRow}>
                        <MaterialCommunityIcons
                          name="clock-outline"
                          size={14}
                          color={colors.muted}
                        />
                        <Text style={styles.handoverDetailText}>
                          {hp.openingHours}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}

            {/* Option to keep temporarily */}
            <Pressable
              disabled={disabled}
              onPress={() => onSelectHandoverPointId?.(null)}
              style={({ pressed }) => [
                styles.handoverCard,
                selectedHandoverPointId === null && styles.handoverCardSelected,
                pressed && !disabled && styles.pressedTrigger,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedHandoverPointId === null }}
            >
              <View style={styles.handoverRadioBox}>
                <View
                  style={[
                    styles.handoverRadio,
                    selectedHandoverPointId === null && styles.handoverRadioActive,
                  ]}
                >
                  {selectedHandoverPointId === null ? (
                    <MaterialCommunityIcons
                      name="check"
                      size={12}
                      color={colors.surface}
                    />
                  ) : null}
                </View>
              </View>
              <View style={styles.handoverCardInfo}>
                <Text style={styles.handoverPointName}>
                  Tôi tạm giữ hiện vật
                </Text>
                <Text style={styles.handoverDetailText}>
                  Chưa bàn giao cho quầy tiếp nhận (tôi sẽ tự liên hệ người nhận)
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      )}

      {/* Contact Info Input */}
      <View style={styles.inputGroup}>
        <View style={styles.inputLabelRow}>
          <Text style={styles.fieldLabel}>Thông tin liên hệ</Text>
          <Text style={styles.requiredMark}>*</Text>
        </View>
        <Text style={styles.inputHelpText}>
          SĐT, Zalo hoặc Email để người khác hoặc bảo vệ liên hệ đối chiếu
        </Text>
        <View
          style={[
            styles.inputWrapper,
            Boolean(errors?.contactInfo) && styles.fieldErrorBorder,
          ]}
        >
          <MaterialCommunityIcons
            name="card-account-phone-outline"
            size={20}
            color={colors.muted}
            style={styles.inputLeadingIcon}
          />
          <TextInput
            style={styles.textInput}
            value={contactInfo}
            onChangeText={onChangeContactInfo}
            placeholder="Ví dụ: 0912 345 678 (Zalo) hoặc email@fpt.edu.vn"
            placeholderTextColor={colors.muted}
            editable={!disabled}
            keyboardType="default"
          />
        </View>
        {errors?.contactInfo ? (
          <Text style={styles.errorText}>{errors.contactInfo}</Text>
        ) : null}
      </View>

      {/* Area Selector Sheet */}
      <SimplePickerSheet
        visible={areaModalVisible}
        title="Chọn khu vực Campus"
        subtitle="Chọn phân khu nơi xảy ra sự việc hoặc tìm thấy đồ"
        options={areaOptions}
        selectedId={selectedAreaId}
        onSelect={handleSelectArea}
        onClose={() => setAreaModalVisible(false)}
        allowClear
        clearLabel="Bỏ chọn khu vực"
        emptyLabel="Không có khu vực nào"
      />

      {/* Building Selector Sheet */}
      <SimplePickerSheet
        visible={buildingModalVisible}
        title={`Tòa nhà thuộc ${selectedArea?.name ?? "khu vực"}`}
        subtitle="Chọn tòa nhà cụ thể trong phân khu đã chọn"
        options={buildingOptions}
        selectedId={selectedBuildingId}
        onSelect={onSelectBuildingId}
        onClose={() => setBuildingModalVisible(false)}
        allowClear
        clearLabel="Bỏ chọn tòa nhà"
        emptyLabel="Không có tòa nhà nào trong khu vực này"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  sectionHeader: {
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  pickerRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  pickerFieldHalf: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  selectorTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    paddingHorizontal: spacing.sm,
    height: 48,
  },
  selectorTriggerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 4,
  },
  selectorTriggerText: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: "500",
  },
  selectorPlaceholder: {
    color: colors.muted,
    fontWeight: "400",
  },
  disabledTrigger: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.65,
  },
  pressedTrigger: {
    opacity: 0.8,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  requiredMark: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.danger,
    marginLeft: 2,
  },
  charCounter: {
    fontSize: 12,
    color: colors.muted,
  },
  inputHelpText: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 16,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  inputLeadingIcon: {
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    height: "100%",
  },
  fieldErrorBorder: {
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
  },
  handoverSection: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  handoverHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  handoverTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  handoverTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.success,
  },
  recommendBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.success,
  },
  recommendBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.success,
  },
  handoverSubtitle: {
    fontSize: 13,
    color: "#166534",
    lineHeight: 18,
  },
  handoverList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  handoverCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  handoverCardSelected: {
    borderColor: colors.success,
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
  },
  handoverRadioBox: {
    paddingTop: 2,
  },
  handoverRadio: {
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  handoverRadioActive: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  handoverCardInfo: {
    flex: 1,
    gap: 3,
  },
  handoverPointName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  handoverPointNameSelected: {
    color: "#166534",
  },
  handoverDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  handoverDetailText: {
    fontSize: 12,
    color: colors.muted,
    flex: 1,
    lineHeight: 16,
  },
});

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitles: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 40,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  clearOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.control,
    marginBottom: spacing.xs,
  },
  clearOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.danger,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  optionItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionItemPressed: {
    opacity: 0.8,
  },
  optionTextContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  optionTitleSelected: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  optionSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
  },
});