import type { ComponentProps } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { AppScreen } from "@/components/app-screen";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function FeaturePlaceholder({ title, description, icon }: { title: string; description: string; icon: IconName }) {
  return (
    <AppScreen title={title} description={description}>
      <Card>
        <EmptyState icon={icon} title="Khu vực đã sẵn sàng" description="Các màn hình nghiệp vụ sẽ được bổ sung trên nền tảng navigation và network client dùng chung này." />
      </Card>
    </AppScreen>
  );
}
