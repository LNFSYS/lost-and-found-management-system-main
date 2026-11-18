import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/app-screen";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { colors, radii, spacing } from "@/constants/theme";
import { adminService, getApiErrorMessage, type AdminAccessRole, type AdminUser, type AdminUserStatus } from "@/services/api";

const accessRoles: AdminAccessRole[] = ["USER", "STAFF", "ADMIN"];
const audienceRoles: { value: "STUDENT" | "LECTURER" | null; label: string }[] = [
  { value: "STUDENT", label: "Sinh viên" }, { value: "LECTURER", label: "Giảng viên" }, { value: null, label: "Nhân viên" },
];
const roleLabels: Record<AdminAccessRole, string> = { USER: "Người dùng", STAFF: "Nhân viên", ADMIN: "Quản trị" };

export default function AdminUsersScreen() {
  const [q, setQ] = useState(""); const [role, setRole] = useState<AdminAccessRole | "">(""); const [status, setStatus] = useState<AdminUserStatus | "">("");
  const [items, setItems] = useState<AdminUser[]>([]); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [audience, setAudience] = useState<"STUDENT" | "LECTURER" | null>("STUDENT"); const [createRole, setCreateRole] = useState<AdminAccessRole>("USER");
  const [editing, setEditing] = useState<AdminUser | null>(null); const [roleDraft, setRoleDraft] = useState<AdminAccessRole>("USER"); const [reason, setReason] = useState("");
  const load = useCallback(async () => { setError(""); try { const result = await adminService.listUsers({ q: q.trim() || undefined, role, status, page: 1, pageSize: 50 }); setItems(result.items); setTotal(result.total); } catch (err) { setError(getApiErrorMessage(err)); } finally { setLoading(false); } }, [q, role, status]);
  useEffect(() => { const timer = setTimeout(() => void load(), q ? 350 : 0); return () => clearTimeout(timer); }, [load, q]);
  const create = async () => {
    if (name.trim().length < 2 || password.length < 8 || !/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Nhập họ tên, email hợp lệ và mật khẩu tối thiểu 8 ký tự."); return; }
    setBusy(true); setError(""); try { await adminService.createUser({ fullName: name.trim(), email: email.trim(), password, audienceRole: audience, accessRole: createRole, status: "ACTIVE" }); setShowCreate(false); setName(""); setEmail(""); setPassword(""); await load(); } catch (err) { setError(getApiErrorMessage(err)); } finally { setBusy(false); }
  };
  const editUser = (user: AdminUser) => { setEditing(user); setRoleDraft(user.accessRole); };
  const saveRole = async () => {
    if (!editing) return; if (reason.trim().length < 3) { setError("Ghi lý do thay đổi vai trò (ít nhất 3 ký tự)."); return; }
    setBusy(true); setError(""); try { await adminService.changeUserRole(editing.id, roleDraft, reason.trim()); setEditing(null); setReason(""); await load(); } catch (err) { setError(getApiErrorMessage(err)); } finally { setBusy(false); }
  };
  const toggleStatus = async (user: AdminUser) => {
    if (reason.trim().length < 3) { setError("Nhập lý do trước khi khóa hoặc mở khóa tài khoản."); return; }
    setBusy(true); setError(""); try { await adminService.changeUserStatus(user.id, user.status === "ACTIVE" ? "DISABLED" : "ACTIVE", reason.trim()); setReason(""); await load(); } catch (err) { setError(getApiErrorMessage(err)); } finally { setBusy(false); }
  };
  if (loading) return <LoadingSpinner label="Đang tải người dùng…" />;
  return <AppScreen title="Quản lý người dùng" description={`${total.toLocaleString("vi-VN")} tài khoản trong hệ thống`}>
    <AdminNavigation active="users" />
    {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
    <Button title={showCreate ? "Đóng biểu mẫu" : "Tạo người dùng"} variant={showCreate ? "secondary" : "primary"} onPress={() => setShowCreate(!showCreate)} />
    {showCreate ? <Card style={styles.form}>
      <Text style={styles.sectionTitle}>Tài khoản mới</Text>
      <Input label="Họ và tên" value={name} onChangeText={setName} autoComplete="name" />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <Input label="Mật khẩu tạm thời" value={password} onChangeText={setPassword} secureTextEntry maxLength={72} />
      <Text style={styles.fieldLabel}>Loại tài khoản</Text><View style={styles.chips}>{audienceRoles.map((option) => <Chip key={option.label} label={option.label} selected={audience === option.value} onPress={() => { setAudience(option.value); if (option.value === null) setCreateRole("STAFF"); }} />)}</View>
      <Text style={styles.fieldLabel}>Quyền truy cập</Text><View style={styles.chips}>{accessRoles.map((value) => <Chip key={value} label={roleLabels[value]} selected={createRole === value} onPress={() => setCreateRole(value)} />)}</View>
      <Button title="Tạo tài khoản" loading={busy} onPress={() => void create()} />
    </Card> : null}
    <Input label="Tìm theo tên hoặc email" value={q} onChangeText={setQ} placeholder="Nhập từ khóa" />
    <View style={styles.filterBlock}><Text style={styles.fieldLabel}>Vai trò</Text><View style={styles.chips}><Chip label="Tất cả" selected={!role} onPress={() => setRole("")} />{accessRoles.map((value) => <Chip key={value} label={roleLabels[value]} selected={role === value} onPress={() => setRole(value)} />)}</View></View>
    <View style={styles.filterBlock}><Text style={styles.fieldLabel}>Trạng thái</Text><View style={styles.chips}><Chip label="Tất cả" selected={!status} onPress={() => setStatus("")} /><Chip label="Đang hoạt động" selected={status === "ACTIVE"} onPress={() => setStatus("ACTIVE")} /><Chip label="Đã khóa" selected={status === "DISABLED"} onPress={() => setStatus("DISABLED")} /></View></View>
    <Input label="Lý do thay đổi vai trò / trạng thái" value={reason} onChangeText={setReason} placeholder="Bắt buộc khi thay đổi quyền" />
    {items.length === 0 ? <Card><EmptyState icon="account-search-outline" title="Không tìm thấy tài khoản" description="Thử thay đổi từ khóa hoặc bộ lọc." /></Card> : null}
    <View style={styles.userList}>{items.map((user) => <Card key={user.id} style={styles.userCard}>
      <View style={styles.userTop}><View style={styles.userCopy}><Text style={styles.userName}>{user.fullName}</Text><Text style={styles.email}>{user.email}</Text></View><Badge status={user.status} /></View>
      <Text style={styles.meta}>{roleLabels[user.accessRole]} · {user.roles.filter((entry) => entry !== user.accessRole).join(" · ") || "Không có vai trò bổ sung"}</Text>
      <View style={styles.actions}><Button title="Đổi vai trò" variant="secondary" onPress={() => editUser(user)} style={styles.flex} /><Button title={user.status === "ACTIVE" ? "Khóa" : "Mở khóa"} variant={user.status === "ACTIVE" ? "danger" : "secondary"} loading={busy} onPress={() => void toggleStatus(user)} style={styles.flex} /></View>
      {editing?.id === user.id ? <View style={styles.editor}><Text style={styles.fieldLabel}>Vai trò mới</Text><View style={styles.chips}>{accessRoles.map((value) => <Chip key={value} label={roleLabels[value]} selected={roleDraft === value} onPress={() => setRoleDraft(value)} />)}</View><Button title="Lưu vai trò" loading={busy} onPress={() => void saveRole()} /></View> : null}
    </Card>)}</View>
  </AppScreen>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ form: { gap: spacing.md }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" }, fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, chip: { minHeight: 34, paddingHorizontal: spacing.md, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, backgroundColor: colors.surface }, chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, chipText: { color: colors.muted, fontSize: 11, fontWeight: "700" }, chipTextSelected: { color: colors.primaryDark }, filterBlock: { gap: spacing.sm }, userList: { gap: spacing.sm }, userCard: { gap: spacing.md }, userTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm }, userCopy: { flex: 1, gap: 4 }, userName: { color: colors.ink, fontSize: 15, fontWeight: "800" }, email: { color: colors.muted, fontSize: 12 }, meta: { color: colors.muted, fontSize: 12 }, actions: { flexDirection: "row", gap: spacing.sm }, flex: { flex: 1, minHeight: 42, paddingHorizontal: spacing.sm }, editor: { gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, });
