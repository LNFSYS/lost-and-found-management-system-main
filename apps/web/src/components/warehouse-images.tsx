import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalFocus } from "../hooks/use-modal-focus";
import { ImageOff, X } from "lucide-react";
import { api, type WarehouseImage } from "../services/api";
import "./warehouse-intake.css";

const labels = { SOURCE_POST: "Ảnh bài đăng", CONTACT_PHOTO: "Ảnh Finder đối chiếu trong chat", INTAKE: "Ảnh tiếp nhận", RETURN: "Ảnh trả đồ" };

export function WarehouseImageView({ image, caption = false }: { image?: Pick<WarehouseImage, "id" | "provenance"> | null; caption?: boolean }) {
  const [url, setUrl] = useState("");
  const [expanded, setExpanded] = useState(false);
  const modal = useRef<HTMLDivElement>(null);
  useModalFocus(modal, expanded, () => setExpanded(false));
  useEffect(() => {
    let active = true, objectUrl = "";
    setUrl("");
    if (image) void api.getWarehouseImage(image.id, image.provenance).then(blob => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (active) setUrl(""); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [image?.id, image?.provenance]);
  return <>
    <button type="button" className="warehouse-image" disabled={!url} onClick={() => setExpanded(true)} title="Xem ảnh vật phẩm" aria-label="Xem ảnh vật phẩm">
      {url ? <img src={url} alt={image ? labels[image.provenance] : "Vật phẩm"} /> : <span><ImageOff size={24} />Chưa có ảnh</span>}
      {caption && image && <small>{labels[image.provenance]}</small>}
    </button>
    {expanded && createPortal(<div ref={modal} tabIndex={-1} className="warehouse-image-overlay" role="dialog" aria-modal="true" aria-label="Ảnh vật phẩm" onClick={event => { event.stopPropagation(); setExpanded(false); }}>
      <button type="button" className="secondary-button" aria-label="Đóng ảnh" onClick={() => setExpanded(false)}><X size={22} /></button>
      <img src={url} alt="Ảnh vật phẩm phóng to" onClick={event => event.stopPropagation()} />
    </div>, document.body)}
  </>;
}

export function WarehouseImageGallery({ images }: { images: WarehouseImage[] }) {
  return <div className="warehouse-image-gallery">
    {images.length ? images.map(image => <figure key={`${image.provenance}-${image.id}`}>
      <WarehouseImageView image={image} caption />
      <figcaption>{new Date(image.capturedAt ?? image.uploadedAt).toLocaleString("vi-VN")}</figcaption>
    </figure>) : <WarehouseImageView />}
  </div>;
}
