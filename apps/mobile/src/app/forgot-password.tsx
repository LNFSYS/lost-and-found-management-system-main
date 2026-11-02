import { useState } from "react";
import { Redirect, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { api, getApiErrorMessage } from "@/services/api";
import { homeRouteFor } from "@/services/auth-routing";

function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }

export default function ForgotPasswordScreen() {
  const { user, isHydrating } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (isHydrating) return <LoadingSpinner label="Đang kiểm tra phiên…" />;
  if (user) return <Redirect href={homeRouteFor(user)} />;

  const submit = async () => {
    const normalizedEmail = email.trim();
    if (!validEmail(normalizedEmail)) { setError("Vui lòng nhập email hợp lệ"); return; }
    setError("");
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email: normalizedEmail });
      router.replace({ pathname: "/reset-password", params: { email: normalizedEmail, sent: "1" } });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen title="Quên mật khẩu?" description="Nhập email đăng ký. Nếu tài khoản tồn tại, mã đặt lại sẽ được gửi tới hộp thư của bạn.">
      <Card style={styles.card}>
        {error ? <ErrorBanner message={error} /> : null}
        <Input label="Email" value={email} onChangeText={(value) => { setEmail(value); setError(""); }} maxLength={255} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={() => void submit()} />
        <Button title="Gửi mã đặt lại" loading={submitting} onPress={() => void submit()} />
      </Card>
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.replace("/login")}><Text style={styles.link}>Quay lại đăng nhập</Text></Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.lg, padding: spacing.lg }, footer: { alignItems: "center" }, link: { minHeight: 44, padding: spacing.sm, color: colors.primary, fontSize: 14, fontWeight: "700" } });
