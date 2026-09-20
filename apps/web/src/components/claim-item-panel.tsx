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
  return <section className="claim-item-panel">
    <header><span>ITEM</span><PackageSearch /></header>
    {item?.imageUrl ? <PrivateItemImage path={item.imageUrl} title={item.title} /> : <div className="claim-item-image claim-item-image--empty"><PackageSearch /></div>}
    <h3>{item?.title ?? claim.posts.found.title}</h3>
    <dl>
      <div><dt><Tag /> Category</dt><dd>{item?.categoryName ?? "Chưa cập nhật"}</dd></div>
      <div><dt><MapPin /> Found location</dt><dd>{item?.locationLabel ?? "Không công khai"}</dd></div>
    </dl>
  </section>;
}
