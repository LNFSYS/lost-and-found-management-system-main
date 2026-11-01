import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, CalendarDays, FileText, History, MessageCircle,
  PackageCheck, RotateCw, Search, ShieldCheck, Sparkles, Star, Undo2, Warehouse, type LucideIcon
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import { JourneyImages } from "../components/journey-images";
import { displayTime, eventLabel, sourceLabel, stateLabel, type Journey, type JourneyEvent } from "../services/workflow-types";
import "./workflow-pages.css";

const custodianLabel = {
  FINDER: "Finder",
  STAFF: "Staff / kho tài sản",
  OWNER: "Đã trả cho người nhận",
  UNKNOWN: "Chưa xác định"
} as const;

const locationLabel = {
  FINDER_HELD: "Finder đang giữ",
  WAREHOUSE: "Trong kho",
  RETURNED: "Đã hoàn trả",
  OTHER_DISPOSITION: "Đã xử lý theo quy trình khác",
  UNKNOWN: "Chưa xác định"
} as const;

const sourcePresentation: Record<string, { icon: LucideIcon; tone: string }> = {
  POST: { icon: FileText, tone: "post" },
  MATCHING: { icon: Search, tone: "matching" },
  CLAIM: { icon: ShieldCheck, tone: "claim" },
  CHAT: { icon: MessageCircle, tone: "chat" },
  CUSTODY: { icon: PackageCheck, tone: "custody" },
  WAREHOUSE: { icon: Warehouse, tone: "warehouse" },
  RETURN: { icon: Undo2, tone: "return" },
  FEEDBACK: { icon: Star, tone: "feedback" },
  APPOINTMENT: { icon: CalendarDays, tone: "appointment" }
};

function durationLabel(hours: number) {
  const minutes = Math.max(0, Math.round(hours * 60));
  const wholeHours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (wholeHours === 0) return `${minutes} phút`;
  if (remainingMinutes === 0) return `${wholeHours} giờ`;
  return `${wholeHours} giờ ${remainingMinutes} phút`;
}

function journeyEventTitle(event: JourneyEvent) {
  if (eventLabel[event.action]) return eventLabel[event.action];
  const from = event.fromStatus && (stateLabel[event.fromStatus] ?? event.fromStatus);
  const to = event.toStatus && (stateLabel[event.toStatus] ?? event.toStatus);
  if (from && to && from !== to) return `Trạng thái: ${from} → ${to}`;
  if (from || to) return `Trạng thái: ${to || from}`;
  return "Cập nhật hành trình";
}

export function ItemJourneyPage() {
  const { postId } = useParams();
  return <ItemJourney key={postId} postId={postId} />;
}

function ItemJourney({ postId }: { postId: string | undefined }) {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [timelineColumns, setTimelineColumns] = useState(4);

  useEffect(() => {
    const updateColumns = () => setTimelineColumns(
      window.innerWidth < 700 ? 1 : window.innerWidth < 1000 ? 2 : window.innerWidth < 1400 ? 3 : 4
    );
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  useEffect(() => {
    setPage(1);
    setJourney(null);
  }, [postId, reload]);

  useEffect(() => {
    if (!postId) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void api.getItemJourney(postId, { page, asOf: page > 1 ? journey?.asOf : undefined }, controller.signal)
      .then((result) => {
        if (active) setJourney((old) => page > 1 && old ? { ...result, results: [...old.results, ...result.results] } : result);
      })
      .catch((reason) => {
        if (active && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không thể tải hành trình");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  // Keep the server snapshot fixed while loading subsequent pages.
  }, [postId, page, reload]);

  return <section className="workflow-page item-journey-page">
    <Link className="item-journey-back" to="/my-posts"><ArrowLeft size={16} /> Bài của tôi</Link>
    <header className="workflow-heading item-journey-heading">
      <div className="item-journey-heading__copy">
        <span className="item-journey-kicker">HỒ SƠ VẬT PHẨM</span>
        <h1><span className="item-journey-heading__icon"><History /></span> Hành trình vật phẩm</h1>
        <p>Theo dõi từng cột mốc từ lúc đăng tin đến khi món đồ tìm được đúng chủ nhân.</p>
      </div>
      <button aria-label="Tải lại hành trình" title="Tải lại hành trình" disabled={loading} onClick={() => setReload((value) => value + 1)}><RotateCw /></button>
    </header>

    {error && <p role="alert" className="workflow-error">{error}</p>}
    {journey && <>
      <section className="item-journey-overview" aria-label="Tóm tắt vật phẩm">
        <div className="item-journey-overview__heading">
          <h2>{journey.title}</h2>
          <span className="workflow-status">{stateLabel[journey.status] ?? journey.status}</span>
        </div>
        {journey.summary && <dl className="workflow-facts item-journey-facts">
          <div><dt>Người đang giữ theo hồ sơ</dt><dd>{custodianLabel[journey.summary.custodian]}</dd></div>
          <div><dt>Vị trí lưu giữ</dt><dd>{locationLabel[journey.summary.locationClass]}</dd></div>
          {journey.summary.receivedAt && <div><dt>Tiếp nhận vào kho</dt><dd>{displayTime(journey.summary.receivedAt)}</dd></div>}
          {journey.summary.returnedAt && <div><dt>Hoàn trả lúc</dt><dd>{displayTime(journey.summary.returnedAt)}</dd></div>}
          {journey.summary.custodyHours !== null && <div><dt>Thời gian lưu kho</dt><dd>{durationLabel(journey.summary.custodyHours)}</dd></div>}
          <div><dt>Đánh giá sau trả đồ</dt><dd>{journey.summary.feedbackEligible ? "Đủ điều kiện gửi đánh giá" : "Chưa đủ điều kiện hoặc đã gửi đánh giá"}</dd></div>
        </dl>}
      </section>

      <section className="item-journey-history" aria-labelledby="item-journey-history-title">
        <header className="item-journey-history__heading">
          <div className="item-journey-history__title">
            <span className="item-journey-history__icon"><Activity size={17} /></span>
            <div><h2 id="item-journey-history-title">Nhật ký hành trình</h2><p>Các mốc cập nhật theo thời gian</p></div>
          </div>
          <span className="item-journey-history__count">{journey.total} sự kiện</span>
        </header>
        {!journey.results.length ? <p className="item-journey-empty"><Activity /> Chưa có cập nhật hành trình.</p> : <ol className="workflow-timeline item-journey-timeline">
          {journey.results.map((event, index) => {
            const presentation = sourcePresentation[event.source] ?? { icon: Sparkles, tone: "other" };
            const EventIcon = presentation.icon;
            const latest = !journey.hasMore && index === journey.results.length - 1;
            const row = Math.floor(index / timelineColumns);
            const offset = index % timelineColumns;
            const reverseRow = row % 2 === 1;
            const column = reverseRow ? timelineColumns - offset : offset + 1;
            const connector = offset === timelineColumns - 1 ? ArrowDown : reverseRow ? ArrowLeft : ArrowRight;
            const hasConnector = timelineColumns > 1 && index < journey.results.length - 1;
            const ConnectorIcon = connector;
            const title = journeyEventTitle(event);
            return <li
              className={`item-journey-timeline__item item-journey-event--${presentation.tone}${latest ? " item-journey-timeline__item--latest" : ""}`}
              key={event.id}
              style={{ gridColumn: column, gridRow: row + 1 }}
            >
              <article className={`item-journey-event${latest ? " item-journey-event--latest" : ""}`}>
                <div className="item-journey-event__meta">
                  <div className="item-journey-event__source">
                    <span className="item-journey-event__step" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <span className="item-journey-event__icon"><EventIcon size={15} /></span>
                    <span className="workflow-source">{sourceLabel[event.source] ?? "Cập nhật"}</span>
                  </div>
                  <div className="item-journey-event__when">
                    {latest && <span className="item-journey-latest">MỐC MỚI NHẤT</span>}
                    <time dateTime={event.createdAt}>{displayTime(event.createdAt)}</time>
                  </div>
                </div>
                <h3 title={title}>{title}</h3>
                <div className="item-journey-event__body">
                  {(event.fromStatus || event.toStatus) && <div className="item-journey-event__change">
                    {event.source === "CLAIM" && <span className="item-journey-event__change-label">Trạng thái xác minh:</span>}
                    <div className={`item-journey-event__change-flow${event.fromStatus && event.toStatus ? "" : " item-journey-event__change-flow--single"}`}>
                      {event.fromStatus && <span className="item-journey-event__change-state">
                        <small>Từ trạng thái</small>
                        <strong>{stateLabel[event.fromStatus] ?? event.fromStatus}</strong>
                      </span>}
                      {event.fromStatus && event.toStatus && <ArrowRight size={15} aria-hidden="true" />}
                      {event.toStatus && <span className="item-journey-event__change-state">
                        <small>{event.fromStatus ? "Đến trạng thái" : "Trạng thái hiện tại"}</small>
                        <strong>{stateLabel[event.toStatus] ?? event.toStatus}</strong>
                      </span>}
                    </div>
                  </div>}
                  {event.action === "CLAIM_CREATED" && !event.toStatus && <p className="item-journey-event__context">Yêu cầu đối chiếu đã được gửi.</p>}
                  {event.source === "CHAT" && event.action === "CONVERSATION_OPENED" && event.conversationWith && <p className="item-journey-event__context item-journey-event__person">
                    <strong>Trao đổi với:</strong><span>{event.conversationWith}</span>
                  </p>}
                  {event.appointment && <p className="item-journey-event__context item-journey-event__appointment">
                    <strong>Ngày giờ hẹn</strong>
                    <time dateTime={event.appointment.proposedAt}>{displayTime(event.appointment.proposedAt)}</time>
                  </p>}
                  {event.source === "MATCHING" && event.matchingSuggestions && <section className="item-journey-matches" aria-label="Bài đăng có điểm matching cao">
                    <div className="item-journey-matches__heading"><strong>Gợi ý phù hợp</strong><span>{event.matchingSuggestions.length ? `Top ${event.matchingSuggestions.length}` : "Chưa có bài"}</span></div>
                    {event.matchingSuggestions.length ? <ul>{event.matchingSuggestions.map(suggestion => <li key={suggestion.postId}>
                      <Link to={`/posts/${suggestion.postId}`} className="item-journey-match">
                        <span className="item-journey-match__copy"><strong>{suggestion.title}</strong><small>{suggestion.type === "LOST" ? "Báo mất" : "Tin nhặt được"} · {stateLabel[suggestion.status] ?? suggestion.status}</small></span>
                        <span className="item-journey-match__score">{Math.round(suggestion.score * 100)}%</span>
                      </Link>
                    </li>)}</ul> : <p className="item-journey-matches__empty">Chưa có bài đăng đang mở đạt ngưỡng gợi ý.</p>}
                  </section>}
                  {Boolean(event.images?.length) && <JourneyImages images={event.images!} />}
                </div>
              </article>
              {hasConnector && <span className={`item-journey-connector item-journey-connector--${offset === timelineColumns - 1 ? "down" : reverseRow ? "left" : "right"}`} aria-hidden="true"><ConnectorIcon size={15} /></span>}
            </li>;
          })}
        </ol>}
        {journey.hasMore && <button className="item-journey-more" disabled={loading} onClick={() => setPage((value) => value + 1)}>
          {loading ? "Đang tải..." : "Xem thêm sự kiện"}
        </button>}
      </section>
    </>}
    {loading && !journey && <div className="item-journey-loading" role="status"><RotateCw /> Đang tải hành trình...</div>}
  </section>;
}
