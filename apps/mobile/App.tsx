import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthApiError, authApi, type AccountRole, type AudienceRole, type AuthUser, type MobileSession } from "./src/auth-api";

const REFRESH_TOKEN_KEY = "lnfs.mobile.refresh.v1";
type AuthPage = "login" | "register" | "forgot" | "reset";

const colors = {
  ink: "#152945",
  muted: "#697C96",
  blue: "#0869C9",
  blueDeep: "#064F9E",
  blueSoft: "#EDF5FF",
  orange: "#F47721",
  green: "#2D9B65",
  line: "#DDE7F2",
  canvas: "#F3F7FC",
  white: "#FFFFFF",
  danger: "#BA3F36"
};

export default function App() {
  const accessToken = useRef<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<AuthPage>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [audienceRole, setAudienceRole] = useState<AudienceRole>("STUDENT");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown(value => Math.max(0, value - 1)), 1_000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      try {
        const savedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (!savedRefreshToken) return;
        const session = await authApi.refresh(savedRefreshToken);
        await storeSession(session);
        const current = await authApi.me(session.accessToken);
        if (mounted) {
          accessToken.current = session.accessToken;
          setUser(current.user);
        }
      } catch (reason) {
        if (reason instanceof AuthApiError && reason.status === 401) {
          await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
        } else if (mounted) {
          setNotice(reason instanceof Error ? reason.message : "Chưa thể khôi phục phiên đăng nhập.");
        }
      } finally {
        if (mounted) setReady(true);
      }
    }
    void restoreSession();
    return () => { mounted = false; };
  }, []);

  async function storeSession(session: MobileSession) {
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
      });
    } catch {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
      await authApi.logout(session.refreshToken).catch(() => undefined);
      throw new Error("Không thể lưu phiên an toàn trên thiết bị. Hãy kiểm tra cấu hình bảo mật của máy.");
    }
    accessToken.current = session.accessToken;
  }

  function clearFeedback() {
    setError("");
    setNotice("");
  }

  function switchPage(next: AuthPage) {
    clearFeedback();
    setPage(next);
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setOtpRequested(false);
    setOtpCountdown(0);
  }

  async function finishAuthentication(session: MobileSession) {
    await storeSession(session);
    setUser(session.user);
    clearFeedback();
    setPassword("");
    setConfirmPassword("");
  }

  async function submitLogin() {
    clearFeedback();
    if (!email.trim() || !password) {
      setError("Nhập email và mật khẩu để tiếp tục.");
      return;
    }
    setBusy(true);
    try {
      await finishAuthentication(await authApi.login(email.trim(), password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đăng nhập.");
    } finally {
      setBusy(false);
    }
  }

  async function requestRegistrationOtp() {
    clearFeedback();
    if (fullName.trim().length < 2 || !email.trim()) {
      setError("Nhập họ tên và email hợp lệ trước khi yêu cầu mã.");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setError("Mật khẩu cần từ 8 đến 72 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setBusy(true);
    try {
      const result = await authApi.requestRegistrationOtp(email.trim());
      setOtpRequested(true);
      setOtpCountdown(30);
      setNotice(`Mã xác thực đã được gửi. Mã hết hạn sau ${result.expiresInMinutes} phút.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi mã xác thực.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRegistration() {
    clearFeedback();
    if (!/^\d{6}$/.test(otp)) {
      setError("Nhập mã xác thực gồm 6 chữ số.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setBusy(true);
    try {
      const session = await authApi.register({
        email: email.trim(), password, fullName: fullName.trim(), audienceRole, otp,
        ...(audienceRole === "STUDENT" && studentCode.trim() ? { studentCode: studentCode.trim() } : {})
      });
      await finishAuthentication(session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo tài khoản.");
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset() {
    clearFeedback();
    if (!email.trim()) {
      setError("Nhập email tài khoản để nhận mã đặt lại mật khẩu.");
      return;
    }
    setBusy(true);
    try {
      const result = await authApi.requestPasswordReset(email.trim());
      setPage("reset");
      setNotice(result.message ?? "Nếu email tồn tại, mã đặt lại mật khẩu đã được gửi.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể yêu cầu đặt lại mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPasswordReset() {
    clearFeedback();
    if (!/^\d{6}$/.test(otp)) {
      setError("Nhập mã xác thực gồm 6 chữ số.");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setError("Mật khẩu mới cần từ 8 đến 72 ký tự.");
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword(email.trim(), otp, password);
      setPage("login");
      setOtp("");
      setPassword("");
      setNotice("Mật khẩu đã được cập nhật. Đăng nhập bằng mật khẩu mới nhé.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    clearFeedback();
    setBusy(true);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null);
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      setNotice("Đã xóa phiên trên thiết bị. Máy chủ chưa xác nhận thu hồi phiên; hãy đăng nhập lại khi có mạng.");
    } finally {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
      accessToken.current = null;
      setUser(null);
      setPage("login");
      setPassword("");
      setBusy(false);
    }
  }

  if (!ready) return <LoadingScreen />;
  if (user) return <AuthenticatedScreen user={user} busy={busy} onLogout={() => void logout()} />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandHeader />
          <HeroScene />
          <View style={styles.authPanel}>
            <Text style={styles.eyebrow}>{pageEyebrow(page)}</Text>
            <Text style={styles.title}>{pageTitle(page)}</Text>
            <Text style={styles.subtitle}>{pageSubtitle(page)}</Text>

            {page === "login" && (
              <>
                <AuthInput icon="mail-outline" label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} returnKeyType="next" />
                <AuthInput icon="lock-closed-outline" label="Mật khẩu" value={password} onChangeText={setPassword} secure={!passwordVisible} toggleSecure={() => setPasswordVisible(value => !value)} autoComplete="current-password" editable={!busy} onSubmitEditing={() => void submitLogin()} />
                <Pressable style={styles.inlineLinkRow} onPress={() => switchPage("forgot")} accessibilityRole="button">
                  <Text style={styles.linkText}>Quên mật khẩu?</Text>
                </Pressable>
                <Feedback error={error} notice={notice} />
                <PrimaryButton title="Đăng nhập" busy={busy} icon="arrow-forward" onPress={() => void submitLogin()} />
                <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>hoặc</Text><View style={styles.dividerLine} /></View>
                <OutlineButton title="Tạo tài khoản" onPress={() => switchPage("register")} />
              </>
            )}

            {page === "register" && (
              <>
                <AuthInput icon="person-outline" label="Họ và tên" value={fullName} onChangeText={setFullName} autoComplete="name" editable={!busy} />
                <AuthInput icon="mail-outline" label="Email nhận mã xác thực" value={email} onChangeText={(value) => { setEmail(value); if (otpRequested) { setOtpRequested(false); setOtp(""); } }} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} />
                <Text style={styles.fieldCaption}>Loại tài khoản</Text>
                <View style={styles.roleOptions} accessibilityRole="radiogroup" accessibilityLabel="Chọn loại tài khoản">
                  <RoleOption title="Sinh viên" detail="Student" selected={audienceRole === "STUDENT"} disabled={busy || otpRequested} onPress={() => setAudienceRole("STUDENT")} />
                  <RoleOption title="Giảng viên" detail="Lecturer" selected={audienceRole === "LECTURER"} disabled={busy || otpRequested} onPress={() => setAudienceRole("LECTURER")} />
                </View>
                {audienceRole === "STUDENT" && <AuthInput icon="id-card-outline" label="Mã số sinh viên (không bắt buộc)" value={studentCode} onChangeText={setStudentCode} autoCapitalize="characters" editable={!busy && !otpRequested} />}
                <AuthInput icon="lock-closed-outline" label="Mật khẩu (tối thiểu 8 ký tự)" value={password} onChangeText={setPassword} secure={!passwordVisible} toggleSecure={() => setPasswordVisible(value => !value)} autoComplete="new-password" editable={!busy} />
                <AuthInput icon="shield-checkmark-outline" label="Xác nhận mật khẩu" value={confirmPassword} onChangeText={setConfirmPassword} secure={!confirmVisible} toggleSecure={() => setConfirmVisible(value => !value)} autoComplete="new-password" editable={!busy} onSubmitEditing={() => otpRequested ? void submitRegistration() : void requestRegistrationOtp()} />
                {otpRequested && (
                  <>
                    <AuthInput icon="keypad-outline" label="Mã xác thực 6 số" value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} editable={!busy} autoComplete="one-time-code" />
                    <Pressable disabled={busy || otpCountdown > 0} onPress={() => void requestRegistrationOtp()} style={styles.resendButton} accessibilityRole="button">
                      <Text style={[styles.linkText, (busy || otpCountdown > 0) && styles.disabledText]}>{otpCountdown > 0 ? `Gửi lại mã sau ${otpCountdown}s` : "Gửi lại mã xác thực"}</Text>
                    </Pressable>
                  </>
                )}
                <Feedback error={error} notice={notice} />
                {otpRequested
                  ? <PrimaryButton title="Tạo tài khoản" busy={busy} icon="person-add-outline" onPress={() => void submitRegistration()} />
                  : <PrimaryButton title="Gửi mã xác thực" busy={busy} icon="mail-outline" onPress={() => void requestRegistrationOtp()} />}
                <View style={styles.switchPrompt}><Text style={styles.switchText}>Đã có tài khoản?</Text><Pressable disabled={busy} onPress={() => switchPage("login")}><Text style={styles.linkText}>Đăng nhập ngay</Text></Pressable></View>
              </>
            )}

            {page === "forgot" && (
              <>
                <AuthInput icon="mail-outline" label="Email tài khoản" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} />
                <Feedback error={error} notice={notice} />
                <PrimaryButton title="Gửi mã đặt lại" busy={busy} icon="mail-outline" onPress={() => void requestPasswordReset()} />
                <BackToLogin busy={busy} onPress={() => switchPage("login")} />
              </>
            )}

            {page === "reset" && (
              <>
                <AuthInput icon="mail-outline" label="Email tài khoản" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!busy} />
                <AuthInput icon="keypad-outline" label="Mã xác thực 6 số" value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" editable={!busy} />
                <AuthInput icon="lock-closed-outline" label="Mật khẩu mới" value={password} onChangeText={setPassword} secure={!passwordVisible} toggleSecure={() => setPasswordVisible(value => !value)} autoComplete="new-password" editable={!busy} />
                <Feedback error={error} notice={notice} />
                <PrimaryButton title="Cập nhật mật khẩu" busy={busy} icon="checkmark" onPress={() => void submitPasswordReset()} />
                <BackToLogin busy={busy} onPress={() => switchPage("login")} />
              </>
            )}
          </View>
          <Text style={styles.footer}>FPTU Đà Nẵng · Xác thực tài khoản an toàn</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LoadingScreen() {
  return (
    <SafeAreaView style={[styles.safeArea, styles.centerContent]}>
      <StatusBar style="dark" />
      <ActivityIndicator size="large" color={colors.blue} />
      <Text style={styles.loadingText}>Đang xác thực phiên đăng nhập...</Text>
    </SafeAreaView>
  );
}

function BrandHeader() {
  return (
    <View style={styles.brandHeader}>
      <View style={styles.logoMark} accessibilityLabel="FPT">
        <View style={[styles.logoTile, { backgroundColor: colors.blue }]}><Text style={styles.logoLetter}>F</Text></View>
        <View style={[styles.logoTile, { backgroundColor: colors.orange }]}><Text style={styles.logoLetter}>P</Text></View>
        <View style={[styles.logoTile, { backgroundColor: colors.green }]}><Text style={styles.logoLetter}>T</Text></View>
      </View>
      <Text style={styles.brandTitle}>FPTU Lost & Found</Text>
      <Text style={styles.brandSubtitle}>Đà Nẵng · Kết nối để tìm lại</Text>
    </View>
  );
}

function HeroScene() {
  return (
    <View style={styles.heroScene} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.campusBuilding} />
      <View style={styles.campusWindows}>
        <View style={styles.campusWindow} /><View style={styles.campusWindow} />
        <View style={styles.campusWindow} /><View style={styles.campusWindow} />
      </View>
      <View style={styles.campusTreeOne} />
      <View style={styles.campusTreeTwo} />
      <View style={styles.itemCard}>
        <View style={styles.itemIcon}><Ionicons name="bag-handle-outline" size={37} color={colors.blue} /></View>
        <View style={styles.itemLines}><View style={styles.itemLine} /><View style={styles.itemLine} /></View>
      </View>
      <View style={styles.searchBadge}><Ionicons name="search" size={22} color={colors.white} /></View>
      <View style={styles.sceneGround} />
      <View style={styles.sceneLabel}><Ionicons name="shield-checkmark" size={14} color={colors.green} /><Text>Đăng nhập an toàn</Text></View>
    </View>
  );
}

function AuthInput({
  icon, label, value, onChangeText, secure = false, toggleSecure, keyboardType, autoCapitalize = "none", autoComplete, editable = true, maxLength, returnKeyType, onSubmitEditing
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  toggleSecure?: () => void;
  keyboardType?: "default" | "email-address" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "name" | "current-password" | "new-password" | "one-time-code";
  editable?: boolean;
  maxLength?: number;
  returnKeyType?: "done" | "next" | "go";
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={[styles.inputWrap, !editable && styles.inputDisabled]}>
      <Ionicons name={icon} size={19} color={colors.muted} style={styles.inputIcon} />
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor="#8998AA"
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType ?? "default"}
        secureTextEntry={secure}
        autoComplete={autoComplete}
        editable={editable}
        maxLength={maxLength}
        returnKeyType={returnKeyType ?? "done"}
        onSubmitEditing={onSubmitEditing}
        textContentType={autoComplete === "current-password" ? "password" : autoComplete === "new-password" ? "newPassword" : undefined}
      />
      {toggleSecure && (
        <Pressable accessibilityRole="button" accessibilityLabel={secure ? "Hiện mật khẩu" : "Ẩn mật khẩu"} onPress={toggleSecure} style={styles.visibilityButton}>
          <Ionicons name={secure ? "eye-outline" : "eye-off-outline"} size={20} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

function RoleOption({ title, detail, selected, disabled, onPress }: { title: string; detail: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.roleOption, selected && styles.roleOptionSelected, disabled && styles.inputDisabled]}
    >
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>{selected && <View style={styles.radioInner} />}</View>
      <View><Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>{title}</Text><Text style={styles.roleDetail}>{detail}</Text></View>
    </Pressable>
  );
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  if (!error && !notice) return null;
  const isError = Boolean(error);
  return (
    <View accessibilityRole={isError ? "alert" : "summary"} style={[styles.feedback, isError ? styles.feedbackError : styles.feedbackNotice]}>
      <Ionicons name={isError ? "alert-circle-outline" : "checkmark-circle-outline"} size={19} color={isError ? colors.danger : colors.green} />
      <Text style={[styles.feedbackText, isError && styles.errorText]}>{error || notice}</Text>
    </View>
  );
}

function PrimaryButton({ title, busy, icon, onPress }: { title: string; busy: boolean; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && !busy && styles.buttonPressed, busy && styles.buttonDisabled]}>
      {busy ? <ActivityIndicator color={colors.white} /> : <><Text style={styles.primaryButtonText}>{title}</Text><Ionicons name={icon} size={19} color={colors.white} /></>}
    </Pressable>
  );
}

function OutlineButton({ title, onPress }: { title: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.outlineButton, pressed && styles.outlinePressed]}><Text style={styles.outlineButtonText}>{title}</Text></Pressable>;
}

function BackToLogin({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={styles.backLink}><Ionicons name="arrow-back" size={17} color={colors.blue} /><Text style={styles.linkText}>Quay lại đăng nhập</Text></Pressable>;
}

function AuthenticatedScreen({ user, busy, onLogout }: { user: AuthUser; busy: boolean; onLogout: () => void }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.signedInContent} showsVerticalScrollIndicator={false}>
        <BrandHeader />
        <View style={styles.signedInPanel}>
          <View style={styles.successIcon}><Ionicons name="checkmark" size={35} color={colors.white} /></View>
          <Text style={styles.eyebrow}>XÁC THỰC HOÀN TẤT</Text>
          <Text style={styles.title}>Xin chào, {user.fullName}</Text>
          <Text style={styles.subtitle}>Tài khoản đã đăng nhập an toàn trên thiết bị này.</Text>
          <View style={styles.identityRow}><Ionicons name="mail-outline" size={18} color={colors.blue} /><Text style={styles.identityText}>{user.email}</Text></View>
          <Text style={styles.fieldCaption}>Vai trò từ hệ thống</Text>
          <View style={styles.roleBadges}>{user.roles.map(role => <RoleBadge key={role} role={role} />)}</View>
          <View style={styles.permissionNote}>
            <Ionicons name="shield-checkmark-outline" size={19} color={colors.blue} />
            <Text style={styles.permissionText}>Quyền được máy chủ xác định. Phiên bản mobile hiện tại chỉ gồm xác thực tài khoản.</Text>
          </View>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onLogout} style={[styles.logoutButton, busy && styles.buttonDisabled]}>
            {busy ? <ActivityIndicator color={colors.blue} /> : <><Ionicons name="log-out-outline" size={19} color={colors.blue} /><Text style={styles.logoutText}>Đăng xuất</Text></>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RoleBadge({ role }: { role: AccountRole }) {
  const details: Record<AccountRole, { label: string; color: string; background: string }> = {
    USER: { label: "Người dùng", color: colors.blueDeep, background: colors.blueSoft },
    STUDENT: { label: "Sinh viên", color: colors.blueDeep, background: colors.blueSoft },
    LECTURER: { label: "Giảng viên", color: "#296E4A", background: "#EAF7EF" },
    STAFF: { label: "Nhân viên", color: "#9B4B00", background: "#FFF2E6" },
    ADMIN: { label: "Quản trị viên", color: "#8E3150", background: "#FCEEF3" }
  };
  const value = details[role];
  return <View style={[styles.roleBadge, { backgroundColor: value.background }]}><Text style={[styles.roleBadgeText, { color: value.color }]}>{value.label}</Text></View>;
}

function pageEyebrow(page: AuthPage) {
  return ({ login: "TÀI KHOẢN FPTU", register: "TẠO TÀI KHOẢN", forgot: "KHÔI PHỤC TÀI KHOẢN", reset: "BẢO MẬT TÀI KHOẢN" })[page];
}

function pageTitle(page: AuthPage) {
  return ({ login: "Đăng nhập", register: "Đăng ký", forgot: "Quên mật khẩu?", reset: "Đặt mật khẩu mới" })[page];
}

function pageSubtitle(page: AuthPage) {
  return ({
    login: "Chào mừng bạn quay trở lại.",
    register: "Xác thực email để tạo tài khoản FPTU Lost & Found.",
    forgot: "Nhập email đã đăng ký để nhận mã xác thực.",
    reset: "Mã được gửi qua email và chỉ sử dụng một lần."
  })[page];
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 26, alignItems: "center" },
  signedInContent: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28, alignItems: "center" },
  centerContent: { alignItems: "center", justifyContent: "center" },
  loadingText: { color: colors.muted, fontSize: 14, marginTop: 14 },
  brandHeader: { width: "100%", maxWidth: 440, alignItems: "center", paddingTop: 4, paddingBottom: 17 },
  logoMark: { height: 39, flexDirection: "row", borderRadius: 9, overflow: "hidden", marginBottom: 9 },
  logoTile: { width: 34, alignItems: "center", justifyContent: "center" },
  logoLetter: { color: colors.white, fontSize: 23, fontWeight: "900", fontStyle: "italic" },
  brandTitle: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  brandSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  heroScene: { width: "100%", maxWidth: 440, height: 122, overflow: "hidden", borderRadius: 18, backgroundColor: "#E2F0FC", marginBottom: 14, position: "relative" },
  campusBuilding: { position: "absolute", right: 17, top: 17, width: 102, height: 70, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: "#C9E0F4", borderBottomWidth: 4, borderBottomColor: "#AACDE8" },
  campusWindows: { position: "absolute", right: 31, top: 29, width: 73, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  campusWindow: { width: 30, height: 13, backgroundColor: "#F7FBFF", borderWidth: 1, borderColor: "#AACDE8" },
  campusTreeOne: { position: "absolute", right: 121, top: 33, width: 26, height: 38, backgroundColor: "#9BCDAE", borderRadius: 16 },
  campusTreeTwo: { position: "absolute", right: 130, top: 64, width: 5, height: 22, backgroundColor: "#8F805E" },
  itemCard: { position: "absolute", left: 30, top: 21, width: 128, height: 76, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: "#D8E5F1", flexDirection: "row", alignItems: "center", paddingHorizontal: 10, shadowColor: "#22486D", shadowOpacity: 0.09, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  itemIcon: { width: 53, height: 53, borderRadius: 12, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  itemLines: { flex: 1, gap: 8, marginLeft: 9 },
  itemLine: { height: 7, borderRadius: 5, backgroundColor: "#DDE7F2" },
  sceneGround: { position: "absolute", bottom: 0, left: 0, right: 0, height: 20, backgroundColor: "#F5FAFF" },
  searchBadge: { position: "absolute", left: 145, top: 9, width: 38, height: 38, borderRadius: 12, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", zIndex: 2 },
  sceneLabel: { position: "absolute", right: 12, bottom: 5, zIndex: 3, flexDirection: "row", alignItems: "center", gap: 5 },
  authPanel: { width: "100%", maxWidth: 440, backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 21, shadowColor: "#274E77", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  eyebrow: { color: colors.orange, fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 27, lineHeight: 34, fontWeight: "800", marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 18 },
  inputWrap: { minHeight: 54, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", marginTop: 11, paddingHorizontal: 13 },
  inputDisabled: { opacity: 0.56 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, minHeight: 52, color: colors.ink, fontSize: 15, paddingVertical: 0 },
  visibilityButton: { minWidth: 40, minHeight: 48, alignItems: "center", justifyContent: "center", marginRight: -8 },
  inlineLinkRow: { alignSelf: "flex-end", paddingVertical: 11 },
  linkText: { color: colors.blue, fontSize: 14, fontWeight: "700" },
  fieldCaption: { color: colors.ink, fontSize: 13, fontWeight: "700", marginTop: 17, marginBottom: 8 },
  roleOptions: { flexDirection: "row", gap: 9 },
  roleOption: { flex: 1, minHeight: 59, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 9 },
  roleOptionSelected: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: "#8292A7", alignItems: "center", justifyContent: "center" },
  radioOuterSelected: { borderColor: colors.blue },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.blue },
  roleTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  roleTitleSelected: { color: colors.blueDeep },
  roleDetail: { color: colors.muted, fontSize: 11, marginTop: 2 },
  resendButton: { alignSelf: "flex-end", paddingVertical: 10 },
  disabledText: { color: "#93A0B0" },
  feedback: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, padding: 11, marginTop: 12 },
  feedbackError: { backgroundColor: "#FFF1EF" },
  feedbackNotice: { backgroundColor: "#EFF8F2" },
  feedbackText: { flex: 1, color: "#236844", fontSize: 13, lineHeight: 19 },
  errorText: { color: colors.danger },
  primaryButton: { minHeight: 54, borderRadius: 12, backgroundColor: colors.orange, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12 },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  buttonPressed: { backgroundColor: "#D95E11", transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.66 },
  divider: { flexDirection: "row", alignItems: "center", gap: 11, marginVertical: 15 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { color: colors.muted, fontSize: 13 },
  outlineButton: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.orange, alignItems: "center", justifyContent: "center" },
  outlinePressed: { backgroundColor: "#FFF6EF" },
  outlineButtonText: { color: colors.orange, fontSize: 15, fontWeight: "800" },
  switchPrompt: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 18 },
  switchText: { color: colors.muted, fontSize: 13 },
  backLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },
  footer: { color: colors.muted, fontSize: 11, textAlign: "center", paddingTop: 14 },
  signedInPanel: { width: "100%", maxWidth: 440, backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 23, alignItems: "center", marginTop: 9 },
  successIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  identityRow: { minHeight: 46, alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, marginTop: 7, borderRadius: 11, backgroundColor: colors.blueSoft },
  identityText: { color: colors.ink, fontSize: 14, flexShrink: 1 },
  roleBadges: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleBadge: { minHeight: 32, justifyContent: "center", paddingHorizontal: 12, borderRadius: 16 },
  roleBadgeText: { fontSize: 12, fontWeight: "700" },
  permissionNote: { alignSelf: "stretch", flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#F2F7FC", borderRadius: 12, padding: 13, marginTop: 20 },
  permissionText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },
  logoutButton: { minHeight: 51, alignSelf: "stretch", borderWidth: 1, borderColor: "#BCD3EC", borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 },
  logoutText: { color: colors.blueDeep, fontSize: 15, fontWeight: "800" }
});
