import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/ui/button";
import { spacing } from "@/constants/theme";

export default function HomeScreen() {
  return (
    <AppScreen title="Tìm lại. Trao trả." description="Kết nối người làm mất và người nhặt được đồ trong khuôn viên FPTU Đà Nẵng.">
      <View style={styles.actions}>
        <Button title="Tạo tin thất lạc / nhặt được" onPress={() => router.push("/posts/create")} />
        <Button title="Mở bảng tin" variant="secondary" onPress={() => router.push("/posts")} />
        <Button title="Xem trao đổi" variant="secondary" onPress={() => router.push("/claims")} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
});
