import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors, spacing } from "@/constants/theme";
import { api, getApiErrorMessage } from "@/services/api";

type ApiState = "checking" | "online" | "error";

export default function HomeScreen() {
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [apiError, setApiError] = useState("");
  const checkApi = useCallback(async () => {
    try {
      await api.get("/health");
      setApiError("");
      setApiState("online");
    } catch (error) {
      setApiState("error");
      setApiError(getApiErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    const initialCheck = setTimeout(() => void checkApi(), 0);
    return () => clearTimeout(initialCheck);
  }, [checkApi]);

  return (
    <AppScreen title="Tìm lại. Trao trả." description="Kết nối người làm mất và người nhặt được đồ trong khuôn viên FPTU Đà Nẵng.">
      <View style={styles.actions}>
        <Button title="Mở bảng tin" onPress={() => router.push("/posts")} />
        <Button title="Xem trao đổi" variant="secondary" onPress={() => router.push("/claims")} />
      </View>
      <Card style={styles.statusCard}>
        <View style={styles.statusHeading}>
          <MaterialCommunityIcons name="server-network-outline" size={22} color={apiState === "online" ? colors.success : colors.primary} />
          <Text style={styles.statusTitle}>Kết nối hệ thống</Text>
        </View>
        {apiState === "checking" ? <LoadingSpinner size="small" label="Đang kiểm tra API…" /> : null}
        {apiState === "online" ? <Text style={styles.statusCopy}>API đang phản hồi. Access token sẽ được đính kèm tự động cho các yêu cầu đã đăng nhập.</Text> : null}
        {apiState === "error" ? <ErrorBanner message={apiError} onRetry={() => void checkApi()} /> : null}
      </Card>
      <Card style={styles.tipCard}>
        <MaterialCommunityIcons name="shield-lock-outline" size={22} color={colors.primary} />
        <Text style={styles.tip}>Token được lưu trong vùng lưu trữ bảo mật của thiết bị. Ảnh riêng tư được tải qua client có xác thực.</Text>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  statusCard: { gap: spacing.md },
  statusHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  statusCopy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  tipCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  tip: { flex: 1, color: colors.primaryDark, fontSize: 13, lineHeight: 20 },
});
