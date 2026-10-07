import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ImageOff, MapPin, MessageCircle, PackageCheck, RotateCw, ShieldAlert, UserRound, X, XCircle, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { AccessibleDialog } from "../components/accessible-dialog";
import { api } from "../services/api";
import { appointmentStatus, displayTime, eventLabel, responseLabel, type Appointment, type AppointmentAction } from "../services/workflow-types";
import "./workflow-pages.css";

function AppointmentImage({ appointment }: { appointment: Appointment }) {
  const path = appointment.itemImageUrl ?? null;
  const [image, setImage] = useState<{ path: string; source: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const source = image?.path === path ? image.source : null;
  useEffect(() => {
    let active = true, objectUrl = "";
    setImage(null); setExpanded(false);
    if (path) void api.getPostMedia(path).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob); setImage({ path, source: objectUrl });
    }).catch(() => { if (active) setImage({ path, source: "" }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, attempt]);
  return <>
    <div className="appointment-image">
      {source ? <button type="button" className="appointment-image__open" title="Phóng to ảnh vật phẩm" aria-label={`Phóng to ảnh ${appointment.title}`} onClick={() => setExpanded(true)}>
        <img src={source} alt={`Ảnh ${appointment.title}`} onError={() => { if (path) setImage({ path, source: "" }); }} />
        <span className="appointment-image__zoom" aria-hidden="true"><ZoomIn size={18} /></span>
      </button> : <div className="appointment-image__placeholder"><ImageOff size={30} />
        <span>{source === "" ? "Không tải được ảnh" : path ? "Đang tải ảnh..." : "Chưa có ảnh công khai"}</span>
        {source === "" && <button type="button" title="Tải lại ảnh vật phẩm" aria-label={`Tải lại ảnh ${appointment.title}`} onClick={() => setAttempt(value => value + 1)}><RotateCw size={16} /></button>}
      </div>}
    </div>
    {expanded && source && <div className="custody-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setExpanded(false); }}>
      <AccessibleDialog className="custody-modal appointment-image-dialog" aria-label="Ảnh vật phẩm" onDismiss={() => setExpanded(false)}>
        <header><h2>{appointment.title}</h2><button type="button" title="Đóng ảnh" aria-label="Đóng ảnh" onClick={() => setExpanded(false)}><X size={18} /></button></header>
        <img src={source} alt={`Ảnh ${appointment.title}`} />
      </AccessibleDialog>
    </div>}
  </>;
}

function AppointmentSchedule({ proposedAt }: { proposedAt: string }) {
  const date = new Date(proposedAt);
  return <div className="appointment-schedule">
    <div className="appointment-date" aria-hidden="true"><strong>{date.getDate().toString().padStart(2, "0")}</strong><small>Tháng {date.getMonth() + 1}</small></div>
    <time dateTime={proposedAt}><strong>{date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })}</strong>
      <span>{date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</span></time>
  </div>;
}

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
  return <section className="workflow-page appointments-page">
    <header className="workflow-heading"><h1><CalendarDays/> Lịch hẹn trả đồ</h1><div><Link to="/appointments">Tất cả lịch</Link><button type="button" title="Tải lại lịch hẹn" aria-label="Tải lại lịch hẹn" disabled={busy} onClick={()=>setReload(v=>v+1)}><RotateCw size={18}/></button></div></header>
    {error&&<p className="workflow-error" role="alert">{error}</p>}
    {loading?<p role="status">Đang tải lịch hẹn...</p>:selected?<>
      <section className="appointment-overview" aria-label="Thông tin lịch hẹn">
        <AppointmentImage appointment={selected} />
        <div className="appointment-overview__content">
          <span className={`workflow-status appointment-status appointment-status--${selected.status.toLowerCase()}`}>{appointmentStatus[selected.status]}</span>
          <h2>{selected.title}</h2>
          <AppointmentSchedule proposedAt={selected.proposedAt} />
          <p className="appointment-location"><MapPin size={18} /><span>{selected.location ?? "Chưa ghi nhận điểm hẹn"}</span></p>
          <dl className="appointment-responses">
            <div><dt><UserRound size={16} /> Người nhặt</dt><dd>{responseLabel[selected.finderResponse]}</dd></div>
            <div><dt><UserRound size={16} /> Người mất</dt><dd>{responseLabel[selected.ownerResponse]}</dd></div>
          </dl>
          <Link className="appointment-conversation" to={`/claims/${selected.claimId}`}><MessageCircle size={18} /> Mở cuộc trao đổi <ArrowRight size={16} /></Link>
        </div>
      </section>
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
      {!error && <p className="appointment-list-count">{total} lịch hẹn</p>}
      {items.length ? <ul className="appointment-list">{items.map(a => <li key={a.id}>
        <article className="appointment-card">
          <AppointmentImage appointment={a} />
          <div className="appointment-card__body">
            <div className="appointment-card__meta"><span className={`workflow-status appointment-status appointment-status--${a.status.toLowerCase()}`}>{appointmentStatus[a.status]}</span>
              <span className="appointment-channel">{a.custodyAuthorized ? <PackageCheck size={15} /> : <UserRound size={15} />}{a.custodyAuthorized ? "Tại kho" : "Trực tiếp"}</span></div>
            <h2><Link to={`/appointments/${a.id}`}>{a.title}</Link></h2>
            <AppointmentSchedule proposedAt={a.proposedAt} />
            <p className="appointment-location"><MapPin size={17} /><span>{a.location ?? "Chưa ghi nhận điểm hẹn"}</span></p>
          </div>
          <footer className="appointment-card__footer"><span>{a.finderId === user?.id ? "Bạn là người nhặt" : "Bạn là người mất"}</span><Link to={`/appointments/${a.id}`} aria-label={`Xem lịch hẹn ${a.title}`}>Xem lịch hẹn <ArrowRight size={16} /></Link></footer>
        </article>
      </li>)}</ul> : !error && <div className="appointment-empty"><CalendarDays size={36} /><h2>Chưa có lịch hẹn</h2></div>}
      <div className="workflow-pagination"><button aria-label="Trang trước" disabled={page===1||busy} onClick={()=>setPage(p=>p-1)}><ChevronLeft/></button><span>Trang {page} · {total} lịch</span><button aria-label="Trang sau" disabled={page*20>=total||busy} onClick={()=>setPage(p=>p+1)}><ChevronRight/></button></div>
    </>}
  </section>;
}
