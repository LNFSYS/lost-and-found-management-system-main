import { useEffect } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Redirect, router, Tabs, usePathname } from "expo-router";
import { Platform } from "react-native";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { appTabLabels } from "@/constants/labels";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useNotificationCount } from "@/context/notification-count-context";

// SDK 58 redirects focused href:null routes, so hide their buttons without hiding the routes.
const hideTabButton = () => null;

export default function TabsLayout() {
  const { user, isHydrating } = useAuth();
  const { unreadCount } = useNotificationCount();
  const pathname = usePathname();
  const isAdmin = user?.roles.includes("ADMIN") ?? false;
  const isStaff = isAdmin || (user?.roles.includes("STAFF") ?? false);
  const routeRoot = pathname.split("/").filter(Boolean)[0] ?? "";

  useEffect(() => {
    if (isHydrating || !user) return;
    if (isAdmin && routeRoot === "home") router.replace("/admin");
    if (!isAdmin && routeRoot === "admin") router.replace("/home");
    if (!isStaff && routeRoot === "staff") router.replace("/home");
  }, [isAdmin, isHydrating, isStaff, routeRoot, user]);

  if (isHydrating) return <LoadingSpinner label="Đang khôi phục phiên đăng nhập…" />;
  if (!user) return <Redirect href="/login" />;
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
      <Tabs.Screen name="home" options={{ title: appTabLabels.home, tabBarButton: isAdmin ? hideTabButton : undefined, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="posts" options={{ title: appTabLabels.posts, tabBarButton: isAdmin ? hideTabButton : undefined, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-grid-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="claims" options={{ title: appTabLabels.claims, tabBarButton: isAdmin ? hideTabButton : undefined, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="message-text-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="appointments" options={{ title: appTabLabels.appointments, tabBarButton: isAdmin ? hideTabButton : undefined, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="calendar-check-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: appTabLabels.profile, tabBarButton: isAdmin ? hideTabButton : undefined, tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="notifications" options={{ tabBarButton: hideTabButton }} />
      <Tabs.Screen name="reports" options={{ tabBarButton: hideTabButton }} />
      <Tabs.Screen name="custody" options={{ tabBarButton: hideTabButton }} />
      <Tabs.Screen name="admin" options={{ title: appTabLabels.admin, tabBarButton: isAdmin ? undefined : hideTabButton, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="shield-account-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="staff" options={{ title: isAdmin ? "Nhiệm vụ" : appTabLabels.staff, tabBarButton: isStaff ? undefined : hideTabButton, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clipboard-check-outline" color={String(color)} size={size} /> }} />
    </Tabs>
  );
}
