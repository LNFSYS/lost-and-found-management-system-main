import { Redirect, Stack } from "expo-router";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/context/auth-context";
export default function AdminStackLayout() {
  const { user, isHydrating } = useAuth();
  if (isHydrating) return <LoadingSpinner label="Đang xác minh quyền quản trị…" />;
  if (!user?.roles.includes("ADMIN")) return <Redirect href="/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
