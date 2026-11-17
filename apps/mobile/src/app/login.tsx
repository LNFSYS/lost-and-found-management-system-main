import { useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SuccessBanner } from "@/components/ui/success-banner";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/services/api";
import { homeRouteFor } from "@/services/auth-routing";

function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }

export default function LoginScreen() {
  const { user, isHydrating, login } = useAuth();
  const params = useLocalSearchParams<{ reset?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isHydrating) return <LoadingSpinner label="Đang kiểm tra phiên…" />;
  if (user) return <Redirect href={homeRouteFor(user)} />;

  const submit = async () => {
    const normalizedEmail = email.trim();
    setEmailError(validEmail(normalizedEmail) ? "" : "Vui lòng nhập email hợp lệ");
    setPasswordError(!password ? "Vui lòng nhập mật khẩu" : password.length > 72 ? "Mật khẩu không được dài hơn 72 ký tự" : "");
    setServerError("");
    if (!validEmail(normalizedEmail) || !password || password.length > 72) return;
    setSubmitting(true);
    try {
      const signedInUser = await login({ email: normalizedEmail, password });
      router.replace(homeRouteFor(signedInUser));
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen title="Chào mừng trở lại" description="Đăng nhập để tiếp tục quản lý tin thất lạc và phiên nhận đồ của bạn.">
      <Card style={styles.card}>
        {params.reset === "success" ? <SuccessBanner message="Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới." /> : null}
        {serverError ? <ErrorBanner message={serverError} /> : null}
        <Input
          label="Email"
          value={email}
          onChangeText={(value) => { setEmail(value); setEmailError(""); setServerError(""); }}
          error={emailError}
          maxLength={255}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <PasswordInput
          label="Mật khẩu"
          value={password}
          onChangeText={(value) => { setPassword(value); setPasswordError(""); setServerError(""); }}
          error={passwordError}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push("/forgot-password")} style={styles.forgotLink}>
          <Text style={styles.link}>Quên mật khẩu?</Text>
        </Pressable>
        <Button title="Đăng nhập" loading={submitting} onPress={() => void submit()} />
      </Card>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Chưa có tài khoản?</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push("/register")}>
          <Text style={styles.link}>Đăng ký tài khoản mới</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg, padding: spacing.lg },
  forgotLink: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs },
  link: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm, paddingBottom: spacing.md },
  footerText: { color: colors.muted, fontSize: 14 },
});
