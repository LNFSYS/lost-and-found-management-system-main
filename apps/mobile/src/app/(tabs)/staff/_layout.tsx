import { Redirect, Stack } from "expo-router";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/context/auth-context";

export default function StaffStackLayout() {
  const { user, isHydrating } = useAuth();
  if (isHydrating) return <LoadingSpinner label="Đang kiểm tra quyền nhân viên…" />;
  if (!user || (!user.roles.includes("STAFF") && !user.roles.includes("ADMIN"))) return <Redirect href="/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
