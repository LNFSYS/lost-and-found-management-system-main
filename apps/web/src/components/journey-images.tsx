import { ImageOff, RotateCw, X, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AccessibleDialog } from "./accessible-dialog";
import { api } from "../services/api";
import { displayTime, type JourneyImage } from "../services/workflow-types";

const imageLabel: Record<JourneyImage["kind"], string> = {
  POST: "Ảnh bài đăng", CLAIM: "Ảnh trao đổi", INTAKE: "Ảnh tiếp nhận", RETURN: "Ảnh bàn giao"
};

function JourneyPhoto({ image, index }: { image: JourneyImage; index: number }) {
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const label = `${imageLabel[image.kind]} ${index + 1}`;
  useEffect(() => {
    let active = true, objectUrl = "";
    setSource(null); setFailed(false); setExpanded(false);
    void api.getPostMedia(image.url).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob); setSource(objectUrl);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [image.url, attempt]);
  return <figure className="journey-photo">
    {source && !failed ? <button type="button" className="journey-photo__open" aria-label={`Xem ${label}`} title={`Xem ${label}`} onClick={() => setExpanded(true)}>
      <img src={source} alt={label} onError={() => { setFailed(true); setExpanded(false); }} />
      <ZoomIn size={18} className="journey-photo__zoom" aria-hidden="true" />
    </button> : <div className="journey-photo__placeholder"><ImageOff size={24} aria-hidden="true" />
      <span>{failed ? "Không tải được ảnh" : "Đang tải ảnh..."}</span>
      {failed && <button type="button" aria-label={`Tải lại ${label}`} title={`Tải lại ${label}`} onClick={() => setAttempt(value => value + 1)}><RotateCw size={16} /></button>}
    </div>}
    <figcaption>{label}<time dateTime={image.createdAt}>{displayTime(image.createdAt)}</time></figcaption>
    {expanded && source && createPortal(<div className="custody-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setExpanded(false); }}>
      <AccessibleDialog className="custody-modal journey-photo-dialog" aria-label={label} onDismiss={() => setExpanded(false)}>
        <header><h2>{label}</h2><button type="button" aria-label="Đóng ảnh" title="Đóng ảnh" onClick={() => setExpanded(false)}><X size={20} /></button></header>
        <img src={source} alt={label} />
        <time dateTime={image.createdAt}>{displayTime(image.createdAt)}</time>
      </AccessibleDialog>
    </div>, document.body)}
  </figure>;
}

export function JourneyImages({ images }: { images: JourneyImage[] }) {
  return <div className="journey-images">{images.map((image, index) => <JourneyPhoto key={`${image.kind}:${image.id}:${image.url}`} image={image} index={index} />)}</div>;
}
