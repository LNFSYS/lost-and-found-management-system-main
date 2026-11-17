import { useState } from "react";
import { Redirect, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
import { AudienceRolePicker, type AudienceRole } from "@/components/audience-role-picker";
import { OtpCodeInput } from "@/components/otp-code-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PasswordInput } from "@/components/ui/password-input";
import { SuccessBanner } from "@/components/ui/success-banner";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { api, getApiErrorMessage } from "@/services/api";
import { homeRouteFor } from "@/services/auth-routing";

function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }

export default function RegisterScreen() {
  const { user, isHydrating, register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [audienceRole, setAudienceRole] = useState<AudienceRole>("STUDENT");
  const [otpRequestedFor, setOtpRequestedFor] = useState("");
  const [expiryMinutes, setExpiryMinutes] = useState<number | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [serverError, setServerError] = useState("");

  if (isHydrating) return <LoadingSpinner label="Đang kiểm tra phiên…" />;
  if (user) return <Redirect href={homeRouteFor(user)} />;

  const requestOtp = async () => {
    const normalizedEmail = email.trim();
    if (!validEmail(normalizedEmail)) {
      setFieldError("Vui lòng nhập email hợp lệ");
      return;
    }
    setFieldError("");
    setServerError("");
    setSendingOtp(true);
    try {
      const { data } = await api.post<{ expiresInMinutes?: number }>("/auth/register/request-otp", { email: normalizedEmail });
      setOtpRequestedFor(normalizedEmail);
      setOtp("");
      setExpiryMinutes(data.expiresInMinutes ?? null);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setSendingOtp(false);
    }
  };

  const submit = async () => {
    const normalizedEmail = email.trim();
    if (fullName.trim().length < 2) { setFieldError("Họ và tên cần ít nhất 2 ký tự"); return; }
    if (!validEmail(normalizedEmail)) { setFieldError("Vui lòng nhập email hợp lệ"); return; }
    if (otpRequestedFor !== normalizedEmail) { setFieldError("Hãy gửi mã xác thực tới email này trước"); return; }
    if (!/^\d{6}$/.test(otp)) { setFieldError("Mã xác thực gồm đúng 6 chữ số"); return; }
    if (password.length < 8) { setFieldError("Mật khẩu cần ít nhất 8 ký tự"); return; }
    if (password.length > 72) { setFieldError("Mật khẩu không được dài hơn 72 ký tự"); return; }
    setFieldError("");
    setServerError("");
    setSubmitting(true);
    try {
      const newUser = await register({ fullName: fullName.trim(), email: normalizedEmail, otp, password, audienceRole });
      router.replace(homeRouteFor(newUser));
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const updateEmail = (value: string) => {
    setEmail(value);
    setFieldError("");
    if (otpRequestedFor && value.trim() !== otpRequestedFor) {
      setOtpRequestedFor("");
      setOtp("");
      setExpiryMinutes(null);
    }
  };

  return (
    <AppScreen title="Tạo tài khoản" description="Xác thực email để tham gia cộng đồng FPTU Lost & Found.">
      <Card style={styles.card}>
        <Text style={styles.note}>Bạn có thể dùng bất kỳ địa chỉ email hợp lệ nào. Không bắt buộc email FPT.</Text>
        {serverError ? <ErrorBanner message={serverError} /> : null}
        {fieldError ? <ErrorBanner message={fieldError} /> : null}
        {otpRequestedFor ? <SuccessBanner message={`Mã xác thực đã được gửi tới ${otpRequestedFor}${expiryMinutes ? ` · có hiệu lực ${expiryMinutes} phút` : ""}.`} /> : null}
        <Input label="Họ và tên" value={fullName} onChangeText={(value) => { setFullName(value); setFieldError(""); }} maxLength={160} autoCapitalize="words" autoComplete="name" textContentType="name" />
        <View style={styles.emailRow}>
          <View style={styles.emailInput}>
            <Input label="Email" value={email} onChangeText={updateEmail} maxLength={255} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
          </View>
          <Button title={otpRequestedFor && otpRequestedFor === email.trim() ? "Gửi lại mã" : "Gửi mã OTP"} variant="secondary" loading={sendingOtp} onPress={() => void requestOtp()} style={styles.otpButton} />
        </View>
        {otpRequestedFor ? <OtpCodeInput value={otp} onChange={(value) => { setOtp(value); setFieldError(""); }} /> : null}
        <PasswordInput label="Mật khẩu" value={password} onChangeText={(value) => { setPassword(value); setFieldError(""); }} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
        <Text style={styles.hint}>Sử dụng mật khẩu tối thiểu 8 ký tự.</Text>
        <AudienceRolePicker value={audienceRole} onChange={setAudienceRole} />
        <Button title="Tạo tài khoản" loading={submitting} disabled={!otpRequestedFor} onPress={() => void submit()} />
      </Card>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Đã có tài khoản?</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.replace("/login")}>
          <Text style={styles.link}>Đăng nhập</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg, padding: spacing.lg },
  note: { color: colors.primaryDark, fontSize: 14, lineHeight: 21 },
  emailRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  emailInput: { flex: 1, minWidth: 0 },
  otpButton: { minHeight: 48, paddingHorizontal: spacing.md },
  hint: { color: colors.muted, fontSize: 12, marginTop: -spacing.md },
  footer: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, paddingBottom: spacing.md },
  footerText: { color: colors.muted, fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});
