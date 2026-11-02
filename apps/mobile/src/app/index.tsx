import { Redirect } from "expo-router";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/context/auth-context";
import { homeRouteFor } from "@/services/auth-routing";

export default function IndexRoute() {
  const { user, isHydrating } = useAuth();
  if (isHydrating) return <LoadingSpinner label="Đang khôi phục phiên đăng nhập…" />;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={homeRouteFor(user)} />;
}
