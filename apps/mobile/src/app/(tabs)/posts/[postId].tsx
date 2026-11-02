import { useLocalSearchParams } from "expo-router";
import { FeaturePlaceholder } from "@/components/feature-placeholder";
export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return <FeaturePlaceholder title="Chi tiết bài đăng" description={`Mã bài đăng: ${postId ?? "—"}`} icon="text-box-search-outline" />;
}
