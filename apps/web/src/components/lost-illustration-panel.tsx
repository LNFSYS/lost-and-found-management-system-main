import { Check, ImageOff, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, type LostIllustration, type LostIllustrationDraft } from "../services/api";

interface Props {
  title: string; description: string; categoryId: string; online: boolean; disabled: boolean; canSelect: boolean;
  onSelect: (id: string | null) => void; onBusy: (busy: boolean) => void; onDraft: (id: string | null) => void;
}

export function LostIllustrationPanel({ title, description, categoryId, online, disabled, canSelect, onSelect, onBusy, onDraft }: Props) {
  const [draft, setDraft] = useState<LostIllustrationDraft | null>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [viewedId, setViewedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [imageRetry, setImageRetry] = useState(0);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const epoch = useRef(0);
  const retry = useRef<{ key: string; fingerprint: string } | null>(null);
  const pending = draft?.attempts.some(attempt => attempt.status === "PENDING") ?? false;
  const ready = draft?.attempts.filter(attempt => attempt.status === "READY") ?? [];
  const viewed = ready.find(attempt => attempt.id === viewedId) ?? ready[ready.length - 1];
  const matchesInput = (attempt: LostIllustration) => attempt.title === title.trim() && attempt.description === description.trim() && attempt.categoryId === categoryId;
  const blockedUntil = Math.max(retryAt, draft?.cooldown?.until ?? 0);
  const waiting = Math.max(0, Math.ceil((blockedUntil - now) / 1000));

  useEffect(() => {
    setNow(Date.now());
    if (blockedUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= blockedUntil) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [blockedUntil]);

  useEffect(() => {
    const scope = ++epoch.current;
    const controller = new AbortController();
    api.getLostIllustrationDraft(controller.signal).then(value => { if (epoch.current === scope) setDraft(value); })
      .catch(reason => { if (!controller.signal.aborted && epoch.current === scope) setError(reason instanceof Error ? reason.message : "Không tải được lượt tạo ảnh."); });
    return () => { ++epoch.current; controller.abort(); };
  }, []);

  useEffect(() => {
    onBusy(generating || pending);
    return () => onBusy(false);
  }, [generating, pending, onBusy]);

  useEffect(() => { onDraft(draft?.id ?? null); }, [draft?.id, onDraft]);

  useEffect(() => { if (draft && !pending) retry.current = null; }, [draft, pending]);

  useEffect(() => {
    const selected = ready.find(attempt => attempt.id === selectedId);
    onSelect(selected && matchesInput(selected) && canSelect ? selected.id : null);
  }, [selectedId, draft, title, description, categoryId, canSelect, onSelect]);

  useEffect(() => {
    if (!pending || !online) return;
    const controller = new AbortController();
    let active = true;
    let inFlight = false;
    const timer = window.setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      api.getLostIllustrationDraft(controller.signal).then(value => {
        if (active) { setDraft(value); setError(""); }
      }).catch(() => { if (active) setError("Chưa cập nhật được ảnh. Lượt tạo vẫn được lưu; hãy kiểm tra lại trạng thái."); })
        .finally(() => { inFlight = false; });
    }, 3000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [pending, online]);

  useEffect(() => {
    let active = true, url = "";
    setImageUrl(""); setImageFailed(false);
    if (viewed?.url) api.getPostMedia(viewed.url).then(blob => {
      if (active) { url = URL.createObjectURL(blob); setImageUrl(url); }
    }).catch(() => { if (active) setImageFailed(true); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [viewed?.url, imageRetry]);

  async function refresh() {
    const scope = epoch.current;
    try {
      const value = await api.getLostIllustrationDraft();
      if (scope === epoch.current) { setDraft(value); setError(""); }
    } catch (reason) { if (scope === epoch.current) setError(reason instanceof Error ? reason.message : "Không tải được trạng thái."); }
  }

  async function generate() {
    if (!online || disabled || generating || pending || waiting || !draft?.available || draft.remaining <= 0) return;
    const scope = epoch.current;
    const fingerprint = JSON.stringify([title.trim(), description.trim(), categoryId]);
    const requestId = retry.current?.fingerprint === fingerprint ? retry.current.key : crypto.randomUUID();
    retry.current = { key: requestId, fingerprint };
    setGenerating(true); setError("");
    try {
      const result = await api.generateLostIllustration({ type: "LOST", title: title.trim(), description: description.trim(), categoryId, requestId });
      if (scope !== epoch.current) return;
      setDraft(result.draft);
      if (result.attempt.status === "READY") { setViewedId(result.attempt.id); retry.current = null; }
      if (["REJECTED", "FAILED"].includes(result.attempt.status)) {
        retry.current = null;
      }
    } catch (reason) {
      if (scope !== epoch.current) return;
      if (reason instanceof ApiError && (reason.status === 429 || reason.status === 504)) {
        setRetryAt(Math.max(reason.retryAt, Date.now() + 60_000));
      }
      setError(reason instanceof Error ? reason.message : "Chưa nhận được ảnh. Hãy kiểm tra trạng thái trước khi thử lại.");
      const value = await api.getLostIllustrationDraft().catch(() => null);
      if (scope === epoch.current && value) {
        setDraft(value);
        if (!value.attempts.some(attempt => attempt.status === "PENDING")) retry.current = null;
      }
    } finally { if (scope === epoch.current) setGenerating(false); }
  }

  const selected = viewed && selectedId === viewed.id && matchesInput(viewed) && canSelect;
  const latest = draft?.attempts[draft.attempts.length - 1];
  const exhausted = draft?.remaining === 0;
  const attemptMessage = latest?.status === "REJECTED"
    ? `Lượt ${latest.number}: ảnh chưa phù hợp mô tả nên chưa được duyệt.${exhausted ? "" : " Bạn có thể sửa mô tả và tạo lại."}`
    : latest?.status === "FAILED" ? `Lượt ${latest.number}: dịch vụ tạo hoặc kiểm tra ảnh chưa hoàn tất.${exhausted ? "" : " Bạn có thể thử lại khi dịch vụ sẵn sàng."}` : "";
  const errorMessage = waiting && draft?.cooldown?.message ? draft.cooldown.message : error || (!generating && !pending ? attemptMessage : "");
  return <section className="lost-illustration story-field--wide" aria-label="Ảnh minh họa vật bị mất">
    <div className="lost-illustration__heading"><Sparkles size={20} aria-hidden="true" /><h4>Ảnh minh họa từ mô tả</h4>
      {draft?.available && <span>{draft.used}/{draft.maxAttempts} lượt</span>}
    </div>
    {draft && !draft.available ? <p>Chức năng tạo ảnh chưa được bật. Bạn có thể đăng bài hoặc tải ảnh thật lên.</p> : <>
      <div className="lost-illustration__actions">
        <button type="button" className="story-analyze-button" disabled={!draft?.available || !online || disabled || generating || pending || waiting > 0 || draft.remaining === 0 || title.trim().length < 5 || description.trim().length < 20 || description.trim().length > 2000 || !categoryId} onClick={() => void generate()}>
          {generating || pending ? <><LoaderCircle className="is-spinning" size={18} aria-hidden="true" /> Đang tạo ảnh...</> : draft?.used ? <><RefreshCw size={18} aria-hidden="true" /> Tạo lại ảnh</> : <><Sparkles size={18} aria-hidden="true" /> Tạo ảnh minh họa</>}
        </button>
        <button className="lost-illustration__refresh" type="button" title="Kiểm tra trạng thái và lượt còn lại" aria-label="Kiểm tra trạng thái ảnh minh họa" disabled={!online || generating} onClick={() => void refresh()}><RefreshCw size={18} aria-hidden="true" /></button>
      </div>
      <p>1 lần tạo và tối đa 3 lần tạo lại. Chọn danh mục và mô tả rõ vật phẩm, màu sắc, chất liệu hoặc dấu hiệu riêng (20–2.000 ký tự).</p>
      {draft?.available && <p>Lượt đã bắt đầu tạo vẫn được tính khi dịch vụ gặp lỗi hoặc ảnh bị từ chối.</p>}
      {waiting > 0 && <p role="status">Tạm dừng thử lại: còn khoảng {waiting >= 3600 ? `${Math.ceil(waiting / 3600)} giờ` : waiting >= 60 ? `${Math.ceil(waiting / 60)} phút` : `${waiting} giây`}. Bạn vẫn có thể đăng bài không dùng ảnh AI.</p>}
      {exhausted && <p role="status">{ready.length
        ? "Đã dùng hết 4 lượt. Bạn có thể chọn ảnh đã được duyệt hoặc tải ảnh thật."
        : "Đã dùng hết 4 lượt và chưa có ảnh được duyệt. Bạn vẫn có thể đăng bài không dùng ảnh AI hoặc tải ảnh thật."}</p>}
      {latest?.status === "PENDING" && !online && <p role="status">Mất kết nối. Lượt tạo được lưu trên máy chủ; trạng thái sẽ cập nhật khi có mạng.</p>}
      {viewed && <>
        <figure className="lost-illustration__preview">
          {imageUrl && !imageFailed ? <img src={imageUrl} alt="Ảnh minh họa vật bị mất do AI tạo" onError={() => setImageFailed(true)} /> : <div><ImageOff size={28} aria-hidden="true" /><span>{imageFailed ? "Không tải được ảnh minh họa" : "Đang tải ảnh minh họa..."}</span>
            {imageFailed && <button className="lost-illustration__refresh" type="button" title="Tải lại ảnh minh họa" aria-label="Tải lại ảnh minh họa" onClick={() => setImageRetry(value => value + 1)}><RefreshCw size={18} aria-hidden="true" /></button>}
          </div>}
          <figcaption>Ảnh minh họa do AI tạo · Không phải ảnh thật hoặc bằng chứng sở hữu</figcaption>
          <p>Chữ/logo và chi tiết nhỏ có thể khác thực tế.</p>
        </figure>
        <div className="lost-illustration__choices" aria-label="Chọn phiên bản ảnh minh họa">{ready.map(attempt => <label key={attempt.id}>
          <input type="radio" name="illustration-version" checked={attempt.id === viewed.id} onChange={() => setViewedId(attempt.id)} /> Ảnh {attempt.number}
        </label>)}</div>
        {matchesInput(viewed) ? <label className="lost-illustration__select">
          <input type="checkbox" checked={Boolean(selected)} disabled={disabled || !canSelect || generating || pending || !imageUrl || imageFailed} onChange={event => setSelectedId(event.target.checked ? viewed.id : null)} />
          {selected && <Check size={16} />} Dùng ảnh này cho bài đăng
        </label> : <p role="status">Ảnh thuộc mô tả trước đó. Hãy tạo lại cho mô tả hiện tại hoặc dùng ảnh thật.</p>}
        {!canSelect && <p>Bài đăng đã có 5 ảnh. Hãy bỏ bớt một ảnh thật để chọn ảnh minh họa.</p>}
      </>}
    </>}
    {errorMessage && <p className="lost-illustration__error" role="alert">{errorMessage}</p>}
  </section>;
}
