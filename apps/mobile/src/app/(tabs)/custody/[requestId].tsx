import { useCallback, useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { colors, spacing } from "@/constants/theme";
import { getApiErrorMessage, staffService } from "@/services/api";

export default function CustodyRequestScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const [result, setResult] = useState<Awaited<ReturnType<typeof staffService.getCustodyRequest>> | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { if (!requestId) return; setError(""); try { setResult(await staffService.getCustodyRequest(requestId)); } catch (err) { setError(getApiErrorMessage(err)); } finally { setLoading(false); } }, [requestId]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  if (loading) return <LoadingSpinner label="Đang tải yêu cầu tiếp nhận…" />;
  if (!result) return <AppScreen title="Yêu cầu tiếp nhận"><ErrorBanner message={error || "Không thể mở yêu cầu này."} onRetry={() => void load()} /><Button title="Quay lại thông báo" variant="secondary" onPress={() => router.back()} /></AppScreen>;
  const request = result.request;
  return <AppScreen title="Yêu cầu tiếp nhận" description="Theo dõi trạng thái bàn giao vật phẩm cho kho trường.">
    {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
    <Card style={styles.card}>
      <View style={styles.top}><Text style={styles.name}>{request.post?.title || "Vật phẩm"}</Text><Badge status={request.status} /></View>
      <InfoRow label="Mã yêu cầu" value={request.id} />
      <InfoRow label="Người gửi yêu cầu" value={request.requester.fullName || "Người dùng"} />
      <InfoRow label="Loại tiếp nhận" value={request.intakeType === "CUSTODY_TRANSFER" ? "Chuyển giao từ Finder" : "Tiếp nhận trực tiếp"} />
      <InfoRow label="Điểm bàn giao" value={request.handoverPoint?.name || "Chưa được chỉ định"} />
      <InfoRow label="Lý do" value={request.reason || "Không có ghi chú"} />
      {request.confirmedHandoverAt ? <InfoRow label="Thời gian bàn giao" value={new Date(request.confirmedHandoverAt).toLocaleString("vi-VN")} /> : null}
      {request.status === "REJECTED" && request.rejectionReason ? <InfoRow label="Lý do từ chối" value={request.rejectionReason} /> : null}
    </Card>
    {result.audit.length ? <Card style={styles.card}><Text style={styles.heading}>Lịch sử</Text>{result.audit.map((entry) => <View key={entry.id} style={styles.event}><Text style={styles.eventTitle}>{entry.action.replaceAll("_", " ")}</Text><Text style={styles.muted}>{new Date(entry.createdAt).toLocaleString("vi-VN")}</Text>{entry.metadata ? <Text style={styles.body}>{JSON.stringify(entry.metadata)}</Text> : null}</View>)}</Card> : null}
    <Button title="Mở thông báo" variant="secondary" onPress={() => router.back()} />
  </AppScreen>;
}

function InfoRow({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.label}>{label}</Text><Text selectable style={styles.body}>{value}</Text></View>; }
const styles = StyleSheet.create({ card: { gap: spacing.md }, top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm }, name: { flex: 1, color: colors.ink, fontSize: 18, lineHeight: 24, fontWeight: "800" }, info: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, label: { color: colors.muted, fontSize: 12, fontWeight: "700" }, body: { color: colors.ink, fontSize: 14, lineHeight: 20 }, heading: { color: colors.ink, fontSize: 16, fontWeight: "800" }, event: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, eventTitle: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" }, muted: { color: colors.muted, fontSize: 11 }, });
