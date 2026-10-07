import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { api } from "../services/api";
import { useModalFocus } from "../hooks/use-modal-focus";

export function ClaimChatImage({ url }: { url: string }) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const modal = useRef<HTMLElement>(null);
  useModalFocus(modal, expanded, () => setExpanded(false));
  useEffect(() => {
    let active = true, objectUrl = "";
    setSource(""); setFailed(false);
    void api.getClaimEvidenceMedia(url).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob); setSource(objectUrl);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, attempt]);
  return <>
    {source ? <button type="button" className="claim-chat-image" title="Xem ảnh trong tin nhắn" onClick={() => setExpanded(true)}><img src={source} alt="Ảnh trong cuộc trò chuyện" /></button>
      : failed ? <button type="button" onClick={() => setAttempt(value => value + 1)}>Tải lại ảnh</button> : <span role="status">Đang tải ảnh...</span>}
    {expanded && <div className="evidence-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setExpanded(false); }}>
      <section ref={modal} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Ảnh trong cuộc trò chuyện" className="evidence-modal">
        <header><h3>Ảnh trong cuộc trò chuyện</h3><button type="button" title="Đóng ảnh" onClick={() => setExpanded(false)}><X /></button></header>
        <img className="claim-chat-image-expanded" src={source} alt="Ảnh trong cuộc trò chuyện" />
      </section>
    </div>}
  </>;
}
