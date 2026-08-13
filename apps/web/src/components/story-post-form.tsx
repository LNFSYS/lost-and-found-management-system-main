import { Camera, Check, ChevronRight, Clock3, ImagePlus, LoaderCircle, MapPin, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../context/auth-context";
import { api, type PostCatalog } from "../services/api";

type StorySide = "LOST" | "FOUND";

function localDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function StoryPostForm({ type }: { type: StorySide }) {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<PostCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [areaId, setAreaId] = useState("");
  const [mainCategoryId, setMainCategoryId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    let active = true;
    api.getPostCatalog()
      .then((value) => { if (active) setCatalog(value); })
      .catch((reason: Error) => { if (active) setCatalogError(reason.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setCreated(null);
    setError("");
  }, [type]);

  const mainCategoryOptions = useMemo(
    () => catalog?.categories.filter((item) => item.parentId === null) ?? [],
    [catalog]
  );
  const categoryOptions = useMemo(
    () => catalog?.categories.filter((item) => item.parentId === mainCategoryId) ?? [],
    [catalog, mainCategoryId]
  );
  const buildingOptions = useMemo(() => catalog?.buildings.filter((item) => item.areaId === areaId) ?? [], [catalog, areaId]);

  function chooseFile(nextFile: File | null) {
    setError("");
    if (!nextFile) { setFile(null); return; }
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(nextFile.type)) {
      setError("Ảnh phải có định dạng JPG, PNG hoặc WebP.");
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setError("Ảnh không được vượt quá 10 MB.");
      return;
    }
    setFile(nextFile);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setSubmitting(true);
    try {
      const post = await api.createPost({
        type,
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        categoryId,
        areaId: areaId || null,
        buildingId: String(form.get("buildingId") ?? "") || null,
        roomText: String(form.get("roomText") ?? "") || null,
        customLocation: String(form.get("customLocation") ?? "") || null,
        contactInfo: String(form.get("contactInfo") ?? ""),
        lostFoundAt: new Date(String(form.get("lostFoundAt"))).toISOString(),
        handoverPointId: type === "FOUND" ? String(form.get("handoverPointId") ?? "") || null : null,
        visibilityMode: type === "FOUND" && form.get("privateDetails") === "on" ? "PRIVATE_DETAILS" : "PUBLIC"
      });
      if (file) await api.uploadPostMedia(post.id, file);
      setCreated({ id: post.id, title: post.title });
      setFile(null);
      event.currentTarget.reset();
      setAreaId("");
      setMainCategoryId("");
      setCategoryId("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo bài đăng. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) return <div className="story-post-success" role="status">
    <span><Check /></span>
    <p className="story-index">Đã đưa vào hành trình</p>
    <h3>{created.title}</h3>
    <p>Bài {type} đang mở. Hệ thống sẽ dùng thông tin này để tìm các báo cáo phù hợp; kết quả matching vẫn cần con người xác minh.</p>
    <button type="button" onClick={() => setCreated(null)}>Tạo thêm bài <ChevronRight size={17} /></button>
  </div>;

  return <form className={`story-post-form story-post-form--${type.toLowerCase()}`} onSubmit={submit}>
    <div className="story-post-form__head">
      <div><span className="story-post-form__type">{type}</span><p><strong>{type === "LOST" ? "Báo mất vật phẩm" : "Báo nhặt được vật phẩm"}</strong><small>Lưu trực tiếp vào hệ thống</small></p></div>
      <span className="story-post-form__step">01 / 01</span>
    </div>

    {catalogError && <div className="story-form-message is-error">Không tải được danh mục: {catalogError}</div>}
    {!catalog && !catalogError && <div className="story-form-loading"><LoaderCircle /> Đang tải dữ liệu campus...</div>}

    <div className="story-form-fields">
      <label className="story-field story-field--wide"><span>Tên vật phẩm</span><input name="title" required minLength={5} maxLength={255} placeholder={type === "LOST" ? "Ví dụ: Ví da màu đen" : "Ví dụ: Tai nghe màu trắng"} /></label>
      <div className="story-field"><label htmlFor={`${type}-main-category`}>Nhóm chính</label><select id={`${type}-main-category`} value={mainCategoryId} required disabled={!catalog} onChange={(event) => { setMainCategoryId(event.target.value); setCategoryId(""); }}><option value="">Chọn nhóm vật phẩm</option>{mainCategoryOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="story-field"><label htmlFor={`${type}-category`}>Danh mục cụ thể</label><select id={`${type}-category`} name="categoryId" value={categoryId} required disabled={!mainCategoryId || categoryOptions.length === 0} onChange={(event) => setCategoryId(event.target.value)}><option value="">{!mainCategoryId ? "Chọn nhóm chính trước" : categoryOptions.length === 0 ? "Nhóm chưa có danh mục cụ thể" : "Chọn loại vật phẩm"}</option>{categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <label className="story-field"><span>Thời điểm {type === "LOST" ? "phát hiện bị mất" : "nhặt được"}</span><span className="story-field__icon"><Clock3 /></span><input name="lostFoundAt" type="datetime-local" required max={localDateTimeValue()} defaultValue={localDateTimeValue()} /></label>
      <label className="story-field"><span>Khu vực</span><span className="story-field__icon"><MapPin /></span><select name="areaId" value={areaId} onChange={(event) => setAreaId(event.target.value)} disabled={!catalog}><option value="">Chọn khu vực</option>{catalog?.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="story-field"><span>Tòa nhà / địa điểm</span><select name="buildingId" disabled={!areaId}><option value="">Chọn địa điểm cụ thể</option>{buildingOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="story-field"><span>Phòng / vị trí chi tiết</span><input name="roomText" maxLength={100} placeholder="Ví dụ: Phòng 315, ghế gần cửa" /></label>
      <label className="story-field"><span>Vị trí khác</span><input name="customLocation" maxLength={255} placeholder="Mô tả nếu không có trong danh sách" /></label>
      {type === "FOUND" && <label className="story-field story-field--wide"><span>Điểm bàn giao (nếu đã gửi)</span><select name="handoverPointId"><option value="">Tôi đang giữ tại vị trí trên</option>{catalog?.handoverPoints.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.address}</option>)}</select></label>}
      <label className="story-field story-field--wide"><span>Mô tả nhận dạng</span><textarea name="description" required minLength={10} maxLength={5000} rows={4} placeholder="Màu sắc, chất liệu, phụ kiện đi kèm và dấu hiệu dễ nhận biết..." /></label>
      <label className="story-field story-field--wide"><span>Thông tin liên hệ</span><input name="contactInfo" required minLength={3} maxLength={255} defaultValue={user?.phoneNumber || user?.email || ""} /></label>
    </div>

    <label className={`story-image-drop ${previewUrl ? "has-preview" : ""}`}>
      {previewUrl ? <><img src={previewUrl} alt="Ảnh vật phẩm đã chọn" /><button type="button" aria-label="Xóa ảnh" onClick={(event) => { event.preventDefault(); chooseFile(null); }}><X /></button></> : <><span><ImagePlus /></span><strong>Thêm ảnh vật phẩm</strong><small>JPG, PNG hoặc WebP · tối đa 10 MB</small></>}
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
    </label>

    {type === "FOUND" && <label className="story-private-option"><input name="privateDetails" type="checkbox" /><span><ShieldCheck /><strong>Giữ chi tiết nhạy cảm ở chế độ riêng tư</strong><small>Người xem công khai chỉ thấy thông tin cơ bản; chi tiết hỗ trợ xác minh được bảo vệ.</small></span></label>}
    {error && <div className="story-form-message is-error">{error}</div>}
    <div className="story-post-form__footer"><span><Camera /> Bạn có thể bổ sung ảnh sau khi đăng</span><button type="submit" disabled={submitting || !catalog}>{submitting ? <><LoaderCircle className="is-spinning" /> Đang đăng...</> : <>Đăng bài {type} <ChevronRight /></>}</button></div>
  </form>;
}
