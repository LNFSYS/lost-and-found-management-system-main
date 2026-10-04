import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, LoaderCircle, ScanLine } from "lucide-react";
import { api } from "../services/api";
import "./lost-contact-photo.css";

export function LostContactPhotoGate({ postId, onReady }: { postId: string; onReady: (checkId: string | null) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.checkLostContactPhoto>> | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const currentPost = useRef(postId);
  currentPost.current = postId;
  useEffect(() => {
    generation.current++;
    setFile(null); setError(""); setResult(null); setBusy(false);
    return () => { generation.current++; };
  }, [postId]);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!result?.approved || !result.expiresAt) return;
    const timer = window.setTimeout(() => { setResult(null); onReady(null); setError("Kiểm tra ảnh đã hết hạn. Vui lòng phân tích lại."); }, Math.max(0,Date.parse(result.expiresAt)-Date.now()));
    return () => clearTimeout(timer);
  }, [result, onReady]);
  async function analyze() {
    if (!file || busy) return;
    const requestGeneration = ++generation.current;
    const targetPost = postId;
    setBusy(true); setError(""); setResult(null); onReady(null);
    try {
      if (file.size > 5*1024*1024) throw new Error("Ảnh phải nhỏ hơn hoặc bằng 5 MB.");
      const value = await api.checkLostContactPhoto(targetPost,file);
      if (requestGeneration !== generation.current || currentPost.current !== targetPost) return;
      setResult(value);
      if (value.approved && value.checkId) onReady(value.checkId);
      else setError("Ảnh chưa đạt mức tương đồng trên 60% hoặc chưa đủ rõ. Cần đối chiếu lại vật phẩm.");
    } catch (reason) { if (requestGeneration === generation.current) setError(reason instanceof Error ? reason.message : "Không thể kiểm tra ảnh lúc này"); }
    finally { if (requestGeneration === generation.current) setBusy(false); }
  }
  return <section className="lost-contact-gate" aria-label="Đối chiếu ảnh trước khi liên hệ LOST">
    <h3>Ảnh vật phẩm bạn đang giữ</h3>
    <p className="contact-safety-note">Không chuyển tiền để nhận lại đồ. Ảnh khớp chỉ hỗ trợ trao đổi, không xác nhận quyền sở hữu.</p>
    {preview && <img className="contact-photo-preview" src={preview} alt="Ảnh vật phẩm trước khi liên hệ" />}
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Ảnh vật phẩm đang giữ" hidden onChange={event => {
      const selected = event.currentTarget.files?.[0] ?? null; event.currentTarget.value = "";
      generation.current++; setBusy(false); setFile(selected); setResult(null); setError(""); onReady(null);
    }} />
    <div className="contact-photo-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={18} />{file ? "Đổi ảnh" : "Chọn ảnh"}</button>
      <button type="button" className="primary-button" disabled={busy || !file} onClick={() => void analyze()}>{busy ? <LoaderCircle size={18} className="spin-icon" /> : <ScanLine size={18} />}{busy ? "Đang phân tích..." : "Kiểm tra ảnh"}</button></div>
    {result && <p className={result.approved ? "contact-photo-approved" : "field-error"} role="status">{result.approved && <CheckCircle2 size={18} />}Tương đồng {new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 2 }).format(result.score)}{result.approved ? " · Đủ điều kiện trao đổi" : " · Chưa đủ điều kiện"}</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>;
}
