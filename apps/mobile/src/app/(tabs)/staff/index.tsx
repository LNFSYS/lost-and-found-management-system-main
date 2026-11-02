import { Redirect } from "expo-router";
import { FeaturePlaceholder } from "@/components/feature-placeholder";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/context/auth-context";

export default function StaffScreen() {
  const { user, isHydrating } = useAuth();
  if (isHydrating) return <LoadingSpinner label="Đang tải quyền truy cập…" />;
  if (!user?.roles.includes("STAFF")) return <Redirect href="/home" />;
  return <FeaturePlaceholder title="Vận hành Staff" description="Công cụ tiếp nhận và quản lý vật phẩm dành cho Staff." icon="clipboard-check-outline" />;
}
