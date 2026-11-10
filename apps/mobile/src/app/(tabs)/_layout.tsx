import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { appTabLabels } from "@/constants/labels";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useNotificationCount } from "@/context/notification-count-context";

export default function TabsLayout() {
  const { user, isHydrating } = useAuth();
  const { unreadCount } = useNotificationCount();
  if (isHydrating) return <LoadingSpinner label="Đang khôi phục phiên đăng nhập…" />;
  if (!user) return <Redirect href="/login" />;
  const isAdmin = user.roles.includes("ADMIN");
  const isStaff = isAdmin || user.roles.includes("STAFF");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: Platform.OS === "ios" ? 88 : 64, paddingTop: 6, paddingBottom: Platform.OS === "ios" ? 28 : 8 },
        tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.surface, fontSize: 10, fontWeight: "700" },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="home" options={{ title: appTabLabels.home, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="posts" options={{ title: appTabLabels.posts, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-grid-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="claims" options={{ title: appTabLabels.claims, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="message-text-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="appointments" options={{ title: appTabLabels.appointments, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="calendar-check-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: appTabLabels.profile, tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="custody" options={{ href: null }} />
      <Tabs.Screen name="admin" options={{ title: appTabLabels.admin, href: isAdmin ? undefined : null, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="shield-account-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="staff" options={{ title: appTabLabels.staff, href: isStaff ? undefined : null, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clipboard-check-outline" color={String(color)} size={size} /> }} />
    </Tabs>
  );
}
