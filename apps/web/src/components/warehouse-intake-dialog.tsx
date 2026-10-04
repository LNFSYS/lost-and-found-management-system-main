import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, ImagePlus, LoaderCircle, ScanLine, Trash2, X } from "lucide-react";
import { api, ApiError, type CustodyIntakeContext, type CustodyRequest, type WarehouseCatalog, type WarehouseItem } from "../services/api";
import { WarehouseImageGallery, WarehouseImageView } from "./warehouse-images";

const empty = { handoverPointId: "", itemName: "", description: "", categoryId: "", areaId: "", buildingId: "", roomText: "", finderName: "", finderContact: "", conditionNotes: "", accessories: "", receivedQuantity: "1", receivedAt: "" };
type Analysis = Awaited<ReturnType<typeof api.analyzePostImage>>;
type Photo = { id: string; file: File };
const clean = (value: string) => value.trim() || null;

export function WarehouseIntakeDialog({ request, catalog, onClose, onReceived }: {
  request?: CustodyRequest | null; catalog: WarehouseCatalog | null; onClose: () => void; onReceived: (item?: WarehouseItem) => Promise<void>;
}) {
  const [intakeKey] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({ ...empty, handoverPointId: request?.handoverPoint?.id ?? catalog?.handoverPoints[0]?.id ?? "" });
  const [context, setContext] = useState<CustodyIntakeContext | null>(null);
  const [loading, setLoading] = useState(Boolean(request));
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    if (request) void api.getCustodyIntakeContext(request.id).then(value => {
      if (!active) return;
      setContext(value);
      setForm(prev => ({ ...prev, itemName: value.post.title, description: value.post.description ?? "", categoryId: value.post.categoryId ?? "",
        areaId: value.post.areaId ?? "", buildingId: value.post.buildingId ?? "", roomText: value.post.roomText ?? "",
        finderName: value.post.finderName ?? request.requester.fullName ?? "", finderContact: value.post.finderContact ?? "" }));
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Không thể tải thông tin bài gốc"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request?.id]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [busy, onClose]);
  function change(field: keyof typeof empty, value: string) {
    setForm(prev => ({ ...prev, [field]: value, ...(field === "areaId" ? { buildingId: "" } : {}) }));
    setConfirmed(false);
    setErrors(prev => ({ ...prev, [field]: "" }));
  }
  const fieldError = (field: string) => errors[field] ? <small className="field-error" role="alert">{errors[field]}</small> : null;
  async function upload(files: File[]) {
    if (busy || !files.length) return;
    if (photos.length + files.length > 5) { setErrors(prev => ({ ...prev, intakeImageIds: "Chọn từ 1 đến 5 ảnh tiếp nhận." })); return; }
    setBusy("upload"); setError(""); setConfirmed(false);
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) throw new Error("Mỗi ảnh không được vượt quá 5 MB.");
        const result = await api.uploadIntakeImage(file, intakeKey, request?.id);
        setPhotos(prev => [...prev, { id: result.id, file }]);
      }
      setErrors(prev => ({ ...prev, intakeImageIds: "" }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải ảnh tiếp nhận"); }
    finally { setBusy(""); }
  }
  async function remove(photo: Photo) {
    setBusy("remove"); setError("");
    try { await api.deleteIntakeImage(photo.id, intakeKey); setPhotos(prev => prev.filter(item => item.id !== photo.id)); setConfirmed(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể xóa ảnh"); }
    finally { setBusy(""); }
  }
  async function analyze() {
    setBusy("analysis"); setError("");
    try { setAnalysis(await api.analyzePostImage("FOUND", photos.map(photo => photo.file))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Phân tích ảnh chưa sẵn sàng; thông tin đã nhập vẫn được giữ nguyên."); }
    finally { setBusy(""); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || loading) return;
    const next: Record<string, string> = {};
    if (!request && !form.handoverPointId) next.handoverPointId = "Cần chọn điểm bàn giao.";
    if (!form.itemName.trim() || form.itemName.length > 200) next.itemName = "Tên vật phẩm cần từ 1 đến 200 ký tự.";
    if (!form.conditionNotes.trim()) next.conditionNotes = "Cần ghi nhận tình trạng thực tế.";
    if (!form.accessories.trim()) next.accessories = "Cần ghi phụ kiện thực nhận; ghi Không có nếu không kèm phụ kiện.";
    const quantity = Number(form.receivedQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) next.receivedQuantity = "Số lượng thực nhận phải từ 1 đến 999.";
    if (photos.length < 1 || photos.length > 5) next.intakeImageIds = "Cần từ 1 đến 5 ảnh tình trạng do Staff tải lên.";
    if (!confirmed) next.confirmed = "Cần xác nhận đã kiểm tra vật phẩm thực tế.";
    setErrors(next); setError("");
    if (Object.keys(next).length) return;
    setBusy("save");
    try {
      const payload = { intakeKey, intakeImageIds: photos.map(photo => photo.id), receivedQuantity: quantity, accessories: form.accessories, physicalReviewConfirmed: true as const,
        itemName: form.itemName, description: clean(form.description), categoryId: clean(form.categoryId), areaId: clean(form.areaId),
        buildingId: clean(form.buildingId), roomText: clean(form.roomText), finderName: clean(form.finderName), finderContact: clean(form.finderContact), conditionNotes: form.conditionNotes };
      const receivedAt = form.receivedAt ? new Date(form.receivedAt).toISOString() : undefined;
      if (request) { await api.confirmCustodyIntake(request.id, { ...payload, confirmedHandoverAt: receivedAt ?? null }); await onReceived(); }
      else { const item = await api.createWarehouseItem({ ...payload, handoverPointId: form.handoverPointId, ...(receivedAt ? { receivedAt } : {}) }); await onReceived(item); }
    } catch (reason) {
      if (reason instanceof ApiError) setErrors(Object.fromEntries(Object.entries(reason.fieldErrors).map(([key, messages]) => [key, messages.join(" ")])));
      setError(reason instanceof Error ? reason.message : "Không thể xác nhận tiếp nhận");
    } finally { setBusy(""); }
  }
  return <div className="custody-modal-overlay" onClick={() => { if (!busy) onClose(); }}>
    <div className="custody-modal custody-modal--lg intake-dialog" role="dialog" aria-modal="true" aria-labelledby="intake-heading" onClick={event => event.stopPropagation()}>
      <div className="custody-modal__header"><CheckCircle2 size={24} /><h3 id="intake-heading">{request ? "Đối chiếu và tiếp nhận vật phẩm" : "Tiếp nhận trực tiếp (Walk-in / Tại quầy)"}</h3>
        <button type="button" className="close-btn" aria-label="Đóng tiếp nhận" disabled={Boolean(busy)} onClick={onClose}><X size={20} /></button></div>
      {loading && <p role="status">Đang tải thông tin bài gốc...</p>}
      {context && <section className="intake-source"><h4>Thông tin bài gốc</h4><WarehouseImageGallery images={context.images} />
        <dl><dt>Vật phẩm</dt><dd>{context.post.title}</dd><dt>Mô tả</dt><dd>{context.post.description ?? "Chưa có"}</dd>
          <dt>Danh mục</dt><dd>{catalog?.categories.find(item => item.id === context.post.categoryId)?.name ?? "Chưa có"}</dd>
          <dt>Vị trí</dt><dd>{[catalog?.areas.find(item => item.id === context.post.areaId)?.name, catalog?.buildings.find(item => item.id === context.post.buildingId)?.name, context.post.roomText].filter(Boolean).join(" · ") || "Chưa có"}</dd>
          <dt>Người bàn giao</dt><dd>{context.post.finderName ?? request?.requester.fullName} · {context.post.finderContact ?? "Chưa có liên hệ"}</dd>
          <dt>Điểm bàn giao</dt><dd>{request?.handoverPoint?.name}</dd></dl></section>}
      <form className="admin-form modal-form" onSubmit={submit} noValidate>
        <h4>Đối chiếu tại quầy</h4>
        {!request && <label className="input-field"><span>Điểm bàn giao *</span><select value={form.handoverPointId} onChange={event => change("handoverPointId", event.target.value)}><option value="">Chọn điểm bàn giao</option>{catalog?.handoverPoints.map(item => <option key={item.id} value={item.id}>{item.name} - {item.address}</option>)}</select>{fieldError("handoverPointId")}</label>}
        <label className="input-field"><span>Tên vật phẩm *</span><input value={form.itemName} onChange={event => change("itemName", event.target.value)} />{fieldError("itemName")}</label>
        <label className="input-field"><span>Danh mục</span><select value={form.categoryId} onChange={event => change("categoryId", event.target.value)}><option value="">Chọn danh mục</option>{catalog?.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError("categoryId")}</label>
        <label className="input-field"><span>Mô tả chi tiết</span><textarea rows={3} value={form.description} onChange={event => change("description", event.target.value)} />{fieldError("description")}</label>
        <div className="warehouse-form-pair"><label className="input-field"><span>Khu vực</span><select value={form.areaId} onChange={event => change("areaId", event.target.value)}><option value="">Chọn khu vực</option>{catalog?.areas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError("areaId")}</label>
          <label className="input-field"><span>Tòa nhà / Địa điểm</span><select value={form.buildingId} onChange={event => change("buildingId", event.target.value)}><option value="">Chọn tòa nhà</option>{catalog?.buildings.filter(item => !form.areaId || item.areaId === form.areaId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError("buildingId")}</label></div>
        <label className="input-field"><span>Vị trí nhặt được</span><input value={form.roomText} onChange={event => change("roomText", event.target.value)} />{fieldError("roomText")}</label>
        <div className="warehouse-form-pair"><label className="input-field"><span>Người bàn giao</span><input value={form.finderName} onChange={event => change("finderName", event.target.value)} />{fieldError("finderName")}</label>
          <label className="input-field"><span>Liên hệ người giao</span><input value={form.finderContact} onChange={event => change("finderContact", event.target.value)} />{fieldError("finderContact")}</label></div>
        <label className="input-field"><span>Tình trạng khi nhận *</span><textarea rows={3} value={form.conditionNotes} onChange={event => change("conditionNotes", event.target.value)} />{fieldError("conditionNotes")}</label>
        <div className="warehouse-form-pair"><label className="input-field"><span>Số lượng thực nhận *</span><input type="number" min={1} max={999} value={form.receivedQuantity} onChange={event => change("receivedQuantity", event.target.value)} />{fieldError("receivedQuantity")}</label>
          <label className="input-field"><span>Phụ kiện thực nhận *</span><textarea rows={2} value={form.accessories} onChange={event => change("accessories", event.target.value)} />{fieldError("accessories")}</label></div>
        <label className="input-field"><span>Thời gian nhận thực tế</span><input type="datetime-local" value={form.receivedAt} onChange={event => change("receivedAt", event.target.value)} />{fieldError("receivedAt")}{fieldError("confirmedHandoverAt")}</label>
        <section className="intake-photos"><h4>Ảnh tình trạng tiếp nhận * ({photos.length}/5)</h4><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Ảnh tình trạng tiếp nhận" onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void upload(files); }} hidden />
          <div className="warehouse-image-gallery">{photos.map(photo => <div className="intake-photo" key={photo.id}><WarehouseImageView image={{ id: photo.id, provenance: "INTAKE" }} /><button type="button" className="secondary-button" title="Xóa ảnh tiếp nhận" aria-label="Xóa ảnh tiếp nhận" disabled={Boolean(busy)} onClick={() => void remove(photo)}><Trash2 size={16} /></button></div>)}</div>
          <div className="intake-photo-actions"><button type="button" className="secondary-button" disabled={Boolean(busy) || photos.length >= 5} onClick={() => fileInput.current?.click()}><ImagePlus size={17} />Thêm ảnh tiếp nhận</button>
            <button type="button" className="secondary-button" disabled={Boolean(busy) || !photos.length} onClick={() => void analyze()}><ScanLine size={17} />Phân tích ảnh</button></div>{fieldError("intakeImageIds")}
        </section>
        {analysis && <section className="intake-analysis"><h4>Gợi ý từ ảnh</h4><p><strong>{analysis.title}</strong></p><p>{analysis.description}</p><p>{analysis.suggestedCategory?.name}</p>{analysis.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
          <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => { setForm(prev => ({ ...prev, itemName: analysis.title, description: analysis.description, categoryId: analysis.suggestedCategory?.id ?? prev.categoryId })); setConfirmed(false); setAnalysis(null); }}>Áp dụng gợi ý</button></section>}
        <label className="intake-confirm"><input type="checkbox" checked={confirmed} disabled={Boolean(busy)} onChange={event => { setConfirmed(event.target.checked); setErrors(prev => ({ ...prev, confirmed: "", physicalReviewConfirmed: "" })); }} /><span>Tôi đã đối chiếu vật phẩm, số lượng, phụ kiện và ảnh tình trạng tại quầy.</span></label>{fieldError("confirmed")}{fieldError("physicalReviewConfirmed")}
        {error && <p className="field-error" role="alert">{error}</p>}
        {busy && <p role="status">{busy === "analysis" ? "Đang phân tích ảnh..." : busy === "save" ? "Đang xác nhận tiếp nhận..." : "Đang xử lý ảnh..."}</p>}
        <div className="custody-modal-actions"><button className="primary-button" disabled={Boolean(busy) || loading || Boolean(request && !context)}>{busy ? <LoaderCircle className="spin-icon" size={17} /> : <CheckCircle2 size={17} />}{request ? "Xác nhận tiếp nhận" : "Tạo hồ sơ kho (Walk-in)"}</button><button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={onClose}>Hủy</button></div>
      </form>
    </div>
  </div>;
}
