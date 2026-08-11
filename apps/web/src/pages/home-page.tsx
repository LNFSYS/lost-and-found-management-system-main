import { ArrowDown, ArrowRight, CalendarCheck, Check, Clock3, MapPin, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

const JourneyScene = lazy(async () => {
  const module = await import("../components/journey-scene");
  return { default: module.JourneyScene };
});

type StorySide = "LOST" | "FOUND";
type StageAlign = "left" | "center" | "right";
type ConnectorDirection = "left-right" | "right-left" | "left-center" | "center-right" | "right-center";

const storyCopy: Record<StorySide, { label: string; title: string; description: string; item: string; time: string }> = {
  LOST: { label: "Tôi làm mất đồ", title: "Gửi đi một dấu hiệu", description: "Mô tả điều bạn còn nhớ. Hệ thống sẽ lưu lại và tìm trong các báo nhặt được đang mở.", item: "Ví da màu đen", time: "Khoảng 14:10" },
  FOUND: { label: "Tôi nhặt được đồ", title: "Trao lại một cơ hội", description: "Ghi nhận món đồ, thời gian và nơi nhặt được để chủ sở hữu có cơ hội tìm thấy.", item: "Ví da màu đen", time: "Khoảng 14:18" }
};

const connectorPaths: Record<ConnectorDirection, string> = {
  "left-right": "M25 0 C25 56 75 44 75 100",
  "right-left": "M75 0 C75 56 25 44 25 100",
  "left-center": "M25 0 C25 54 50 46 50 100",
  "center-right": "M50 0 C50 54 75 46 75 100",
  "right-center": "M75 0 C75 54 50 46 50 100"
};

const stageMotion = {
  initial: { opacity: 0.72, y: 34 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.14 },
  transition: { duration: 0.68, ease: [0.22, 1, 0.36, 1] as const }
};

function StageMarker({ number, label, align = "left", dark = false }: { number: string; label: string; align?: StageAlign; dark?: boolean }) {
  return <motion.div
    className={`story-stage-marker story-stage-marker--${align} ${dark ? "story-stage-marker--dark" : ""}`}
    initial={{ opacity: 0, y: 14 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.8 }}
    transition={{ duration: 0.45 }}
  >
    <motion.span initial={{ scale: 0.65 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>{number}</motion.span>
    <strong>{label}</strong>
  </motion.div>;
}

function StoryConnector({ direction, dark = false }: { direction: ConnectorDirection; dark?: boolean }) {
  const path = connectorPaths[direction];
  return <div className={`story-connector ${dark ? "story-connector--dark" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <path className="story-connector-base" d={path} />
      <motion.path className="story-connector-active" d={path} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.65 }} transition={{ duration: 0.9, ease: "easeInOut" }} />
      <motion.circle cx={direction.endsWith("right") ? 75 : direction.endsWith("left") ? 25 : 50} cy="100" r="2.6" initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.72, type: "spring" }} />
    </svg>
    <motion.span className="story-connector-mobile" initial={{ scaleY: 0.18 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }} />
  </div>;
}

function StoryStage({ children, className, id }: { children: ReactNode; className: string; id?: string }) {
  return <motion.section id={id} className={`story-stage ${className}`} {...stageMotion}>{children}</motion.section>;
}

export function HomePage() {
  const [storySide, setStorySide] = useState<StorySide>("LOST");
  const selected = storyCopy[storySide];

  function chooseStory(side: StorySide) {
    setStorySide(side);
    document.querySelector("#quick-story")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className="home-page">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="hero-grid" id="journey-start">
        <div className="hero-copy">
          <p className="story-kicker"><span /> FPTU Lost &amp; Found</p>
          <h1 id="home-title">Một món đồ thất lạc.<br /><em>Một hành trình trở về.</em></h1>
          <p className="hero-lead">Hai người xa lạ để lại những dấu hiệu khác nhau. Hệ thống giúp các dấu hiệu ấy tìm thấy nhau, còn quyết định cuối cùng luôn có con người xác minh.</p>
          <div className="campus-strip" aria-label="Thông tin campus">
            <span><MapPin size={16} /> FPTU Đà Nẵng</span>
            <span><Clock3 size={16} /> 8:00 - 17:30</span>
            <span><ShieldCheck size={16} /> Điểm tiếp nhận</span>
          </div>
          <div className="hero-actions">
            <button className="journey-button journey-button--orange" onClick={() => chooseStory("LOST")}>Tôi bị mất đồ <ArrowRight size={18} /></button>
            <button className="journey-button journey-button--ghost" onClick={() => chooseStory("FOUND")}>Tôi vừa nhặt được đồ</button>
          </div>
          <a className="scroll-cue" href="#two-sides"><ArrowDown size={16} /> Cuộn để theo dấu món đồ</a>
        </div>
        <div className="hero-stage">
          <Suspense fallback={<div className="journey-loading">Đang dựng hành trình...</div>}><JourneyScene /></Suspense>
          <div className="campus-card"><strong>Campus Lost &amp; Found Desk</strong><span>Tòa Alpha · Phòng CTSV</span></div>
          <div className="floating-status floating-status--lost"><span>LOST</span><strong>14:10</strong><small>Một báo cáo vừa được gửi</small></div>
          <div className="floating-status floating-status--found"><span>FOUND</span><strong>14:18</strong><small>Một dấu hiệu mới xuất hiện</small></div>
        </div>
      </div>
    </section>

    <div className="story-journey">
      <StoryStage className="story-section two-sides story-stage--report" id="two-sides">
        <StageMarker number="01" label="Báo tin" align="left" />
        <div className="story-heading">
          <p className="story-index">Bắt đầu</p>
          <h2>Chọn câu chuyện gần với bạn nhất</h2>
          <p>Mỗi món đồ thường bắt đầu từ một trong hai tình huống. Hãy chọn hướng phù hợp để tiếp tục hành trình tìm lại hoặc trao trả vật phẩm.</p>
        </div>
        <div className="choice-grid">
          <button type="button" aria-pressed={storySide === "LOST"} className={`choice-panel choice-panel--lost ${storySide === "LOST" ? "is-selected" : ""}`} onClick={() => chooseStory("LOST")}>
            <span className="choice-topline"><span className="choice-code">LOST / 01</span><span className="choice-check"><Check size={14} /> Đang chọn</span></span>
            <span className="choice-icon"><ScanSearch /></span>
            <span className="choice-copy"><span className="choice-title">Tôi làm mất đồ</span><span className="choice-description">Mô tả vật phẩm, thời gian và địa điểm bạn nhớ để hệ thống tìm các báo cáo phù hợp.</span></span>
            <span className="choice-meta"><span>Vật phẩm đã mất</span><span>Vị trí gần nhất</span><span>Gợi ý phù hợp</span></span>
            <strong className="choice-action">Bắt đầu báo mất <ArrowRight size={17} /></strong>
          </button>
          <button type="button" aria-pressed={storySide === "FOUND"} className={`choice-panel choice-panel--found ${storySide === "FOUND" ? "is-selected" : ""}`} onClick={() => chooseStory("FOUND")}>
            <span className="choice-topline"><span className="choice-code">FOUND / 02</span><span className="choice-check"><Check size={14} /> Đang chọn</span></span>
            <span className="choice-icon"><Sparkles /></span>
            <span className="choice-copy"><span className="choice-title">Tôi nhặt được đồ</span><span className="choice-description">Gửi thông tin món đồ nhặt được để chủ sở hữu có cơ hội nhận lại an toàn.</span></span>
            <span className="choice-meta"><span>Món đồ tìm thấy</span><span>Điểm giao nộp</span><span>Staff xác minh</span></span>
            <strong className="choice-action">Bắt đầu báo nhặt <ArrowRight size={17} /></strong>
          </button>
        </div>
        <StoryConnector direction="left-right" />
      </StoryStage>

      <StoryStage className="story-section quick-story story-stage--describe" id="quick-story">
        <StageMarker number="02" label="Mô tả nhanh" align="right" />
        <div className="input-story">
          <div className="story-heading story-heading--left stage-copy-card"><p className="story-index">Thông tin ban đầu</p><h2>{selected.title}</h2><p>{selected.description}</p><div className="stage-benefits"><span><Check size={15} /> Nhập nhanh trong vài phút</span><span><Check size={15} /> Có thể thêm ảnh minh chứng</span><span><Check size={15} /> Dữ liệu được chuyển sang bước so sánh</span></div></div>
          <motion.div className="story-form-preview" aria-label={`Minh họa luồng ${selected.label}`} initial={{ opacity: 0, x: 36 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <div className="preview-title"><span>{storySide}</span><small>Bản nháp báo tin</small></div>
            <label>Tên vật phẩm<strong>{selected.item}</strong></label>
            <div className="preview-row"><label><MapPin size={16} /> Địa điểm<strong>Tòa Alpha</strong></label><label><Clock3 size={16} /> Thời gian<strong>{selected.time}</strong></label></div>
            <div className="image-placeholder"><Sparkles size={20} /><span>Thêm ảnh để mô tả rõ hơn</span></div>
            <div className="preview-submit"><span>4 thông tin đã sẵn sàng</span><i><ArrowRight size={18} /></i></div>
          </motion.div>
        </div>
        <div className="data-bridge" aria-hidden="true"><span>{selected.item}</span><span>Tòa Alpha</span><span>{selected.time}</span><i /></div>
        <StoryConnector direction="right-left" />
      </StoryStage>

      <StoryStage className="story-section analysis-story story-stage--analysis" id="system-analysis">
        <StageMarker number="03" label="Hệ thống xử lý" align="left" />
        <div className="analysis-layout">
          <div className="story-heading story-heading--left stage-copy-card"><p className="story-index">Dữ liệu đi vào hệ thống</p><h2>Những chi tiết rời rạc được sắp xếp lại.</h2><p>Thông tin được chuẩn hóa thành các dấu hiệu có thể so sánh. Đây là bước chuẩn bị dữ liệu, chưa phải kết luận matching.</p><div className="stage-note"><Sparkles size={18} /><span>Mục tiêu là biến mô tả tự do thành các tín hiệu rõ ràng: tên đồ, nơi xảy ra, thời gian và đặc điểm nhận dạng.</span></div></div>
          <div className="analysis-pipeline">
            {[
              { title: "Chuẩn hóa thông tin", desc: "Làm sạch tên đồ, thời gian, địa điểm." },
              { title: "Phân tích mô tả", desc: "Nhận diện màu sắc, chất liệu, dấu hiệu riêng." },
              { title: "Trích xuất dấu hiệu", desc: "Tạo bộ tín hiệu dùng để đối chiếu." },
              { title: "Sẵn sàng so sánh", desc: "Đưa vào hàng chờ tìm báo cáo phù hợp." }
            ].map((step, index) => <motion.article key={step.title} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.11 }}><span>0{index + 1}</span><strong>{step.title}</strong><small>{step.desc}</small><i><Check size={15} /></i></motion.article>)}
          </div>
        </div>
        <StoryConnector direction="left-right" />
      </StoryStage>

      <StoryStage className="processing-story story-stage--search" id="matching-search">
        <StageMarker number="04" label="Tìm kiếm và so sánh" align="right" dark />
        <div className="processing-inner">
          <div className="processing-copy"><p className="story-index">Hệ thống tiếp nhận</p><h2>Phần còn lại để hệ thống tìm kiếm.</h2><p>Thông tin được kiểm tra, phân loại và so sánh với các báo cáo đang mở. Đây là gợi ý matching theo nhiều tín hiệu, không phải kết luận quyền sở hữu.</p><div className="processing-stats"><span><strong>24/7</strong><small>theo dõi báo cáo</small></span><span><strong>4</strong><small>tín hiệu chính</small></span><span><strong>1</strong><small>hàng chờ staff</small></span></div><div className="signal-list"><span><Check /> Dữ liệu hợp lệ</span><span><Check /> Cùng danh mục</span><span><Check /> Gần thời gian</span><span><Check /> Cùng khu vực</span></div></div>
          <div className="scan-board">
            <div className="scan-status"><ScanSearch size={14} /><span>Đang quét báo cáo phù hợp</span></div>
            <motion.div className="scan-line" aria-hidden="true" animate={{ top: ["7%", "91%", "91%", "7%"], opacity: [.25, 1, 1, .25] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", times: [0, .46, .54, 1] }}><i /></motion.div>
            <article><small>FOUND #184</small><strong>Ví da đen</strong><span>Beta · 16:40</span></article>
            <article className="is-candidate"><small>FOUND #219</small><strong>Ví da màu đen</strong><span>Alpha · 14:18</span><b>Ứng viên phù hợp</b></article>
            <article><small>FOUND #203</small><strong>Ví màu nâu</strong><span>Alpha · 09:20</span></article>
          </div>
        </div>
        <StoryConnector direction="right-left" dark />
      </StoryStage>

      <StoryStage className="match-moment story-stage--match" id="potential-match">
        <StageMarker number="05" label="Gợi ý phù hợp" align="left" />
        <div className="match-copy"><p className="story-index">Gợi ý phù hợp</p><h2>Có vẻ hai câu chuyện đang nói về cùng một món đồ.</h2><p>Mức tương đồng chỉ mang tính gợi ý. Hệ thống không tự động giao đồ dù điểm matching cao.</p></div>
        <div className="match-stage"><article className="match-card match-card--lost"><span>LOST</span><h3>Ví da màu đen</h3><p>Alpha · 14:10</p></article><motion.div className="match-score" initial={{ scale: .72 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 220 }}><ScanSearch size={24} /><strong>92%</strong><small>tương đồng</small></motion.div><article className="match-card match-card--found"><span>FOUND</span><h3>Ví da màu đen</h3><p>Alpha · 14:18</p></article></div>
        <div className="match-alert"><ShieldCheck size={18} /><span>Gợi ý này sẽ được đưa vào danh sách cần staff xác minh trước khi liên hệ bàn giao.</span></div>
        <div className="match-reasons"><span><Check /> Cùng danh mục</span><span><Check /> Cùng tòa Alpha</span><span><Check /> Cách nhau 8 phút</span><span><Check /> Mô tả tương đồng</span></div>
        <StoryConnector direction="left-center" />
      </StoryStage>

      <StoryStage className="story-section human-review story-stage--review" id="human-review">
        <StageMarker number="06" label="Con người xác minh" align="center" />
        <div className="review-visual"><div className="review-sheet"><span className="review-status"><ShieldCheck size={17} /> Cần nhân viên xác minh</span><div className="review-handoff"><span>Gợi ý từ hệ thống</span><ArrowDown size={16} /><strong>Nhân viên xác minh</strong></div><h3>Đối chiếu bằng chứng</h3><p>Thông tin riêng và bằng chứng sở hữu chỉ hỗ trợ nhân viên đưa ra quyết định.</p><ul><li><Check /> Đặc điểm riêng của vật phẩm</li><li><Check /> Bằng chứng sở hữu</li><li><Check /> Thông tin chỉ chủ sở hữu biết</li></ul><div className="review-stamp">ĐANG XEM XÉT</div></div></div>
        <div className="story-heading story-heading--left stage-copy-card"><p className="story-index">Con người xác minh</p><h2>Công nghệ tìm ra khả năng. Con người bảo vệ sự chính xác.</h2><p>Người nhận gửi claim và bằng chứng. Staff/Admin xem xét trước khi xác nhận lịch bàn giao, giúp hạn chế nhận nhầm hoặc mạo danh.</p><div className="stage-benefits"><span><Check size={15} /> Bảo vệ thông tin riêng</span><span><Check size={15} /> Hạn chế nhận nhầm</span><span><Check size={15} /> Có lịch sử xử lý rõ ràng</span></div></div>
        <StoryConnector direction="center-right" />
      </StoryStage>

      <StoryStage className="handover-story story-stage--handover" id="handover">
        <StageMarker number="07" label="Bàn giao" align="right" dark />
        <div className="story-heading"><p className="story-index">Đoạn đường cuối</p><h2>Giờ chỉ còn đưa món đồ về đúng người.</h2></div>
        <div className="handover-summary"><span><CalendarCheck size={18} /> Lịch hẹn đã xác nhận</span><strong>Thứ 5 · 15:30 · Tòa Alpha</strong></div>
        <div className="handover-track"><div><span>01</span><strong>Người nhặt</strong><small>Giao nộp món đồ</small></div><motion.i initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} /><div className="handover-point"><span><CalendarCheck /></span><strong>Điểm bàn giao</strong><small>Thứ 5 · 15:30</small></div><motion.i initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} /><div><span>03</span><strong>Chủ sở hữu</strong><small>Nhận lại an toàn</small></div></div>
        <div className="journey-progress"><span className="is-done">Lost</span><span className="is-done">Found</span><span className="is-done">Matched</span><span className="is-done">Verified</span><span className="is-current">Returned</span></div>
      </StoryStage>
    </div>

    <section className="closing-story"><p className="story-index">Hành trình khép lại</p><h2>Một món đồ thất lạc.<br />Hai người xa lạ.<br /><em>Một cái kết đúng chủ.</em></h2><p>Hồ sơ của bạn đã sẵn sàng cho những luồng Lost &amp; Found tiếp theo.</p><div className="hero-actions"><button className="journey-button journey-button--orange" onClick={() => chooseStory("LOST")}>Xem luồng báo mất</button><button className="journey-button journey-button--ghost-light" onClick={() => chooseStory("FOUND")}>Xem luồng báo nhặt</button><Link className="profile-link" to="/profile">Quản lý hồ sơ <ArrowRight size={17} /></Link></div></section>
  </div>;
}
