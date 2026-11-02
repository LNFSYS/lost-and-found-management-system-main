import { useLocalSearchParams } from "expo-router";
import { FeaturePlaceholder } from "@/components/feature-placeholder";
export default function ClaimDetailScreen() {
  const { claimId } = useLocalSearchParams<{ claimId: string }>();
  return <FeaturePlaceholder title="Chi tiết yêu cầu" description={`Mã yêu cầu: ${claimId ?? "—"}`} icon="message-check-outline" />;
}
