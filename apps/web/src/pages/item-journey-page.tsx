import { History, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import { JourneyImages } from "../components/journey-images";
import { displayTime, eventLabel, sourceLabel, stateLabel, type Journey } from "../services/workflow-types";
import "./workflow-pages.css";
export function ItemJourneyPage(){
  const {postId}=useParams();return <ItemJourney key={postId} postId={postId}/>;
}
function ItemJourney({postId}:{postId:string|undefined}){
  const [journey,setJourney]=useState<Journey|null>(null);const [page,setPage]=useState(1);const [error,setError]=useState("");const [loading,setLoading]=useState(false);const [reload,setReload]=useState(0);
  useEffect(()=>{setPage(1);setJourney(null);},[postId,reload]);
  useEffect(()=>{if(!postId)return;let active=true;const controller=new AbortController();setLoading(true);setError("");
    void api.getItemJourney(postId,{page,asOf:page>1?journey?.asOf:undefined},controller.signal).then(r=>{if(active)setJourney(old=>page>1&&old?{...r,results:[...old.results,...r.results]}:r);})
      .catch(e=>{if(active&&!controller.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải hành trình");}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  // The server snapshot stays fixed while loading subsequent pages.
  },[postId,page,reload]);
  return <section className="workflow-page"><header className="workflow-heading"><h1><History/> Hành trình vật phẩm</h1><button aria-label="Tải lại hành trình" title="Tải lại hành trình" disabled={loading} onClick={()=>setReload(v=>v+1)}><RotateCw/></button></header>
    <Link to="/my-posts">Bài của tôi</Link>{error&&<p role="alert" className="workflow-error">{error}</p>}
    {journey&&<><h2>{journey.title}</h2><span className="workflow-status">{stateLabel[journey.status]??journey.status}</span>
      {journey.summary&&<dl className="workflow-facts"><div><dt>Người đang giữ theo hồ sơ</dt><dd>{{FINDER:"Finder",STAFF:"Staff / kho tài sản",OWNER:"Đã trả cho người nhận",UNKNOWN:"Chưa xác định"}[journey.summary.custodian]}</dd></div>
        <div><dt>Vị trí lưu giữ</dt><dd>{{FINDER_HELD:"Finder đang giữ",WAREHOUSE:"Trong kho",RETURNED:"Đã hoàn trả",OTHER_DISPOSITION:"Đã xử lý theo quy trình khác",UNKNOWN:"Chưa xác định"}[journey.summary.locationClass]}</dd></div>
        {journey.summary.receivedAt&&<div><dt>Tiếp nhận vào kho</dt><dd>{displayTime(journey.summary.receivedAt)}</dd></div>}
        {journey.summary.returnedAt&&<div><dt>Hoàn trả lúc</dt><dd>{displayTime(journey.summary.returnedAt)}</dd></div>}
        {journey.summary.custodyHours!==null&&<div><dt>Thời gian lưu kho</dt><dd>{journey.summary.custodyHours} giờ</dd></div>}
        <div><dt>Đánh giá sau trả đồ</dt><dd>{journey.summary.feedbackEligible?"Đủ điều kiện gửi đánh giá":"Chưa đủ điều kiện hoặc đã gửi đánh giá"}</dd></div></dl>}
      <ol className="workflow-timeline">{journey.results.map(e=><li key={e.id}><span className="workflow-source">{sourceLabel[e.source]??"Cập nhật"}</span><strong>{eventLabel[e.action]??"Cập nhật trạng thái vật phẩm"}</strong><time dateTime={e.createdAt}>{displayTime(e.createdAt)}</time>{e.toStatus&&<p>{e.fromStatus?`${stateLabel[e.fromStatus]??e.fromStatus} → `:""}{stateLabel[e.toStatus]??e.toStatus}</p>}{Boolean(e.images?.length)&&<JourneyImages images={e.images!}/>}</li>)}</ol>
      {journey.hasMore&&<button disabled={loading} onClick={()=>setPage(v=>v+1)}>Xem tiếp</button>}</>}
    {loading&&<p role="status">Đang tải hành trình...</p>}
  </section>;
}
