import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await login(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? "/home", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đăng nhập");
    } finally {
      setPending(false);
    }
  }

  return <AuthFrame eyebrow="FPTU LOST & FOUND" title="Đăng nhập để tiếp tục" subtitle="Theo dõi hành trình Lost & Found bằng một tài khoản đã xác thực.">
    <form onSubmit={submit} className="form-stack"><Field icon={<Mail size={18} />} label="Email"><input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field><Field icon={<KeyRound size={18} />} label="Mật khẩu"><input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></Field>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={pending}>{pending ? "Đang đăng nhập..." : <>Đăng nhập <ArrowRight size={18} /></>}</button></form>
    <div className="form-links"><Link to="/forgot-password">Quên mật khẩu?</Link><span>Chưa có tài khoản? <Link to="/register">Đăng ký</Link></span></div>
  </AuthFrame>;
}

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return <label className="input-field"><span>{icon}{label}</span>{children}</label>;
}

export function AuthFrame({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return <main className="auth-page"><section className="auth-aside"><div className="campus-stamp">FPTU<br /><strong>LOST<br />FOUND</strong></div><p>Campus identity</p><h1>Nhặt đồ đừng ngại, đăng tin trả lại. Lạc đồ một phát, tìm lại trong chốc lát.</h1><div className="signal-line"><span />Xác thực email · Phiên an toàn · Phân quyền rõ ràng</div></section><section className="auth-panel"><div className="auth-card"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="muted">{subtitle}</p>{children}</div></section></main>;
}
