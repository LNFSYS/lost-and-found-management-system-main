import {
  Camera,
  Check,
  ChevronRight,
  Clock3,
  ImagePlus,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../context/auth-context";
import {
  api,
  type CreatedPost,
  type ImageAnalysisResult,
  type PostCatalog
} from "../services/api";

export type StorySide = "LOST" | "FOUND";

const MAX_IMAGE_COUNT = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_ANALYSIS_TOTAL_BYTES = 14 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface StoryPostCreatedEvent {
  post: CreatedPost;
  categoryId: string;
}

interface StoryPostFormProps {
  type: StorySide;
  onAnalysisStart?: (files: File[]) => void;
  onAnalysisComplete?: (analysis: ImageAnalysisResult) => void;
  onAnalysisError?: (message: string) => void;
  onAnalysisReset?: () => void;
  onPostCreated?: (event: StoryPostCreatedEvent) => void;
  onSessionReset?: () => void;
}

interface DraftState {
  title: string;
  description: string;
  lostFoundAt: string;
  buildingId: string;
  roomText: string;
  customLocation: string;
  contactInfo: string;
  handoverPointId: string;
  privateDetails: boolean;
}

function localDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function newDraft(contactInfo: string): DraftState {
  return {
    title: "",
    description: "",
    lostFoundAt: localDateTimeValue(),
    buildingId: "",
    roomText: "",
    customLocation: "",
    contactInfo,
    handoverPointId: "",
    privateDetails: false
  };
}

export function StoryPostForm({
  type,
  onAnalysisStart,
  onAnalysisComplete,
  onAnalysisError,
  onAnalysisReset,
  onPostCreated,
  onSessionReset
}: StoryPostFormProps) {
  const { user } = useAuth();
  const defaultContact = user?.phoneNumber || user?.email || "";
  const [catalog, setCatalog] = useState<PostCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id: string; title: string; mediaWarning?: string } | null>(null);
  const [analysis, setAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [areaId, setAreaId] = useState("");
  const [mainCategoryId, setMainCategoryId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [draft, setDraft] = useState<DraftState>(() => newDraft(defaultContact));

  useEffect(() => {
    let active = true;
    api.getPostCatalog()
      .then((value) => { if (active) setCatalog(value); })
      .catch((reason: Error) => { if (active) setCatalogError(reason.message); });
    return () => { active = false; };
  }, []);

  const previewUrls = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files]
  );

  useEffect(() => () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewUrls]);

  useEffect(() => {
    setCreated(null);
    setAnalysis(null);
    setError("");
    setFiles([]);
    setAreaId("");
    setMainCategoryId("");
    setCategoryId("");
    setDraft(newDraft(defaultContact));
  }, [defaultContact, type]);

  const mainCategoryOptions = useMemo(
    () => catalog?.categories.filter((item) => item.parentId === null) ?? [],
    [catalog]
  );
  const categoryOptions = useMemo(
    () => catalog?.categories.filter((item) => item.parentId === mainCategoryId) ?? [],
    [catalog, mainCategoryId]
  );
  const buildingOptions = useMemo(
    () => catalog?.buildings.filter((item) => item.areaId === areaId) ?? [],
    [catalog, areaId]
  );

  function updateDraft<Key extends keyof DraftState>(key: Key, value: DraftState[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function resetDraft() {
    setCreated(null);
    setAnalysis(null);
    setError("");
    setFiles([]);
    setAreaId("");
    setMainCategoryId("");
    setCategoryId("");
    setDraft(newDraft(defaultContact));
  }

  function addFiles(nextFiles: File[]) {
    setError("");
    if (!nextFiles.length) return;
    if (nextFiles.some((file) => !ALLOWED_IMAGE_TYPES.has(file.type))) {
      setError("Tất cả ảnh phải có định dạng JPG, PNG hoặc WebP.");
      return;
    }
    if (nextFiles.some((file) => file.size > MAX_IMAGE_BYTES)) {
      setError("Mỗi ảnh không được vượt quá 10 MB.");
      return;
    }
    const uniqueNewFiles = nextFiles.filter((candidate) => !files.some((current) => (
      current.name === candidate.name
      && current.size === candidate.size
      && current.lastModified === candidate.lastModified
    )));
    const combined = [...files, ...uniqueNewFiles];
    if (combined.length > MAX_IMAGE_COUNT) {
      setError(`Chỉ được chọn tối đa ${MAX_IMAGE_COUNT} ảnh cho một bài đăng.`);
      return;
    }
    if (combined.reduce((total, file) => total + file.size, 0) > MAX_ANALYSIS_TOTAL_BYTES) {
      setError("Tổng dung lượng ảnh dùng để phân tích không được vượt quá 14 MB.");
      return;
    }
    setAnalysis(null);
    onAnalysisReset?.();
    setFiles(combined);
  }

  function removeFile(index: number) {
    setError("");
    setAnalysis(null);
    onAnalysisReset?.();
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  async function analyzeImage() {
    if (!files.length || analyzing) return;
    setError("");
    setAnalyzing(true);
    onAnalysisStart?.(files);
    try {
      const result = await api.analyzePostImage(type, files);
      setAnalysis(result);
      setDraft((current) => ({
        ...current,
        title: result.title,
        description: result.description
      }));
      if (result.suggestedCategory?.parentId) {
        setMainCategoryId(result.suggestedCategory.parentId);
        setCategoryId(result.suggestedCategory.id);
      }
      onAnalysisComplete?.(result);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Không thể phân tích ảnh. Bạn vẫn có thể nhập thủ công.";
      setError(message);
      onAnalysisError?.(message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!categoryId) {
      setError("Vui lòng chọn nhóm chính và danh mục cụ thể.");
      return;
    }
    if (!areaId && !draft.customLocation.trim() && !(type === "FOUND" && draft.handoverPointId)) {
      setError("Vui lòng chọn khu vực, điểm bàn giao hoặc nhập vị trí khác.");
      return;
    }

    setSubmitting(true);
    try {
      const post = await api.createPost({
        type,
        title: draft.title,
        description: draft.description,
        categoryId,
        areaId: areaId || null,
        buildingId: draft.buildingId || null,
        roomText: draft.roomText || null,
        customLocation: draft.customLocation || null,
        contactInfo: draft.contactInfo,
        lostFoundAt: new Date(draft.lostFoundAt).toISOString(),
        handoverPointId: type === "FOUND" ? draft.handoverPointId || null : null,
        visibilityMode: type === "FOUND" && draft.privateDetails ? "PRIVATE_DETAILS" : "PUBLIC",
        analysisSignals: analysis ? {
          visualAttributes: analysis.visualAttributes,
          visibleText: analysis.visibleText,
          confidence: analysis.confidence
        } : undefined
      });

      let mediaWarning: string | undefined;
      if (files.length) {
        let failedUploads = 0;
        for (const selectedFile of files) {
          try {
            await api.uploadPostMedia(post.id, selectedFile);
          } catch {
            failedUploads += 1;
          }
        }
        if (failedUploads > 0) {
          mediaWarning = `Bài đã được tạo nhưng ${failedUploads}/${files.length} ảnh chưa tải lên thành công. Bạn có thể bổ sung ảnh ở trang bài đăng của tôi.`;
        }
      }
      setCreated({ id: post.id, title: post.title, mediaWarning });
      onPostCreated?.({ post, categoryId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo bài đăng. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return <div className="story-post-success" role="status">
      <span><Check /></span>
      <p className="story-index">Đã đưa vào hành trình</p>
      <h3>{created.title}</h3>
      <p>Bài {type} đang mở. Hệ thống đang tìm các bài {type === "LOST" ? "FOUND" : "LOST"} cùng danh mục; mọi gợi ý vẫn cần con người xác minh.</p>
      {created.mediaWarning && <div className="story-form-message is-warning">{created.mediaWarning}</div>}
      <button type="button" onClick={() => onSessionReset ? onSessionReset() : resetDraft()}>Tạo thêm bài <ChevronRight size={17} /></button>
    </div>;
  }

  return <form className={`story-post-form story-post-form--${type.toLowerCase()}`} onSubmit={submit}>
    <div className="story-post-form__head">
      <div>
        <span className="story-post-form__type">{type}</span>
        <p>
          <strong>{type === "LOST" ? "Báo mất vật phẩm" : "Báo nhặt được vật phẩm"}</strong>
          <small>Lưu trực tiếp vào hệ thống sau khi bạn xác nhận</small>
        </p>
      </div>
      <span className="story-post-form__step">01 / 01</span>
    </div>

    {catalogError && <div className="story-form-message is-error">Không tải được danh mục: {catalogError}</div>}
    {!catalog && !catalogError && <div className="story-form-loading"><LoaderCircle /> Đang tải dữ liệu campus...</div>}

    <div className="story-form-fields">
      <label className="story-field story-field--wide">
        <span>Tên vật phẩm</span>
        <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} required minLength={5} maxLength={255} placeholder={type === "LOST" ? "Ví dụ: Ví da màu đen" : "Ví dụ: Tai nghe màu trắng"} />
      </label>
      <div className="story-field">
        <label htmlFor={`${type}-main-category`}>Nhóm chính</label>
        <select id={`${type}-main-category`} value={mainCategoryId} required disabled={!catalog} onChange={(event) => { setMainCategoryId(event.target.value); setCategoryId(""); }}>
          <option value="">Chọn nhóm vật phẩm</option>
          {mainCategoryOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <div className="story-field">
        <label htmlFor={`${type}-category`}>Danh mục cụ thể</label>
        <select id={`${type}-category`} value={categoryId} required disabled={!mainCategoryId || categoryOptions.length === 0} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">{!mainCategoryId ? "Chọn nhóm chính trước" : categoryOptions.length === 0 ? "Nhóm chưa có danh mục cụ thể" : "Chọn loại vật phẩm"}</option>
          {categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <label className="story-field">
        <span>Thời điểm {type === "LOST" ? "phát hiện bị mất" : "nhặt được"}</span>
        <span className="story-field__icon"><Clock3 /></span>
        <input type="datetime-local" required max={localDateTimeValue()} value={draft.lostFoundAt} onChange={(event) => updateDraft("lostFoundAt", event.target.value)} />
      </label>
      <label className="story-field">
        <span>Khu vực</span>
        <span className="story-field__icon"><MapPin /></span>
        <select value={areaId} onChange={(event) => { setAreaId(event.target.value); updateDraft("buildingId", ""); }} disabled={!catalog}>
          <option value="">Chọn khu vực</option>
          {catalog?.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="story-field">
        <span>Tòa nhà / địa điểm</span>
        <select value={draft.buildingId} onChange={(event) => updateDraft("buildingId", event.target.value)} disabled={!areaId}>
          <option value="">Chọn địa điểm cụ thể</option>
          {buildingOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="story-field">
        <span>Phòng / vị trí chi tiết</span>
        <input value={draft.roomText} onChange={(event) => updateDraft("roomText", event.target.value)} maxLength={100} placeholder="Ví dụ: Phòng 315, ghế gần cửa" />
      </label>
      <label className="story-field">
        <span>Vị trí khác</span>
        <input value={draft.customLocation} onChange={(event) => updateDraft("customLocation", event.target.value)} maxLength={255} placeholder="Mô tả nếu không có trong danh sách" />
      </label>
      {type === "FOUND" && <label className="story-field story-field--wide">
        <span>Điểm bàn giao (nếu đã gửi)</span>
        <select value={draft.handoverPointId} onChange={(event) => updateDraft("handoverPointId", event.target.value)}>
          <option value="">Tôi đang giữ tại vị trí trên</option>
          {catalog?.handoverPoints.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.address}</option>)}
        </select>
      </label>}
      <label className="story-field story-field--wide">
        <span>Mô tả nhận dạng</span>
        <textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} required minLength={10} maxLength={5000} rows={4} placeholder="Màu sắc, chất liệu, phụ kiện đi kèm và dấu hiệu dễ nhận biết..." />
      </label>
      <label className="story-field story-field--wide">
        <span>Thông tin liên hệ</span>
        <input value={draft.contactInfo} onChange={(event) => updateDraft("contactInfo", event.target.value)} required minLength={3} maxLength={255} />
      </label>
    </div>

    <div className="story-image-assistance">
      <div className="story-image-picker">
        <label className={`story-image-drop ${files.length ? "has-files" : ""}`}>
          <span><ImagePlus /></span>
          <strong>{files.length ? "Thêm góc chụp khác" : "Thêm ảnh vật phẩm"}</strong>
          <small>{files.length}/5 ảnh · JPG, PNG hoặc WebP · tổng tối đa 14 MB</small>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={analyzing || files.length >= MAX_IMAGE_COUNT}
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.currentTarget.value = "";
            }}
          />
        </label>
        {previewUrls.length > 0 && <div className="story-image-grid" aria-label={`${previewUrls.length} ảnh vật phẩm đã chọn`}>
          {previewUrls.map((url, index) => <figure className="story-image-thumb" key={`${files[index].name}-${files[index].lastModified}`}>
            <img src={url} alt={`Góc chụp vật phẩm ${index + 1}`} />
            <figcaption>Ảnh {index + 1}</figcaption>
            <button type="button" disabled={analyzing} aria-label={`Xóa ảnh ${index + 1}`} onClick={() => removeFile(index)}><X /></button>
          </figure>)}
        </div>}
      </div>
      <div className="story-image-analysis-actions">
        <button className="story-analyze-button" type="button" disabled={!files.length || analyzing} onClick={analyzeImage}>
          {analyzing ? <><LoaderCircle className="is-spinning" /> Đang phân tích {files.length} ảnh...</> : <><Sparkles /> Phân tích {files.length || "các"} ảnh</>}
        </button>
        <p>Chụp nhiều góc giúp đọc rõ hãng, model, chữ, phụ kiện và dấu hiệu riêng. Ảnh chỉ được gửi tới Gemini khi bạn chủ động phân tích.</p>
      </div>
    </div>

    {analysis && <div className="story-analysis-result" role="status">
      <span><Sparkles /></span>
      <div>
        <strong>Đã tổng hợp {analysis.imageCount || files.length} ảnh · độ tin cậy {Math.round(analysis.confidence * 100)}%</strong>
        <p>Bạn có thể sửa mọi trường. Vị trí và thời gian không được suy đoán từ ảnh.</p>
        {analysis.visualAttributes.length > 0 && <div>{analysis.visualAttributes.slice(0, 5).map((attribute) => <small key={attribute}>{attribute}</small>)}</div>}
        {analysis.warnings.map((warning) => <em key={warning}>{warning}</em>)}
      </div>
    </div>}

    {type === "FOUND" && <label className="story-private-option">
      <input type="checkbox" checked={draft.privateDetails} onChange={(event) => updateDraft("privateDetails", event.target.checked)} />
      <span><ShieldCheck /><strong>Giữ chi tiết nhạy cảm ở chế độ riêng tư</strong><small>Người xem công khai chỉ thấy thông tin cơ bản; chi tiết hỗ trợ xác minh được bảo vệ.</small></span>
    </label>}
    {error && <div className="story-form-message is-error">{error}</div>}
    <div className="story-post-form__footer">
      <span><Camera /> Ảnh và nội dung chỉ được đăng sau khi bạn xác nhận</span>
      <button type="submit" disabled={submitting || analyzing || !catalog}>
        {submitting ? <><LoaderCircle className="is-spinning" /> Đang đăng...</> : <>Đăng bài {type} <ChevronRight /></>}
      </button>
    </div>
  </form>;
}
