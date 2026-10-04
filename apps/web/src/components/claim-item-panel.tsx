import { ImageOff, MapPin, PackageSearch, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type ClaimRecord } from "../services/api";

function PrivateItemImage({ path, title }: { path: string; title: string }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    api.getPostMedia(path).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setSource(objectUrl);
    }).catch(() => { if (active) setSource(""); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  return <div className="claim-item-image">{source ? <img src={source} alt={title} /> : <ImageOff />}</div>;
}

export function ClaimItemPanel({ claim }: { claim: ClaimRecord }) {
  const item = claim.item;
  const isCustody = claim.conversation?.custodyEscalated;
  return <section className="claim-item-panel">
    <header><span>ITEM</span><PackageSearch /></header>
    {item?.imageUrl ? <PrivateItemImage path={item.imageUrl} title={item.title} /> : <div className="claim-item-image claim-item-image--empty"><PackageSearch /></div>}
    <h3>{item?.title ?? claim.posts.found.title}</h3>
    <dl>
      <div><dt><Tag /> Category</dt><dd>{item?.categoryName ?? "Chưa cập nhật"}</dd></div>
      <div><dt><MapPin /> Found location</dt><dd>{item?.locationLabel ?? "Không công khai"}</dd></div>
    </dl>
    {isCustody && (
      <div style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: "8px", background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", fontSize: "0.85rem", color: "#15803d" }}>
        <strong>📦 Bảo quản tại Quầy Staff</strong>
        <p style={{ margin: "0.25rem 0 0", color: "#166534" }}>Tài sản này đang được bàn giao & lưu giữ tại Quầy Lost & Found Desk. Xuất trình Claim ID này khi đến nhận đồ.</p>
      </div>
    )}
  </section>;
}
