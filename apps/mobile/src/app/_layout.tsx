import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/context/auth-context";
import { CallProvider } from "@/context/call-context";
import { NotificationCountProvider } from "@/context/notification-count-context";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { colors } from "@/constants/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CallProvider>
          <NotificationCountProvider>
            <StatusBar style="dark" />
            <OfflineBanner />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
          </NotificationCountProvider>
        </CallProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
