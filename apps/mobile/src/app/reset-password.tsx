import { useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
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

export default function ResetPasswordScreen() {
  const { user, isHydrating } = useAuth();
  const params = useLocalSearchParams<{ email?: string; sent?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (isHydrating) return <LoadingSpinner label="Đang kiểm tra phiên…" />;
  if (user) return <Redirect href={homeRouteFor(user)} />;

  const submit = async () => {
    if (!validEmail(email)) { setError("Vui lòng nhập email hợp lệ"); return; }
    if (!/^\d{6}$/.test(token)) { setError("Mã xác thực gồm đúng 6 chữ số"); return; }
    if (newPassword.length < 8) { setError("Mật khẩu mới cần ít nhất 8 ký tự"); return; }
    if (newPassword.length > 72) { setError("Mật khẩu không được dài hơn 72 ký tự"); return; }
    setError("");
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { email: email.trim(), token, newPassword });
      router.replace({ pathname: "/login", params: { reset: "success" } });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen title="Đặt lại mật khẩu" description="Nhập mã xác thực trong email và chọn mật khẩu mới cho tài khoản.">
      <Card style={styles.card}>
        {params.sent === "1" ? <SuccessBanner message="Nếu email tồn tại, mã đặt lại mật khẩu đã được gửi. Kiểm tra hộp thư rồi nhập mã bên dưới." /> : null}
        {error ? <ErrorBanner message={error} /> : null}
        <Input label="Email" value={email} onChangeText={(value) => { setEmail(value); setError(""); }} maxLength={255} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
        <OtpCodeInput value={token} onChange={(value) => { setToken(value); setError(""); }} />
        <PasswordInput label="Mật khẩu mới" value={newPassword} onChangeText={(value) => { setNewPassword(value); setError(""); }} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" returnKeyType="done" onSubmitEditing={() => void submit()} />
        <Text style={styles.hint}>Sử dụng mật khẩu tối thiểu 8 ký tự.</Text>
        <Button title="Đặt lại mật khẩu" loading={submitting} onPress={() => void submit()} />
      </Card>
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.replace("/login")}><Text style={styles.link}>Quay lại đăng nhập</Text></Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.lg, padding: spacing.lg }, hint: { color: colors.muted, fontSize: 12, marginTop: -spacing.md }, footer: { alignItems: "center" }, link: { minHeight: 44, padding: spacing.sm, color: colors.primary, fontSize: 14, fontWeight: "700" } });
