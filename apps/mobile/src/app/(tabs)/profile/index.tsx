import { useCallback, useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useNotificationCount } from "@/context/notification-count-context";
import { api, getApiErrorMessage, mediaBlob } from "@/services/api";
import type { MobileUser } from "@/services/api";
import { router } from "expo-router";

type ReputationLevel = "NEW" | "TRUSTED" | "RELIABLE" | "EXCELLENT";
interface ActivitySummary { reputation: { level: ReputationLevel; totalPoints: number } }

const reputationLabels: Record<ReputationLevel, string> = {
  NEW: "Thành viên mới",
  TRUSTED: "Uy tín",
  RELIABLE: "Đáng tin cậy",
  EXCELLENT: "Xuất sắc",
};

function blobToDataUri(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Không đọc được ảnh đại diện"));
    reader.onerror = () => reject(reader.error ?? new Error("Không đọc được ảnh đại diện"));
    reader.readAsDataURL(blob);
  });
}

function profileInitials(user: MobileUser) {
  return user.fullName.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toLocaleUpperCase() ?? "").join("") || "?";
}

export default function ProfileScreen() {
  const { user, isHydrating, logout, updateProfile, updateAvatar } = useAuth();
  const { unreadCount } = useNotificationCount();
  const [profileDraft, setProfileDraft] = useState<{ userId: string; fullName: string; studentCode: string; phoneNumber: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarState, setAvatarState] = useState<{ key: string; uri: string | null } | null>(null);
  const [activityState, setActivityState] = useState<{ userId: string; reputation: ActivitySummary["reputation"] } | null>(null);
  const [error, setError] = useState("");
  const profile = user && profileDraft?.userId === user.id ? profileDraft : {
    userId: user?.id ?? "",
    fullName: user?.fullName ?? "",
    studentCode: user?.studentCode ?? "",
    phoneNumber: user?.phoneNumber ?? "",
  };
  const avatarKey = user ? `${user.id}:${user.avatar.updatedAt ?? "none"}` : "";
  const avatarUri = avatarState?.key === avatarKey ? avatarState.uri : null;
  const reputation = activityState && user && activityState.userId === user.id ? activityState.reputation : null;
  const userId = user?.id;
  const hasAvatar = user?.avatar.hasAvatar;
  const avatarUpdatedAt = user?.avatar.updatedAt;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void api.get<ActivitySummary>("/auth/activity").then(({ data }) => {
      if (active) setActivityState({ userId, reputation: data.reputation });
    }).catch(() => {
      if (active) setActivityState(null);
    });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId || !hasAvatar) return;
    let active = true;
    const timer = setTimeout(() => {
      void mediaBlob("/auth/profile/avatar").then(blobToDataUri).then((uri) => {
        if (active) setAvatarState({ key: avatarKey, uri });
      }).catch(() => {
        if (active) setAvatarState({ key: avatarKey, uri: null });
      });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [userId, hasAvatar, avatarUpdatedAt, avatarKey]);

  const chooseAvatar = useCallback(async () => {
    setError("");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });
    if (result.canceled || !result.assets[0]) return;

    const image = result.assets[0];
    if (image.fileSize && image.fileSize > 1_000_000) {
      setError("Ảnh đại diện cần nhỏ hơn 1 MB. Hãy chọn ảnh khác.");
      return;
    }
    const extension = image.fileName?.split(".").pop()?.toLowerCase();
    const mimeType = image.mimeType ?? (extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg");
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      setError("Ảnh đại diện chỉ hỗ trợ định dạng JPEG, PNG hoặc WEBP.");
      return;
    }
    const fileExtension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const fileName = image.fileName?.trim() || `avatar.${fileExtension}`;
    const previousAvatarUri = avatarUri;
    setAvatarState({ key: avatarKey, uri: image.uri });
    setUploadingAvatar(true);
    try {
      await updateAvatar({ uri: image.uri, name: fileName, type: mimeType });
    } catch (uploadError) {
      setAvatarState({ key: avatarKey, uri: previousAvatarUri });
      setError(getApiErrorMessage(uploadError));
    } finally {
      setUploadingAvatar(false);
    }
  }, [updateAvatar, avatarKey, avatarUri]);

  const saveProfile = async () => {
    if (profile.fullName.trim().length < 2) {
      setError("Họ và tên cần ít nhất 2 ký tự.");
      return;
    }
    setError("");
    setSavingProfile(true);
    try {
      await updateProfile({
        fullName: profile.fullName.trim(),
        studentCode: profile.studentCode.trim() || null,
        phoneNumber: profile.phoneNumber.trim() || null,
      });
      setProfileDraft(null);
      setIsEditing(false);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSavingProfile(false);
    }
  };

  const cancelEditing = () => {
    setProfileDraft(null);
    setIsEditing(false);
    setError("");
  };

  const changeDraft = (field: "fullName" | "studentCode" | "phoneNumber", value: string) => {
    setProfileDraft({ ...profile, [field]: value });
  };

  if (isHydrating || !user) return <LoadingSpinner label="Đang tải hồ sơ…" />;

  return (
    <AppScreen title="Hồ sơ cá nhân" description="Thông tin và cài đặt tài khoản của bạn.">
      <Card style={styles.profileCard}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            {avatarUri ? <Image accessibilityLabel={`Ảnh đại diện của ${user.fullName}`} source={{ uri: avatarUri }} style={styles.avatarImage} /> : <Text style={styles.initials}>{profileInitials(user)}</Text>}
          </View>
          <View style={styles.avatarCopy}>
            <Text style={styles.name}>{user.fullName}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <Button title="Đổi ảnh đại diện" variant="secondary" loading={uploadingAvatar} onPress={() => void chooseAvatar()} style={styles.avatarButton} />
          </View>
        </View>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      <Card style={styles.detailsCard}>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Thông tin tài khoản</Text>{!isEditing ? <Button title="Chỉnh sửa" variant="ghost" onPress={() => { setError(""); setProfileDraft(profile); setIsEditing(true); }} style={styles.smallButton} /> : null}</View>
        {isEditing ? (
          <View style={styles.form}>
            <Input label="Họ và tên" value={profile.fullName} onChangeText={(value) => changeDraft("fullName", value)} maxLength={160} autoCapitalize="words" autoComplete="name" textContentType="name" />
            <Input label="Email" value={user.email} editable={false} />
            <Input label="Mã số sinh viên" value={profile.studentCode} onChangeText={(value) => changeDraft("studentCode", value)} maxLength={40} autoCapitalize="characters" />
            <Input label="Số điện thoại" value={profile.phoneNumber} onChangeText={(value) => changeDraft("phoneNumber", value)} maxLength={30} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
            <View style={styles.actions}>
              <Button title="Lưu thay đổi" loading={savingProfile} onPress={() => void saveProfile()} style={styles.flexButton} />
              <Button title="Hủy" variant="secondary" disabled={savingProfile} onPress={cancelEditing} style={styles.flexButton} />
            </View>
          </View>
        ) : (
          <View style={styles.infoList}>
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Mã số sinh viên" value={user.studentCode || "Chưa cập nhật"} />
            <InfoRow label="Số điện thoại" value={user.phoneNumber || "Chưa cập nhật"} />
            <InfoRow label="Vai trò" value={user.roles.join(" · ")} />
          </View>
        )}
      </Card>

      <Card style={styles.reputationCard}>
        <Text style={styles.sectionTitle}>Cấp độ uy tín</Text>
        <Text style={styles.reputationValue}>{reputation ? reputationLabels[reputation.level] : "Chưa có dữ liệu"}</Text>
        {reputation ? <Text style={styles.reputationPoints}>{reputation.totalPoints} điểm uy tín</Text> : <Text style={styles.email}>Điểm uy tín sẽ hiển thị sau khi tải được hoạt động tài khoản.</Text>}
      </Card>

      <View style={styles.footerActions}>
        <Button title={`Thông báo${unreadCount ? ` (${unreadCount})` : ""}`} variant="secondary" onPress={() => router.push("/notifications" as never)} />
        <Button title="Báo cáo vi phạm" variant="secondary" onPress={() => router.push("/reports" as never)} />
        <Button title="Đăng xuất" variant="danger" onPress={() => void logout()} />
      </View>
    </AppScreen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text selectable style={styles.infoValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  profileCard: { padding: spacing.lg },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  avatar: { width: 88, height: 88, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border },
  avatarImage: { width: "100%", height: "100%" },
  initials: { color: colors.primary, fontSize: 27, fontWeight: "800" },
  avatarCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  name: { color: colors.ink, fontSize: 19, lineHeight: 24, fontWeight: "800" },
  email: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  avatarButton: { alignSelf: "flex-start", marginTop: spacing.xs, minHeight: 42, paddingHorizontal: spacing.md },
  detailsCard: { gap: spacing.lg, padding: spacing.lg },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  smallButton: { minHeight: 42, paddingHorizontal: spacing.sm },
  form: { gap: spacing.md },
  infoList: { gap: spacing.lg },
  infoRow: { gap: spacing.xs },
  infoLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  infoValue: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  reputationCard: { gap: spacing.sm, padding: spacing.lg },
  reputationValue: { color: colors.primary, fontSize: 21, fontWeight: "800" },
  reputationPoints: { color: colors.muted, fontSize: 14 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  flexButton: { flex: 1 },
  footerActions: { gap: spacing.md, paddingBottom: spacing.md },
});
