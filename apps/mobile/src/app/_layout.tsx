import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider } from "@/context/auth-context";
import { NotificationCountProvider } from "@/context/notification-count-context";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { colors } from "@/constants/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationCountProvider>
          <StatusBar style="dark" />
          <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
            <OfflineBanner />
          </SafeAreaView>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        </NotificationCountProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
