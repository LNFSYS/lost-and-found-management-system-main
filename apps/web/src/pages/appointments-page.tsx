import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, RotateCw, ShieldAlert, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { api } from "../services/api";
import { appointmentStatus, displayTime, eventLabel, responseLabel, type Appointment, type AppointmentAction } from "../services/workflow-types";
import "./workflow-pages.css";

export function AppointmentsPage() {
  const { appointmentId }=useParams();const [query]=useSearchParams();const claimId=query.get("claimId") ?? undefined;
  const { user }=useAuth();const navigate=useNavigate();
  const [items,setItems]=useState<Appointment[]>([]);const [selected,setSelected]=useState<Appointment|null>(null);
  const [total,setTotal]=useState(0);const [page,setPage]=useState(1);const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [reload,setReload]=useState(0);
  const [date,setDate]=useState("");const [point,setPoint]=useState("");const [checked,setChecked]=useState(false);
  const [reason,setReason]=useState("");const [clock,setClock]=useState(Date.now());
  const [points,setPoints]=useState<Array<{id:string;name:string;address:string}>>([]);
  const generation=useRef(0);const mutation=useRef<number|null>(null);const retry=useRef<{fingerprint:string;key:string}|null>(null);
  useEffect(()=>{setChecked(false);setReason("");},[appointmentId]);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{const token=++generation.current;const controller=new AbortController();setLoading(true);setError("");setSelected(null);setChecked(false);setBusy(false);
    const request=appointmentId ? api.getAppointment(appointmentId,controller.signal).then(a=>{if(generation.current===token)setSelected(a);})
      : api.listAppointments({claimId,page},controller.signal).then(r=>{if(generation.current===token){setItems(r.results);setTotal(r.total);}});
    void request.catch(e=>{if(generation.current===token&&!controller.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải lịch hẹn");}).finally(()=>{if(generation.current===token)setLoading(false);});
    return ()=>{generation.current++;controller.abort();};
  },[appointmentId,claimId,page,reload]);
  useEffect(()=>{
    if(!appointmentId||busy||!selected||["COMPLETED","CANCELLED","REJECTED"].includes(selected.status))return;
    const controller=new AbortController();let active=true;const token=generation.current;
    const timer=setInterval(()=>{void api.getAppointment(appointmentId,controller.signal).then(a=>{
      if(active&&generation.current===token)setSelected(a);
    }).catch(error=>{if(active&&!controller.signal.aborted&&generation.current===token)setError(error instanceof Error?error.message:"Không thể cập nhật lịch hẹn");});},15000);
    return()=>{active=false;clearInterval(timer);controller.abort();};
  },[appointmentId,busy,selected?.status]);
  useEffect(()=>{let active=true;if(claimId&&!appointmentId)void api.listPublicHandoverPoints().then(r=>{if(active)setPoints(r.handoverPoints.filter(p=>p.isActive));}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[claimId,appointmentId]);
  function key(fingerprint:string){if(retry.current?.fingerprint!==fingerprint)retry.current={fingerprint,key:crypto.randomUUID()};return retry.current.key;}
  async function create(event:React.FormEvent) {
    event.preventDefault();if(mutation.current===generation.current||!claimId)return;
    const time=new Date(date);if(!date||!Number.isFinite(time.getTime())||!point){setError("Vui lòng chọn thời gian và điểm hẹn");return;}
    const token=generation.current;mutation.current=token;setBusy(true);setError("");
    try {const a=await api.createAppointment({claimId,proposedAt:time.toISOString(),handoverPointId:point,requestKey:key(JSON.stringify([claimId,date,point]))});
      if(generation.current===token){retry.current=null;navigate(`/appointments/${a.id}`);}}
    catch(e){if(generation.current===token)setError(e instanceof Error?e.message:"Không thể tạo lịch");}
    finally{if(mutation.current===token)mutation.current=null;if(generation.current===token)setBusy(false);}
  }
  async function act(action:AppointmentAction) {
    if(!selected||mutation.current===generation.current)return;
    if(action==="CANCEL"&&reason.trim().length<3){setError("Nhập lý do hủy lịch (ít nhất 3 ký tự)");return;}
    const token=generation.current;mutation.current=token;setBusy(true);setError("");
    try {const a=await api.actOnAppointment(selected.id,{action,version:selected.version,requestKey:key(JSON.stringify([selected.id,action,selected.version,checked,reason])),physicallyChecked:checked,reason:reason.trim()||undefined});
      if(generation.current===token){setSelected(a);retry.current=null;}}
    catch(e){if(generation.current===token)setError(e instanceof Error?e.message:"Không thể cập nhật lịch");}
    finally{if(mutation.current===token)mutation.current=null;if(generation.current===token)setBusy(false);}
  }
  const ended=selected&&["COMPLETED","CANCELLED","REJECTED"].includes(selected.status);
  const occurred=selected&&new Date(selected.proposedAt).getTime()<=clock;
  const finder=selected?.finderId===user?.id;
  return <section className="workflow-page">
    <header className="workflow-heading"><h1><CalendarDays/> Lịch hẹn trả đồ</h1><div><Link to="/appointments">Tất cả lịch</Link><button type="button" title="Tải lại lịch hẹn" aria-label="Tải lại lịch hẹn" disabled={busy} onClick={()=>setReload(v=>v+1)}><RotateCw size={18}/></button></div></header>
    {error&&<p className="workflow-error" role="alert">{error}</p>}
    {loading?<p role="status">Đang tải lịch hẹn...</p>:selected?<>
      <h2>{selected.title}</h2><span className="workflow-status">{appointmentStatus[selected.status]}</span>
      <dl className="workflow-facts"><div><dt>Thời gian</dt><dd>{displayTime(selected.proposedAt)}</dd></div><div><dt>Điểm hẹn</dt><dd>{selected.location??"Chưa ghi nhận"}</dd></div>
        <div><dt>Finder</dt><dd>{responseLabel[selected.finderResponse]}</dd></div><div><dt>Người mất</dt><dd>{responseLabel[selected.ownerResponse]}</dd></div></dl>
      <Link to={`/claims/${selected.claimId}`}>Mở cuộc trao đổi</Link>
      {selected.custodyAuthorized&&<p>Staff đã hoàn tất trả đồ tại quầy. Lịch này không dùng xác nhận bàn giao trực tiếp.</p>}
      {selected.version===0&&!selected.custodyAuthorized&&<p className="workflow-error" role="status">Đây là lịch sử cũ, chỉ có thể xem. Cần quản trị đối soát trước khi dùng quy trình xác nhận bàn giao mới; hệ thống không tự chuyển đổi xác nhận cũ.</p>}
      <p><Link to={`/reports?targetType=HANDOVER&targetId=${selected.id}`}>Báo cáo vấn đề bàn giao</Link></p>
      {(selected.finderResponse==="DISPUTED"||selected.ownerResponse==="DISPUTED")&&<p className="workflow-error" role="alert">Hai bên cần đối soát. Vật phẩm chưa được đánh dấu đã trả. Chỉ xác nhận lại sau khi đã kiểm tra và thống nhất.</p>}
      {selected.noShowUserId&&<p role="status">Một bên báo người còn lại không đến. Đây là ghi nhận một phía, không tự động xử phạt hay xác nhận đã trả.</p>}
      {!ended&&!selected.custodyAuthorized&&selected.version>0&&<div className="workflow-actions">
        <label className="workflow-note">Lý do hủy / ghi chú đối soát<textarea value={reason} rows={2} maxLength={500} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
        {selected.status==="PENDING"&&selected.proposerId!==user?.id&&<><button disabled={busy} onClick={()=>void act("ACCEPT")}><CheckCircle2/> Chấp nhận lịch</button><button disabled={busy} onClick={()=>void act("REJECT")}><XCircle/> Từ chối lịch</button></>}
        {selected.status==="ACCEPTED"&&<>
          <label className="workflow-check"><input type="checkbox" checked={checked} disabled={busy} onChange={e=>setChecked(e.target.checked)}/> Tôi đã trực tiếp đối chiếu và {finder?"giao đúng vật phẩm cho người mất":"nhận đúng vật phẩm"}.</label>
          {(finder?selected.finderResponse:selected.ownerResponse)==="CONFIRMED"&&<p className="workflow-check" role="status">Bạn đã xác nhận bàn giao. Đang chờ xác nhận hợp lệ của bên còn lại.</p>}
          <button disabled={busy||!occurred||!checked||(finder?selected.finderResponse:selected.ownerResponse)==="CONFIRMED"} onClick={()=>void act("CONFIRM")}><CheckCircle2/> {finder?"Xác nhận đã giao đồ":"Xác nhận đã nhận đồ"}</button>
          <button disabled={busy||!occurred} onClick={()=>void act("DISPUTE")}><ShieldAlert/> Bàn giao chưa khớp</button>
          <button disabled={busy||!occurred||clock<new Date(selected.proposedAt).getTime()+900000||selected.finderResponse!=="PENDING"||selected.ownerResponse!=="PENDING"} onClick={()=>void act("NO_SHOW")}><XCircle/> Báo bên còn lại không đến</button>
        </>}
        {((selected.finderResponse==="PENDING"&&selected.ownerResponse==="PENDING")||(selected.finderResponse==="DISPUTED"&&selected.ownerResponse==="DISPUTED"))&&<button disabled={busy} onClick={()=>void act("CANCEL")}><XCircle/> Hủy lịch</button>}
      </div>}
      <h2>Nhật ký lịch hẹn</h2><ol className="workflow-timeline">{selected.events.map(e=><li key={e.id}><strong>{eventLabel[e.action]??e.action}</strong><time>{displayTime(e.createdAt)}</time>{e.note&&<p>{e.note}</p>}</li>)}</ol>
      {ended&&selected.status!=="COMPLETED"&&<Link to={`/appointments?claimId=${selected.claimId}`}>Đề xuất lịch khác</Link>}
    </>:<>
      {claimId&&<form className="workflow-proposal" onSubmit={e=>void create(e)}><h2>Đề xuất lịch mới</h2>
        <label>Thời gian hẹn<input required type="datetime-local" value={date} disabled={busy} onChange={e=>setDate(e.target.value)}/></label>
        <label>Điểm hẹn<select required value={point} disabled={busy} onChange={e=>setPoint(e.target.value)}><option value="">Chọn điểm hẹn</option>{points.map(p=><option key={p.id} value={p.id}>{p.name} · {p.address}</option>)}</select></label>
        <button type="submit" disabled={busy}><CalendarDays/> Gửi đề xuất</button></form>}
      {items.length?<ul className="appointment-list">{items.map(a=><li key={a.id}><div><Link to={`/appointments/${a.id}`}><strong>{a.title}</strong></Link><p>{displayTime(a.proposedAt)} · {a.location??"Chưa ghi nhận"}</p></div><span className="workflow-status">{appointmentStatus[a.status]}</span></li>)}</ul>:<p>Chưa có lịch hẹn.</p>}
      <div className="workflow-pagination"><button aria-label="Trang trước" disabled={page===1||busy} onClick={()=>setPage(p=>p-1)}><ChevronLeft/></button><span>Trang {page} · {total} lịch</span><button aria-label="Trang sau" disabled={page*20>=total||busy} onClick={()=>setPage(p=>p+1)}><ChevronRight/></button></div>
    </>}
  </section>;
}
