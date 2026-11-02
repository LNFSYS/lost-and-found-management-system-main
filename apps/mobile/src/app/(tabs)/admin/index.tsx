import { Redirect } from "expo-router";
import { FeaturePlaceholder } from "@/components/feature-placeholder";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/context/auth-context";

export default function AdminScreen() {
  const { user, isHydrating } = useAuth();
  if (isHydrating) return <LoadingSpinner label="Đang tải quyền truy cập…" />;
  if (!user?.roles.includes("ADMIN")) return <Redirect href="/home" />;
  return <FeaturePlaceholder title="Quản trị" description="Khu vực vận hành dành cho quản trị viên." icon="shield-account-outline" />;
}
