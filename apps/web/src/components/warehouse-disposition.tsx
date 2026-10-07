import { Check, FileImage, RefreshCw, ShieldCheck, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/auth-context";
import { api } from "../services/api";
import "./warehouse-disposition.css";

const targets = { DISPOSED: "Tiêu hủy", DONATED: "Quyên góp", TRANSFERRED: "Chuyển giao" };
const statuses: Record<string, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", EXECUTED: "Đã thực hiện" };
type Context = Awaited<ReturnType<typeof api.getDispositionContext>>;

function ProofImage({ id }: { id: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    api.getWarehouseProof(id).then(blob => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  return error ? <span>Không tải được chứng từ</span> : url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Chứng từ xử lý vật phẩm" /></a> : <span>Đang tải ảnh...</span>;
}

export function WarehouseDisposition({ itemId, onChanged }: { itemId: string; onChanged(): Promise<void> }) {
  const { user } = useAuth();
  const admin = user?.roles.includes("ADMIN");
  const [data, setData] = useState<Context | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<keyof typeof targets>("DISPOSED");
  const [proofIds, setProofIds] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api.getDispositionContext(itemId).then(value => { if (active) setData(value); })
      .catch(() => { if (active) setError("Không tải được điều kiện xử lý."); });
    return () => { active = false; };
  }, [itemId, revision]);

  async function act(work: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await work(); setReason(""); setRevision(value => value + 1); await onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thực hiện được thao tác."); }
    finally { setBusy(false); }
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (files.length + proofIds.length > 5 || Array.from(files).some(file => file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setError("Chọn tối đa 5 ảnh JPG, PNG hoặc WebP, mỗi ảnh không quá 5 MB."); return;
    }
    setBusy(true); setError("");
    try {
      for (const file of Array.from(files)) {
        const proof = await api.uploadWarehouseProof(file, itemId);
        setProofIds(ids => ids.includes(proof.id) ? ids : [...ids, proof.id]);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được chứng từ."); }
    finally { setBusy(false); }
  }
  const activeOrder = data?.orders.find(order => order.status !== "EXECUTED");
  return <section className="warehouse-disposition" aria-label="Điều kiện và lệnh xử lý">
    <h3><ShieldCheck size={20} /> Điều kiện xử lý vật phẩm</h3>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!data && !error && <p role="status">Đang kiểm tra...</p>}
    {!data && error && <button onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} /> Thử lại</button>}
    {data && <>
      <p>Hạn lưu giữ: <strong>{data.retentionDeadline ? new Date(data.retentionDeadline).toLocaleString("vi-VN") : "Chưa xác định"}</strong></p>
      <p role="status">{data.eligible ? "Đủ điều kiện xử lý tại thời điểm kiểm tra" : "Chưa đủ điều kiện xử lý"}</p>
      {data.reasons.length > 0 && <ul>{data.reasons.map(value => <li key={value}>{value}</li>)}</ul>}
      <p>Tạm giữ pháp lý: <strong>{data.legalHold ? "Đang áp dụng" : "Không áp dụng"}</strong></p>
      {admin && !["RETURNED", "DISPOSED", "DONATED", "TRANSFERRED"].includes(data.status) && <div className="disposition-actions">
        <label>Lý do thao tác<textarea value={reason} minLength={3} maxLength={1000} onChange={event => setReason(event.target.value)} disabled={busy} /></label>
        <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void act(() => api.setWarehouseLegalHold(itemId, !data.legalHold, reason))}>
          <ShieldCheck size={16} /> {data.legalHold ? "Gỡ tạm giữ pháp lý" : "Áp dụng tạm giữ pháp lý"}
        </button>
        {!activeOrder && <>
          <label>Phương án xử lý<select value={target} disabled={busy} onChange={event => setTarget(event.target.value as keyof typeof targets)}>{Object.entries(targets).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button type="button" disabled={busy || !data.eligible || reason.trim().length < 3} onClick={() => void act(() => api.requestDisposition(itemId, target, reason))}><Check size={16} /> Lập lệnh xử lý</button>
        </>}
      </div>}
      <h3>Lệnh xử lý</h3>
      {!data.orders.length && <p>Chưa có lệnh xử lý.</p>}
      {data.orders.map(order => <article className="disposition-order" key={order.id}>
        <strong>{targets[order.target]} · {statuses[order.status] ?? order.status}</strong>
        <p>{order.reason}</p><p>Đề nghị: {order.requesterName} · {new Date(order.createdAt).toLocaleString("vi-VN")}</p>
        {order.approverName && <p>Người duyệt: {order.approverName}</p>}
        {order.status === "PENDING" && admin && (order.requesterId === user?.id ? <p>Cần một Admin khác phê duyệt lệnh này.</p> :
          <button disabled={busy || !data.eligible} onClick={() => void act(() => api.approveDisposition(order.id))}><Check size={16} /> Phê duyệt</button>)}
        {order.status === "APPROVED" && <div className="disposition-actions">
          <label className="disposition-upload"><Upload size={18} /> Chứng từ xử lý<input aria-label="Chứng từ xử lý" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || !data.eligible} onChange={event => { void upload(event.target.files); event.target.value = ""; }} /></label>
          <div className="disposition-proofs">{proofIds.map(id => <div key={id}><ProofImage id={id} /><button type="button" title="Bỏ chứng từ" aria-label="Bỏ chứng từ" disabled={busy} onClick={() => setProofIds(ids => ids.filter(value => value !== id))}><X size={16} /></button></div>)}</div>
          <label className="warehouse-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> Tôi xác nhận đã thực hiện đúng phương án được duyệt và chứng từ là chính xác.</label>
          <button disabled={busy || !data.eligible || !proofIds.length || !confirmed} onClick={() => void act(() => api.executeDisposition(order.id, proofIds))}><Check size={16} /> Ghi nhận hoàn tất</button>
        </div>}
      </article>)}
      {data.proofs.length > 0 && <><h3><FileImage size={18} /> Chứng từ đã ghi nhận</h3><div className="disposition-proofs">{data.proofs.map(proof => <ProofImage key={proof.id} id={proof.id} />)}</div></>}
      <details><summary>Lịch sử quyết định ({data.logs.length})</summary>{data.logs.map(log => <p key={log.id}>{new Date(log.createdAt).toLocaleString("vi-VN")} · {log.actor?.fullName} · {log.note ?? log.action}</p>)}</details>
    </>}
  </section>;
}
