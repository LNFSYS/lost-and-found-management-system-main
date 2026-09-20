import { AlertTriangle, Eye, ImagePlus, LockKeyhole, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { api, type ClaimEvidence } from "../services/api";

function EvidenceImage({ evidence }: { evidence: ClaimEvidence }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    api.getClaimEvidenceMedia(evidence.url).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setSource(objectUrl);
    }).catch(() => { if (active) setSource(""); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [evidence.url]);
  return <div className="evidence-thumb">{source ? <img src={source} alt={evidence.description || "Private evidence"} /> : <span>{source === "" ? "Không tải được" : "Đang tải"}</span>}</div>;
}

interface Props {
  claimId: string;
  evidence: ClaimEvidence[];
  sensitiveDocument?: boolean;
  canUpload?: boolean;
  onEvidenceAdded: (value: ClaimEvidence) => void;
}

export function ClaimEvidencePanel({ claimId, evidence, sensitiveDocument, canUpload = true, onEvidenceAdded }: Props) {
  const [selected, setSelected] = useState<ClaimEvidence | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setError("");
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const created = await api.uploadClaimEvidence(claimId, file, description.trim() || undefined);
      onEvidenceAdded(created);
      setFile(null);
      setDescription("");
      setShowUpload(false);
      if (fileInput.current) fileInput.current.value = "";
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải evidence");
    } finally {
      setUploading(false);
    }
  }

  return <>
    <section className="evidence-panel" id="private-evidence">
      <header><span>PRIVATE EVIDENCE</span><LockKeyhole /></header>
      <div className="evidence-count"><ImagePlus /><strong>{evidence.length} private evidence items</strong></div>
      {evidence.length ? <div className="evidence-thumbnails">{evidence.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={() => setSelected(item)} title="Xem evidence"><EvidenceImage evidence={item} /></button>)}</div> : <p>Chưa có evidence được chia sẻ.</p>}
      <small>Chỉ participant được cấp quyền xem.</small>
      {sensitiveDocument && <div className="evidence-sensitive"><AlertTriangle /> Không chia sẻ ảnh đầy đủ giấy tờ tùy thân.</div>}
      <div className="evidence-panel__actions">{evidence.length > 0 && <button type="button" onClick={() => setSelected(evidence[0]!)}><Eye /> Xem evidence</button>}{canUpload && <button type="button" onClick={() => setShowUpload((value) => !value)}><Upload /> Thêm evidence</button>}</div>
      {canUpload && showUpload && <form className="evidence-upload-compact" onSubmit={upload}>
        <label><span>{file?.name ?? "Chọn ảnh JPEG, PNG hoặc WEBP"}</span><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} required /></label>
        <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={255} placeholder="Mô tả ngắn" />
        <button type="submit" disabled={!file || uploading}>{uploading ? "Đang tải..." : "Tải lên"}</button>
      </form>}
      {error && <div className="evidence-panel-error"><AlertTriangle /> {error}</div>}
    </section>

    {selected && <div className="evidence-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
      <section className="evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-modal-title">
        <header><div><span>PRIVATE EVIDENCE</span><h3 id="evidence-modal-title">{selected.description || "Verification evidence"}</h3></div><button type="button" onClick={() => setSelected(null)} title="Đóng"><X /></button></header>
        <EvidenceImage evidence={selected} />
        <dl><div><dt>Uploaded by</dt><dd>{selected.uploadedBy.fullName}</dd></div><div><dt>Type</dt><dd>{selected.evidenceType}</dd></div><div><dt>Privacy</dt><dd><LockKeyhole /> Private</dd></div></dl>
      </section>
    </div>}
  </>;
}
