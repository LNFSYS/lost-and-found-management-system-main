import { useLocalSearchParams } from "expo-router";
import { FeaturePlaceholder } from "@/components/feature-placeholder";
export default function AppointmentDetailScreen() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  return <FeaturePlaceholder title="Chi tiết lịch hẹn" description={`Mã lịch hẹn: ${appointmentId ?? "—"}`} icon="calendar-clock-outline" />;
}
