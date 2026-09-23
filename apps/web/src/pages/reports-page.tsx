import { AlertTriangle, ChevronLeft, ChevronRight, FileWarning, RotateCcw, Send, XCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type ReportSourceType, type UserReport, type UserReportStatus } from "../services/api";

const statusLabels: Record<UserReportStatus, string> = {
  PENDING: "Chờ xử lý", REVIEWED: "Đã xử lý", DISMISSED: "Đã bỏ qua", WITHDRAWN: "Đã rút"
};
const sourceLabels: Record<ReportSourceType, string> = {
  POST: "Bài đăng", CLAIM: "Yêu cầu xác minh", MESSAGE: "Tin nhắn riêng", HANDOVER: "Bàn giao"
};

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function ReportsPage() {
  const [params] = useSearchParams();
  const presetType = params.get("targetType") as ReportSourceType | null;
  const presetId = params.get("targetId") ?? "";
  const [reports, setReports] = useState<UserReport[]>([]);
  const [selected, setSelected] = useState<UserReport | null>(null);
  const [status, setStatus] = useState<UserReportStatus | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState<"" | "load" | "submit" | "withdraw">("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    targetType: presetType && sourceLabels[presetType] ? presetType : "POST" as ReportSourceType,
    targetId: presetId,
    reason: "",
    details: ""
  });

  async function load(nextPage = page, nextStatus = status) {
    setPending("load"); setError("");
    try {
      const result = await api.listMyReports({ page: nextPage, pageSize: 10, status: nextStatus });
      setReports(result.items); setTotal(result.total); setPage(result.page);
      if (selected) setSelected(result.items.find((item) => item.id === selected.id) ?? selected);
    } catch (reason) { setError(messageOf(reason, "Không thể tải báo cáo")); }
    finally { setPending(""); }
  }

  useEffect(() => { void load(1, status); }, [status]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setPending("submit"); setError(""); setNotice("");
    try {
      const report = await api.submitReport({ ...form, idempotencyKey: crypto.randomUUID() });
      setSelected(report); setNotice("Đã gửi báo cáo cho bộ phận quản trị");
      setForm({ ...form, reason: "", details: "" });
      await load(1, status);
    } catch (reason) { setError(messageOf(reason, "Không thể gửi báo cáo")); }
    finally { setPending(""); }
  }

  async function withdraw() {
    if (!selected || !window.confirm("Rút báo cáo đang chờ xử lý?")) return;
    setPending("withdraw"); setError("");
    try {
      const report = await api.withdrawMyReport(selected.id);
      setSelected(report); setNotice("Đã rút báo cáo"); await load(page, status);
    } catch (reason) { setError(messageOf(reason, "Không thể rút báo cáo")); }
    finally { setPending(""); }
  }

  const pages = Math.max(1, Math.ceil(total / 10));
  return <main className="reports-page">
    <header className="reports-heading"><div><p className="eyebrow">AN TOÀN CỘNG ĐỒNG</p><h1>Báo cáo của tôi</h1><p>Theo dõi trạng thái và phản hồi được phép từ quản trị viên.</p></div><FileWarning /></header>
    {(error || notice) && <div className={error ? "form-alert" : "form-notice"} role="status">{error || notice}</div>}
    <div className="reports-layout">
      <section className="reports-submit">
        <h2>Gửi báo cáo</h2>
        <form onSubmit={submit}>
          <label className="input-field"><span>Loại đối tượng</span><select value={form.targetType} onChange={(event) => setForm({ ...form, targetType: event.target.value as ReportSourceType })}>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="input-field"><span>Mã đối tượng</span><input value={form.targetId} onChange={(event) => setForm({ ...form, targetId: event.target.value.trim() })} required placeholder="ID từ bài đăng, claim, tin nhắn hoặc lịch bàn giao" /></label>
          <label className="input-field"><span>Lý do</span><input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} minLength={3} maxLength={120} required /></label>
          <label className="input-field"><span>Mô tả hỗ trợ</span><textarea value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} maxLength={1000} rows={5} /></label>
          <button className="primary-button" disabled={pending === "submit"}><Send size={17} /> {pending === "submit" ? "Đang gửi..." : "Gửi báo cáo"}</button>
        </form>
      </section>

      <section className="reports-history">
        <div className="reports-toolbar"><h2>Lịch sử</h2><label><span>Trạng thái</span><select value={status} onChange={(event) => setStatus(event.target.value as UserReportStatus | "")}><option value="">Tất cả</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        {pending === "load" && !reports.length ? <p>Đang tải...</p> : <div className="reports-list">{reports.map((report) => <button type="button" key={report.id} className={selected?.id === report.id ? "active" : ""} onClick={() => setSelected(report)}><span><strong>{report.reason}</strong><small>{sourceLabels[report.sourceType]} · {new Date(report.createdAt).toLocaleString("vi-VN")}</small></span><em className={`report-status report-status--${report.status.toLowerCase()}`}>{statusLabels[report.status]}</em></button>)}{!reports.length && <p>Chưa có báo cáo.</p>}</div>}
        <div className="reports-pagination"><button type="button" onClick={() => void load(page - 1)} disabled={page <= 1}><ChevronLeft /></button><span>{page} / {pages}</span><button type="button" onClick={() => void load(page + 1)} disabled={page >= pages}><ChevronRight /></button></div>
      </section>

      <aside className="reports-detail">
        {selected ? <><div className="reports-detail-title"><AlertTriangle /><div><small>{sourceLabels[selected.sourceType]}</small><h2>{selected.target.title}</h2></div></div><dl><div><dt>Trạng thái</dt><dd>{statusLabels[selected.status]}</dd></div><div><dt>Lý do</dt><dd>{selected.reason}</dd></div><div><dt>Mô tả</dt><dd>{selected.details || "Không có mô tả thêm"}</dd></div><div><dt>Kết quả xử lý</dt><dd>{selected.resolution || "Chưa có kết quả"}</dd></div></dl>{selected.status === "PENDING" && <button type="button" className="danger-button" onClick={() => void withdraw()} disabled={pending === "withdraw"}><XCircle /> Rút báo cáo</button>}</> : <div className="reports-empty"><RotateCcw /><p>Chọn một báo cáo để xem chi tiết.</p></div>}
      </aside>
    </div>
  </main>;
}
