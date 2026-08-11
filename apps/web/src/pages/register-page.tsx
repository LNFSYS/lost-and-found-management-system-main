import { ArrowRight, MailCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthFrame } from "./login-page";
import { api } from "../services/api";
import { useAuth } from "../context/auth-context";

export function RegisterPage() {
  const { refreshUser } = useAuth(); const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", otp: "", password: "", audienceRole: "STUDENT" as "STUDENT" | "LECTURER" });
  const [note, setNote] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const change = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function requestOtp() { setError(""); setPending(true); try { const result = await api.requestRegistrationOtp(form.email); setNote(`Đã gửi OTP. Mã có hiệu lực ${result.expiresInMinutes} phút.`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể gửi OTP"); } finally { setPending(false); } }
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); setPending(true); try { await api.register(form); await refreshUser(); navigate("/home", { replace: true }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tạo tài khoản"); } finally { setPending(false); } }
  return <AuthFrame eyebrow="TẠO TÀI KHOẢN" title="Bắt đầu với email của bạn" subtitle="Bạn không cần email FPT. Email chỉ dùng để xác thực và phục hồi tài khoản."><form className="form-stack" onSubmit={submit}><label className="input-field"><span>Họ và tên</span><input value={form.fullName} onChange={(e) => change("fullName", e.target.value)} required /></label><label className="input-field"><span>Email</span><div className="inline-input"><input type="email" value={form.email} onChange={(e) => change("email", e.target.value)} required /><button type="button" className="secondary-button" disabled={pending || !form.email} onClick={() => void requestOtp()}><MailCheck size={17} /> Gửi OTP</button></div></label><label className="input-field"><span>Mã OTP gồm 6 số</span><input inputMode="numeric" maxLength={6} value={form.otp} onChange={(e) => change("otp", e.target.value)} required /></label><label className="input-field"><span>Mật khẩu</span><input type="password" minLength={8} value={form.password} onChange={(e) => change("password", e.target.value)} required /></label><label className="input-field"><span>Vai trò sử dụng</span><select value={form.audienceRole} onChange={(e) => change("audienceRole", e.target.value)}><option value="STUDENT">Sinh viên</option><option value="LECTURER">Giảng viên</option></select></label>{note && <p className="form-note">{note}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={pending}>{pending ? "Đang xử lý..." : <>Tạo tài khoản <ArrowRight size={18} /></>}</button></form><p className="form-links centered">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p></AuthFrame>;
}
