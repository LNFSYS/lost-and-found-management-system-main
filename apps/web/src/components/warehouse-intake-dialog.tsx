import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, CheckCircle2, Eye, ImagePlus, Info, LoaderCircle, ScanLine, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { api, ApiError, type ClaimHistoryResponse, type ClaimStatus, type CustodyIntakeContext, type CustodyRequest, type DamageAnalysisResult, type WarehouseCatalog, type WarehouseConversationExtraction, type WarehouseItem } from "../services/api";
import { WarehouseImageGallery, WarehouseImageView } from "./warehouse-images";
import { WarehouseConversationChat } from "./warehouse-conversation-chat";
import { useModalFocus } from "../hooks/use-modal-focus";

const empty = { handoverPointId: "", itemName: "", description: "", categoryId: "", areaId: "", buildingId: "", roomText: "", finderName: "", finderContact: "", conditionNotes: "", accessories: "", receivedQuantity: "1", receivedAt: "" };
type Analysis = Awaited<ReturnType<typeof api.analyzePostImage>>;
type Photo = { id: string; file: File };
const clean = (value: string) => value.trim() || null;

const claimActionLabels: Record<string, string> = {
  CLAIM_CREATED: "Claim được tạo",
  CONVERSATION_OPENED: "Mở trao đổi riêng",
  CLAIM_ACCEPTED: "Claim được chấp nhận",
  CLAIM_REJECTED: "Claim bị từ chối",
  CLAIM_WITHDRAWN: "Claim được rút",
  MESSAGE_SENT: "Gửi tin nhắn",
  QUESTION_SENT: "Gửi câu hỏi xác minh",
  ANSWER_SUBMITTED: "Trả lời câu hỏi xác minh",
  MORE_INFO_REQUESTED: "Yêu cầu bổ sung thông tin",
  VERIFICATION_ACCEPTED: "Xác minh đủ điều kiện gặp mặt",
  VERIFICATION_DECLINED: "Từ chối claim sau xác minh",
  VERIFICATION_DECISION_CORRECTED: "Điều chỉnh quyết định xác minh",
  CUSTODY_ESCALATED: "Chuyển yêu cầu sang custody",
  STAFF_CUSTODY_VERIFIED: "Staff ghi nhận kết quả xác minh",
  DIRECT_RETURN_COMPLETED: "Ghi nhận hoàn trả trực tiếp",
  PRIVATE_EVIDENCE_UPLOADED: "Thêm bằng chứng riêng"
};

const claimStatusLabels: Record<ClaimStatus, string> = {
  PENDING: "Chờ Finder",
  CONVERSATION_OPEN: "Đang trao đổi",
  NEED_MORE_INFO: "Cần thêm thông tin",
  ACCEPTED: "Đủ điều kiện gặp mặt",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã đóng"
};

function formatConditionLabel(grade: string): string {
  const match = grade.match(/^Grade\s+[A-D]\+?\s*\((.*)\)$/i);
  if (match && match[1]) return match[1].trim();
  return grade.replace(/^Grade\s+[A-D]\+?\s*-?\s*/i, "").trim() || grade;
}

function getConditionBadgeStyle(score: number) {
  if (score >= 90) return { bg: "#dcfce7", color: "#166534" };
  if (score >= 75) return { bg: "#dbeafe", color: "#1e40af" };
  if (score >= 50) return { bg: "#fef3c7", color: "#92400e" };
  return { bg: "#fee2e2", color: "#991b1b" };
}

function cleanAutoConditionNotes(notes: string, autoNote?: string): string {
  let cleaned = notes;
  if (autoNote && cleaned.includes(autoNote)) {
    cleaned = cleaned.replace(autoNote, "");
  }
  return cleaned
    .split("\n")
    .map(line => line.trim())
    .filter(line => Boolean(line) && !line.startsWith("[AI Đánh giá:") && !line.startsWith("Tình trạng:"))
    .join("\n")
    .trim();
}

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
  const [damageInspection, setDamageInspection] = useState<DamageAnalysisResult | null>(null);
  const [inspectedPhotoId, setInspectedPhotoId] = useState<string | null>(null);
  const [showDamagePreview, setShowDamagePreview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [claimHistory, setClaimHistory] = useState<ClaimHistoryResponse | null>(null);
  const [showClaimHistory, setShowClaimHistory] = useState(false);
  const manuallyEditedFields = useRef(new Set<string>());
  const lastAutoConditionNote = useRef<string>("");
  const fileInput = useRef<HTMLInputElement>(null);
  const modal = useRef<HTMLDivElement>(null);
  useModalFocus(modal, true, onClose, Boolean(busy));
  useEffect(() => {
    let active = true;
    if (request) {
      void api.getCustodyIntakeContext(request.id).then(value => {
        if (!active) return;
        setContext(value);
        setForm(prev => ({ ...prev, itemName: value.post.title, description: value.post.description ?? "", categoryId: value.post.categoryId ?? "",
          areaId: value.post.areaId ?? "", buildingId: value.post.buildingId ?? "", roomText: value.post.roomText ?? "",
          finderName: value.post.finderName ?? request.requester.fullName ?? "", finderContact: value.post.finderContact ?? "" }));
      }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Không thể tải thông tin bài gốc"); })
        .finally(() => { if (active) setLoading(false); });

      if (request.claimId) {
        void api.getClaimHistory(request.claimId).then(history => {
          if (active) setClaimHistory(history);
        }).catch(() => {});
      }
    }
    return () => { active = false; };
  }, [request?.id, request?.claimId]);
  function change(field: keyof typeof empty, value: string) {
    manuallyEditedFields.current.add(field);
    setForm(prev => ({ ...prev, [field]: value, ...(field === "areaId" ? { buildingId: "" } : {}) }));
    setConfirmed(false);
    setErrors(prev => ({ ...prev, [field]: "" }));
  }
  function applyConversationExtraction(result: WarehouseConversationExtraction) {
    if (result.mode !== "INTAKE") return;
    const fields = result.fields;
    const patch: Partial<typeof empty> = {};
    const applyText = (field: keyof typeof empty, value: string | null) => {
      if (value !== null && !manuallyEditedFields.current.has(field)) patch[field] = value;
    };
    applyText("itemName", fields.itemName);
    applyText("description", fields.description);
    applyText("categoryId", fields.categoryId);
    const locationTouched = manuallyEditedFields.current.has("areaId") || manuallyEditedFields.current.has("buildingId");
    if (!locationTouched) {
      applyText("areaId", fields.areaId);
      applyText("buildingId", fields.buildingId);
    }
    applyText("roomText", fields.roomText);
    applyText("finderName", fields.finderName);
    applyText("finderContact", fields.finderContact);
    applyText("conditionNotes", fields.conditionNotes);
    applyText("accessories", fields.accessories);
    if (fields.receivedQuantity !== null && !manuallyEditedFields.current.has("receivedQuantity")) patch.receivedQuantity = String(fields.receivedQuantity);
    if (!Object.keys(patch).length) return;
    setForm(previous => ({ ...previous, ...patch }));
    setErrors(previous => Object.fromEntries(Object.entries(previous).map(([field, message]) => [field, Object.keys(patch).includes(field) ? "" : message])));
    setConfirmed(false);
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
        setPhotos(prev => prev.some(photo => photo.id === result.id) ? prev : [...prev, { id: result.id, file }]);
      }
      setErrors(prev => ({ ...prev, intakeImageIds: "" }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải ảnh tiếp nhận"); }
    finally { setBusy(""); }
  }
  async function remove(photo: Photo) {
    setBusy("remove"); setError("");
    try {
      await api.deleteIntakeImage(photo.id, intakeKey);
      setPhotos(prev => prev.filter(item => item.id !== photo.id));
      setConfirmed(false);
      if (!inspectedPhotoId || photo.id === inspectedPhotoId || photos.length <= 1) {
        setDamageInspection(null);
        setShowDamagePreview(false);
        setInspectedPhotoId(null);
        setForm(prev => ({
          ...prev,
          conditionNotes: cleanAutoConditionNotes(prev.conditionNotes, lastAutoConditionNote.current)
        }));
        lastAutoConditionNote.current = "";
      }
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể xóa ảnh"); }
    finally { setBusy(""); }
  }
  async function analyze() {
    setBusy("analysis"); setError("");
    try { setAnalysis(await api.analyzePostImage("FOUND", photos.map(photo => photo.file))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Phân tích ảnh chưa sẵn sàng; thông tin đã nhập vẫn được giữ nguyên."); }
    finally { setBusy(""); }
  }
  async function runDamageInspection(targetPhoto?: Photo) {
    const photoToAnalyze = targetPhoto ?? photos[0];
    if (!photoToAnalyze) {
      setError("Cần có ít nhất 1 ảnh tiếp nhận để quét vết xước.");
      return;
    }
    setBusy("damage_inspection"); setError("");
    try {
      const result = await api.analyzeDamageInspection(photoToAnalyze.file);
      setDamageInspection(result);
      setInspectedPhotoId(photoToAnalyze.id);
      setShowDamagePreview(true);
      const conditionLabel = formatConditionLabel(result.grade);
      const defectSummary = Object.entries(result.defectCounts)
        .map(([name, count]) => `${count} ${name}`)
        .join(", ");
      const generatedNote = result.totalDefects > 0
        ? `Tình trạng: ${conditionLabel}. ${result.statusText} Phát hiện ${result.totalDefects} khuyết tật (${defectSummary}), diện tích ảnh hưởng ~${result.damagePercentage}%.`
        : `Tình trạng: ${conditionLabel}. ${result.statusText} Bề mặt liền lạc, không phát hiện vết xước/lỗi đáng kể.`;

      setForm(prev => {
        const prevCleaned = cleanAutoConditionNotes(prev.conditionNotes, lastAutoConditionNote.current);
        const nextNotes = prevCleaned ? `${prevCleaned}\n${generatedNote}` : generatedNote;
        return { ...prev, conditionNotes: nextNotes };
      });
      lastAutoConditionNote.current = generatedNote;
      setConfirmed(false);
      setErrors(prev => ({ ...prev, conditionNotes: "" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mô hình AI quét khuyết tật chưa phản hồi.");
    } finally {
      setBusy("");
    }
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
    <div ref={modal} tabIndex={-1} className="custody-modal custody-modal--lg intake-dialog" role="dialog" aria-modal="true" aria-labelledby="intake-heading" onClick={event => event.stopPropagation()}>
      <div className="custody-modal__header">
        <span className="modal-badge modal-badge--blue"><CheckCircle2 size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 id="intake-heading">{request ? "Đối chiếu và tiếp nhận vật phẩm" : "Tiếp nhận trực tiếp (Walk-in / Tại quầy)"}</h3>
          <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
            {request ? `Đơn custody: #${request.id.slice(0, 8)} · Điểm nhận: ${request?.handoverPoint?.name ?? "Tại quầy"}` : "Tạo mới hồ sơ lưu kho từ vật phẩm tiếp nhận tại quầy"}
          </p>
        </div>
        <button type="button" className="close-btn" aria-label="Đóng tiếp nhận" disabled={Boolean(busy)} onClick={onClose}><X size={18} /></button>
      </div>

      <form className="intake-dialog__body" onSubmit={submit} noValidate>
        <div className="intake-workspace-grid">
          {/* CỘT TRÁI: DỮ LIỆU ĐỐI CHIẾU, ẢNH & AI */}
          <div className="intake-workspace-left">
            {loading && <p role="status">Đang tải thông tin bài gốc...</p>}
            {context && (
              <section className="intake-card intake-card--source">
                <h4 className="intake-card__title">
                  <span className="intake-card__icon"><Info size={16} /></span>
                  Thông tin bài đăng gốc
                </h4>
                <WarehouseImageGallery images={context.images} />
                <dl className="intake-source-dl">
                  <dt>Vật phẩm</dt><dd><strong>{context.post.title}</strong></dd>
                  <dt>Mô tả gốc</dt><dd>{context.post.description ?? "Chưa có"}</dd>
                  <dt>Danh mục</dt><dd>{catalog?.categories.find(item => item.id === context.post.categoryId)?.name ?? "Chưa có"}</dd>
                  <dt>Vị trí</dt><dd>{[catalog?.areas.find(item => item.id === context.post.areaId)?.name, catalog?.buildings.find(item => item.id === context.post.buildingId)?.name, context.post.roomText].filter(Boolean).join(" · ") || "Chưa có"}</dd>
                  <dt>Người bàn giao</dt><dd>{context.post.finderName ?? request?.requester.fullName} {context.post.finderContact ? `· ${context.post.finderContact}` : ""}</dd>
                  <dt>Điểm bàn giao</dt><dd>{request?.handoverPoint?.name}</dd>
                </dl>
              </section>
            )}

            {request?.claimId && claimHistory && claimHistory.events.length > 0 && (
              <section className="intake-card" style={{ borderLeft: "4px solid #2563eb" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                  <h4 className="intake-card__title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                    <ShieldCheck size={16} color="#2563eb" />
                    Lịch sử Claim & Xác minh ({claimHistory.events.length})
                  </h4>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ padding: "3px 10px", fontSize: "0.75rem" }}
                    onClick={() => setShowClaimHistory(prev => !prev)}
                  >
                    {showClaimHistory ? "Thu gọn" : "Xem chi tiết"}
                  </button>
                </div>
                {showClaimHistory && (
                  <div style={{ marginTop: "12px", maxHeight: "240px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
                    {claimHistory.events.map((event) => (
                      <div key={event.id} style={{ fontSize: "0.8rem", padding: "8px 10px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "6px", fontWeight: 600 }}>
                          <span>{claimActionLabels[event.action] ?? event.action}</span>
                          <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{new Date(event.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>
                        </div>
                        <div style={{ color: "#475569", marginTop: "2px" }}>{event.actor}</div>
                        {(event.fromStatus || event.toStatus) && (
                          <div style={{ color: "#2563eb", fontWeight: 600, marginTop: "2px", fontSize: "0.76rem" }}>
                            {event.fromStatus ? claimStatusLabels[event.fromStatus] ?? event.fromStatus : "Bắt đầu"} → {event.toStatus ? claimStatusLabels[event.toStatus] ?? event.toStatus : "—"}
                          </div>
                        )}
                        {event.metadata?.decision && <div style={{ marginTop: "2px" }}><strong>Quyết định:</strong> {event.metadata.decision}</div>}
                        {event.metadata?.reason && <div style={{ marginTop: "2px" }}><strong>Lý do:</strong> {event.metadata.reason}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="intake-card">
              <div className="intake-card__header-row">
                <h4 className="intake-card__title" style={{ margin: 0 }}>
                  <span className="intake-card__icon"><ImagePlus size={16} /></span>
                  Ảnh tình trạng tiếp nhận * ({photos.length}/5)
                </h4>
                <span className="intake-card__hint">Tối đa 5 ảnh (JPEG/PNG/WEBP)</span>
              </div>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Ảnh tình trạng tiếp nhận" onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void upload(files); }} hidden />
              <div className="warehouse-image-gallery">
                {photos.map(photo => (
                  <div className="intake-photo" key={photo.id} style={{ position: "relative" }}>
                    <WarehouseImageView image={{ id: photo.id, provenance: "INTAKE" }} />
                    <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className="secondary-button"
                        title="AI Quét vết xước ảnh này"
                        aria-label="AI Quét vết xước ảnh này"
                        style={{ padding: "4px 6px", background: "rgba(255, 255, 255, 0.92)", borderRadius: "4px" }}
                        disabled={Boolean(busy)}
                        onClick={() => void runDamageInspection(photo)}
                      >
                        <Sparkles size={14} color="#2563eb" />
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        title="Xóa ảnh tiếp nhận"
                        aria-label="Xóa ảnh tiếp nhận"
                        style={{ padding: "4px 6px", background: "rgba(255, 255, 255, 0.92)", borderRadius: "4px" }}
                        disabled={Boolean(busy)}
                        onClick={() => void remove(photo)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="intake-photo-actions" style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                <button type="button" className="secondary-button" disabled={Boolean(busy) || photos.length >= 5} onClick={() => fileInput.current?.click()}>
                  <ImagePlus size={16} />
                  Thêm ảnh tiếp nhận
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={Boolean(busy) || !photos.length}
                  onClick={() => void runDamageInspection()}
                  title="Quét vết trầy xước, nứt, móp bằng mô hình AI và tự điền tình trạng"
                >
                  <Sparkles size={16} color="#2563eb" />
                  AI Quét vết xước
                </button>
                <button type="button" className="secondary-button" disabled={Boolean(busy) || !photos.length} onClick={() => void analyze()}>
                  <ScanLine size={16} />
                  Gợi ý danh mục (AI)
                </button>
              </div>
              {fieldError("intakeImageIds")}
            </section>

            {damageInspection && (
              <section className="intake-card intake-damage-report" style={{
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Sparkles size={18} color="#2563eb" />
                    <strong style={{ fontSize: "0.95rem" }}>Tình trạng nhận diện:</strong>
                    <span style={{
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      background: getConditionBadgeStyle(damageInspection.conditionScore).bg,
                      color: getConditionBadgeStyle(damageInspection.conditionScore).color
                    }}>
                      {formatConditionLabel(damageInspection.grade)}
                    </span>
                  </div>
                  {damageInspection.annotatedImage && (
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ padding: "4px 8px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}
                      onClick={() => setShowDamagePreview(prev => !prev)}
                    >
                      <Eye size={14} />
                      {showDamagePreview ? "Ẩn ảnh khoanh vùng" : "Xem ảnh khoanh vùng lỗi"}
                    </button>
                  )}
                </div>
                <p style={{ margin: "6px 0 2px 0", fontSize: "0.85rem", color: "#334155" }}>
                  {damageInspection.statusText} · Phát hiện <strong>{damageInspection.totalDefects}</strong> khuyết tật
                  {damageInspection.totalDefects > 0 && ` (${Object.entries(damageInspection.defectCounts).map(([name, count]) => `${count} ${name}`).join(", ")})`}
                  {`, diện tích ảnh hưởng ~${damageInspection.damagePercentage}%.`}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                  * Đã tự động cập nhật vào ô "Tình trạng khi nhận". Bạn có thể kiểm tra và chỉnh sửa lại nếu cần.
                </p>
                {showDamagePreview && damageInspection.annotatedImage && (
                  <div style={{ marginTop: "10px", textAlign: "center", background: "#0f172a", borderRadius: "6px", padding: "8px" }}>
                    <img
                      src={damageInspection.annotatedImage}
                      alt="Ảnh khoanh vùng vết xước"
                      style={{ maxHeight: "280px", maxWidth: "100%", objectFit: "contain", borderRadius: "4px" }}
                    />
                    <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "4px 0 0 0" }}>
                      Mô hình nhận diện vết xước/lỗi và đánh dấu bằng khung viền kèm tên lỗi & độ tin cậy.
                    </p>
                  </div>
                )}
              </section>
            )}

            {analysis && (
              <section className="intake-card intake-analysis">
                <h4>Gợi ý từ ảnh</h4>
                <p><strong>{analysis.title}</strong></p>
                <p>{analysis.description}</p>
                <p>{analysis.suggestedCategory?.name}</p>
                {analysis.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
                <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => { setForm(prev => ({ ...prev, itemName: analysis.title, description: analysis.description, categoryId: analysis.suggestedCategory?.id ?? prev.categoryId })); setConfirmed(false); setAnalysis(null); }}>Áp dụng gợi ý</button>
              </section>
            )}

            <section className="intake-card">
              <h4 className="intake-card__title">
                <span className="intake-card__icon"><Bot size={16} /></span>
                Trợ lý AI đối chiếu tại quầy
              </h4>
              <WarehouseConversationChat mode="INTAKE" intakeKind={request ? "CUSTODY_REQUEST" : "WALK_IN"} onExtraction={applyConversationExtraction} disabled={Boolean(busy) || loading} allowImages={true} />
            </section>
          </div>

          {/* CỘT PHẢI: FORM NHẬP HỒ SƠ KHO */}
          <div className="intake-workspace-right">
            {!request && <label className="input-field" style={{ margin: 0 }}><span>Điểm bàn giao *</span><select value={form.handoverPointId} onChange={event => change("handoverPointId", event.target.value)}><option value="">Chọn điểm bàn giao</option>{catalog?.handoverPoints.map(item => <option key={item.id} value={item.id}>{item.name} - {item.address}</option>)}</select>{fieldError("handoverPointId")}</label>}
            
            <div className="warehouse-form-pair">
              <label className="input-field" style={{ margin: 0 }}><span>Tên vật phẩm *</span><input value={form.itemName} onChange={event => change("itemName", event.target.value)} placeholder="Nhập tên vật phẩm..." />{fieldError("itemName")}</label>
              <label className="input-field" style={{ margin: 0 }}><span>Danh mục</span><select value={form.categoryId} onChange={event => change("categoryId", event.target.value)}><option value="">Chọn danh mục</option>{catalog?.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError("categoryId")}</label>
            </div>

            <label className="input-field" style={{ margin: 0 }}><span>Mô tả chi tiết</span><textarea rows={2} value={form.description} onChange={event => change("description", event.target.value)} placeholder="Đặc điểm nhận diện, màu sắc, chi tiết riêng..." />{fieldError("description")}</label>

            <div className="warehouse-form-pair">
              <label className="input-field" style={{ margin: 0 }}><span>Khu vực</span><select value={form.areaId} onChange={event => change("areaId", event.target.value)}><option value="">Chọn khu vực</option>{catalog?.areas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError("areaId")}</label>
              <label className="input-field" style={{ margin: 0 }}><span>Tòa nhà / Địa điểm</span><select value={form.buildingId} onChange={event => change("buildingId", event.target.value)}><option value="">Chọn tòa nhà</option>{catalog?.buildings.filter(item => !form.areaId || item.areaId === form.areaId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError("buildingId")}</label>
            </div>

            <label className="input-field" style={{ margin: 0 }}><span>Vị trí nhặt được</span><input value={form.roomText} onChange={event => change("roomText", event.target.value)} placeholder="VD: Phòng 301, Sảnh tòa Alpha..." />{fieldError("roomText")}</label>

            <div className="warehouse-form-pair">
              <label className="input-field" style={{ margin: 0 }}><span>Người bàn giao</span><input value={form.finderName} onChange={event => change("finderName", event.target.value)} placeholder="Họ và tên người giao..." />{fieldError("finderName")}</label>
              <label className="input-field" style={{ margin: 0 }}><span>Liên hệ người giao</span><input value={form.finderContact} onChange={event => change("finderContact", event.target.value)} placeholder="SĐT hoặc email..." />{fieldError("finderContact")}</label>
            </div>

            <label className="input-field" style={{ margin: 0 }}>
              <span>Tình trạng khi nhận *</span>
              <textarea rows={3} value={form.conditionNotes} onChange={event => change("conditionNotes", event.target.value)} placeholder="Ghi nhận tình trạng vật lý thực tế..." />
              {fieldError("conditionNotes")}
            </label>

            <div className="warehouse-form-pair">
              <label className="input-field" style={{ margin: 0 }}><span>Số lượng thực nhận *</span><input type="number" min={1} max={999} value={form.receivedQuantity} onChange={event => change("receivedQuantity", event.target.value)} />{fieldError("receivedQuantity")}</label>
              <label className="input-field" style={{ margin: 0 }}><span>Phụ kiện thực nhận *</span><textarea rows={2} value={form.accessories} onChange={event => change("accessories", event.target.value)} placeholder="Ghi phụ kiện hoặc 'Không có'..." />{fieldError("accessories")}</label>
            </div>

            <label className="input-field" style={{ margin: 0 }}><span>Thời gian nhận thực tế</span><input type="datetime-local" value={form.receivedAt} onChange={event => change("receivedAt", event.target.value)} />{fieldError("receivedAt")}{fieldError("confirmedHandoverAt")}</label>

            <label className="intake-confirm" style={{ marginTop: "4px" }}>
              <input type="checkbox" checked={confirmed} disabled={Boolean(busy)} onChange={event => { setConfirmed(event.target.checked); setErrors(prev => ({ ...prev, confirmed: "", physicalReviewConfirmed: "" })); }} />
              <span>Tôi đã đối chiếu vật phẩm, số lượng, phụ kiện và ảnh tình trạng tại quầy.</span>
            </label>
            {fieldError("confirmed")}{fieldError("physicalReviewConfirmed")}

            {error && <p className="field-error" role="alert">{error}</p>}
            {busy && <p role="status" style={{ margin: "4px 0", color: "#2563eb", fontSize: "0.85rem" }}>{busy === "damage_inspection" ? "Đang chạy mô hình AI quét vết xước..." : busy === "analysis" ? "Đang phân tích gợi ý danh mục..." : busy === "save" ? "Đang xác nhận tiếp nhận..." : "Đang xử lý ảnh..."}</p>}

            <div className="custody-modal-actions" style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
              <button className="primary-button" disabled={Boolean(busy) || loading || Boolean(request && !context)}>
                {busy ? <LoaderCircle className="spin-icon" size={17} /> : <CheckCircle2 size={17} />}
                {request ? "Xác nhận tiếp nhận" : "Tạo hồ sơ kho (Walk-in)"}
              </button>
              <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={onClose}>Hủy</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>;
}
