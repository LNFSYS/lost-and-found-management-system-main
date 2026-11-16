import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  ExternalLink,
  EyeOff,
  FileText,
  Info,
  Lock,
  Mail,
  Phone,
  Printer,
  Scale,
  Search,
  Server,
  Share2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/auth-context";
import "./privacy-policy-page.css";

interface TocItem {
  id: string;
  num: string;
  title: string;
}

const TOC_SECTIONS: TocItem[] = [
  { id: "sec-legal-basis", num: "01", title: "Căn cứ pháp lý & Nguyên tắc cốt lõi" },
  { id: "sec-commitments", num: "02", title: "5 Cam kết bảo vệ quyền riêng tư DVSV" },
  { id: "sec-classification", num: "03", title: "Bảng phân loại mức độ nhạy cảm S0 – S3" },
  { id: "sec-custody-workflow", num: "04", title: "Trách nhiệm bảo quản & Quy trình trao trả" },
  { id: "sec-media-ai-pii", num: "05", title: "Quy tắc hình ảnh, AI matching & PII Masking" },
  { id: "sec-vault-audit", num: "06", title: "Staff Vault & Nhật ký kiểm toán storage_logs" },
  { id: "sec-user-rights", num: "07", title: "Quyền của chủ thể dữ liệu (PDPD)" },
  { id: "sec-contact-support", num: "08", title: "Đầu mối liên hệ & Hỗ trợ khẩn cấp" },
  { id: "sec-faq", num: "09", title: "Câu hỏi thường gặp (FAQ)" },
];

export function PrivacyPolicyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>("sec-legal-basis");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [shareFeedback, setShareFeedback] = useState(false);

  // Scroll spy & reading progress
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrollPercent = windowHeight > 0 ? (totalScroll / windowHeight) * 100 : 0;
      setScrollProgress(scrollPercent);
      setShowBackToTop(totalScroll > 360);

      // Determine active section
      const sections = TOC_SECTIONS.map((sec) => document.getElementById(sec.id));
      const scrollPosition = window.scrollY + 140;

      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = sections[i];
        if (sec && sec.offsetTop <= scrollPosition) {
          setActiveSection(TOC_SECTIONS[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const topOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setActiveSection(id);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setShareFeedback(true);
        setTimeout(() => setShareFeedback(false), 2400);
      }
    } catch {
      // Fallback
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="privacy-page">
      {/* Top reading progress indicator */}
      <div className="privacy-progress-container" aria-hidden="true">
        <div className="privacy-progress-bar" style={{ width: `${scrollProgress}%` }} />
      </div>

      {/* Header / Top Navigation Bar */}
      <header className="privacy-topbar">
        <div className="privacy-topbar__brand-wrap">
          <Link className="brand" to={user ? "/home" : "/login"}>
            <span className="brand-mark">
              <i>F</i>
              <i>P</i>
              <i>T</i>
            </span>
            <div className="brand-text">
              <strong>FPTU Lost &amp; Found</strong>
              <small>Hệ thống Hỗ trợ Đồ Thất Lạc · ĐH FPT</small>
            </div>
          </Link>
          <span className="privacy-doc-badge">
            <Scale size={14} /> Văn bản Nghiệp vụ &amp; Pháp lý
          </span>
        </div>

        <nav className="privacy-topbar__nav" aria-label="Điều hướng chính sách">
          <button
            type="button"
            className="privacy-nav-btn privacy-nav-btn--ghost"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/home"))}
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
          <button
            type="button"
            className="privacy-nav-btn privacy-nav-btn--ghost"
            onClick={handleShare}
            title="Sao chép đường dẫn chính sách"
          >
            <Share2 size={16} /> {shareFeedback ? "Đã sao chép liên kết!" : "Chia sẻ"}
          </button>
          <button
            type="button"
            className="privacy-nav-btn privacy-nav-btn--ghost"
            onClick={handlePrint}
            title="In hoặc lưu PDF văn bản này"
          >
            <Printer size={16} /> In PDF
          </button>
          {user ? (
            <Link to="/home" className="privacy-nav-btn privacy-nav-btn--primary">
              Vào ứng dụng <ArrowRight size={16} />
            </Link>
          ) : (
            <Link to="/login" className="privacy-nav-btn privacy-nav-btn--primary">
              Đăng nhập <ArrowRight size={16} />
            </Link>
          )}
        </nav>
      </header>

      {/* Hero Banner Section */}
      <section className="privacy-hero">
        <div className="privacy-hero__container">
          <div className="privacy-hero__meta">
            <span className="privacy-pill-tag">
              <ShieldCheck size={14} /> Ban hành bởi Phòng Dịch vụ Sinh viên (DVSV FPTU)
            </span>
            <span className="privacy-pill-tag privacy-pill-tag--accent">
              <Clock size={14} /> Cập nhật: Học kỳ Fall 2026 (Phiên bản 2.4)
            </span>
          </div>

          <h1>Chính Sách Quyền Riêng Tư &amp; Quy Trình Xử Lý Đồ Thất Lạc Nhạy Cảm</h1>
          <p className="privacy-hero__lead">
            Cam kết cao nhất về bảo vệ dữ liệu cá nhân, danh tính sinh viên và an toàn tài sản học đường tại Đại học FPT
            Đà Nẵng. Tuân thủ nghiêm ngặt Điều 230 Bộ luật Dân sự 2015 và Nghị định số 13/2023/NĐ-CP (PDPD).
          </p>

          <div className="privacy-hero__highlights">
            <div className="privacy-stat-card">
              <div className="privacy-stat-card__icon">
                <Scale size={20} />
              </div>
              <div className="privacy-stat-card__info">
                <strong>Điều 230 BLDS</strong>
                <span>Căn cứ pháp lý dân sự</span>
              </div>
            </div>

            <div className="privacy-stat-card">
              <div className="privacy-stat-card__icon">
                <ShieldCheck size={20} />
              </div>
              <div className="privacy-stat-card__info">
                <strong>NĐ 13/2023/NĐ-CP</strong>
                <span>Chuẩn bảo vệ PDPD</span>
              </div>
            </div>

            <div className="privacy-stat-card">
              <div className="privacy-stat-card__icon">
                <Lock size={20} />
              </div>
              <div className="privacy-stat-card__info">
                <strong>Staff Vault 24/7</strong>
                <span>Kho bảo mật camera kép</span>
              </div>
            </div>

            <div className="privacy-stat-card">
              <div className="privacy-stat-card__icon">
                <EyeOff size={20} />
              </div>
              <div className="privacy-stat-card__info">
                <strong>100% PII Masking</strong>
                <span>Che mờ thông tin nhận diện</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Search & Keyword Jump Bar */}
      <div className="privacy-quick-bar">
        <div className="privacy-quick-bar__inner">
          <div className="privacy-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm nhanh điều khoản (ví dụ: CCCD, laptop, mở khóa, thẻ ATM, kho...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Tìm kiếm trong chính sách"
            />
          </div>
          <div className="privacy-quick-bar__tags">
            <span>Từ khóa nhanh:</span>
            <button type="button" className="privacy-quick-tag" onClick={() => handleScrollTo("sec-commitments")}>
              5 Cam kết DVSV
            </button>
            <button type="button" className="privacy-quick-tag" onClick={() => handleScrollTo("sec-classification")}>
              Ma trận S0 – S3
            </button>
            <button type="button" className="privacy-quick-tag" onClick={() => handleScrollTo("sec-media-ai-pii")}>
              Không mở khóa
            </button>
            <button type="button" className="privacy-quick-tag" onClick={() => handleScrollTo("sec-vault-audit")}>
              Audit storage_logs
            </button>
          </div>
        </div>
      </div>

      {/* Main Dual-Column Content Body */}
      <div className="privacy-layout">
        {/* Sticky Table of Contents Sidebar */}
        <aside className="privacy-toc-sidebar" aria-label="Mục lục chính sách">
          <div className="privacy-toc-heading">
            <FileText size={16} /> Mục lục tài liệu
          </div>
          <ul className="privacy-toc-list">
            {TOC_SECTIONS.map((sec) => (
              <li key={sec.id}>
                <a
                  href={`#${sec.id}`}
                  className={`privacy-toc-link ${activeSection === sec.id ? "active" : ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleScrollTo(sec.id);
                  }}
                >
                  <span className="privacy-toc-num">{sec.num}</span>
                  <span>{sec.title}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="privacy-toc-footer">
            <button type="button" className="privacy-toc-btn" onClick={() => handleScrollTo("sec-contact-support")}>
              <Phone size={14} /> Hotline DVSV: 0236 730 0999
            </button>
            <button type="button" className="privacy-toc-btn" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <ArrowUp size={14} /> Cuộn lên đầu trang
            </button>
          </div>
        </aside>

        {/* Content Articles */}
        <main className="privacy-content">
          {/* SECTION 1: Căn cứ pháp lý & Nguyên tắc cốt lõi */}
          <section id="sec-legal-basis" className="privacy-section">
            <div className="privacy-section__header">
              <span className="privacy-section__badge">
                <Scale size={14} /> Điều 01 · Cơ sở Luật pháp &amp; Quy định
              </span>
              <h2>Căn cứ pháp lý &amp; Nguyên tắc cốt lõi</h2>
            </div>

            <p>
              Hệ thống Tìm kiếm &amp; Tiếp nhận Đồ Thất Lạc Đại học FPT Đà Nẵng (<strong>FPTU Lost &amp; Found System - LNFS</strong>)
              được thành lập và vận hành bởi <strong>Phòng Dịch vụ Sinh viên (DVSV)</strong> với mục tiêu hỗ trợ sinh viên,
              giảng viên và cán bộ nhân viên nhanh chóng tìm lại tài sản thất lạc trên khuôn viên trường.
            </p>

            <div className="privacy-callout privacy-callout--law">
              <Scale size={24} />
              <div>
                <strong>Căn cứ Điều 230 Bộ luật Dân sự 2015: Xác lập quyền sở hữu đối với tài sản bị đánh rơi, bỏ quên</strong>
                <p style={{ margin: "6px 0 0", fontSize: "0.86rem" }}>
                  Người nhặt được tài sản do người khác đánh rơi hoặc bỏ quên mà không xác định được ai là chủ sở hữu có nghĩa
                  vụ thông báo hoặc giao nộp cho cơ quan có thẩm quyền hoặc đơn vị quản lý cơ sở (Nhà trường/Phòng Dịch vụ Sinh viên).
                  Việc giao nộp này xác lập trách nhiệm quản lý tạm thời hợp pháp, đồng thời bảo vệ quyền lợi chính đáng của cả
                  người tìm thấy và chủ sở hữu tài sản.
                </p>
              </div>
            </div>

            <div className="privacy-callout privacy-callout--law">
              <ShieldCheck size={24} />
              <div>
                <strong>Căn cứ Nghị định số 13/2023/NĐ-CP (PDPD) &amp; Luật Bảo vệ Dữ liệu Cá nhân số 91/2025/QH15</strong>
                <p style={{ margin: "6px 0 0", fontSize: "0.86rem" }}>
                  Hệ thống LNFS cam kết tuân thủ toàn diện các nguyên tắc bảo vệ dữ liệu cá nhân theo Nghị định PDPD:
                  nguyên tắc hợp pháp, nguyên tắc minh bạch, nguyên tắc giới hạn mục đích, nguyên tắc giảm thiểu dữ liệu
                  (Data Minimization), nguyên tắc giới hạn thời gian lưu trữ, và bảo đảm tính bảo mật, toàn vẹn của dữ liệu sinh viên.
                </p>
              </div>
            </div>

            <h3 style={{ fontSize: "1.15rem", marginTop: "24px" }}>3 Nguyên tắc cốt lõi của LNFS:</h3>
            <ul className="privacy-rule-list">
              <li className="privacy-rule-item allowed">
                <CheckCircle2 size={18} />
                <span>
                  <strong>Trách nhiệm vật lý đi theo sự bàn giao thực tế:</strong> Trách nhiệm bảo quản tài sản chỉ phát sinh khi
                  có việc tiếp nhận bàn giao vật lý tận tay (vật phẩm thực tế), không phụ thuộc vào trạng thái nút bấm, bài đăng
                  hoặc lời hẹn trên ứng dụng.
                </span>
              </li>
              <li className="privacy-rule-item allowed">
                <CheckCircle2 size={18} />
                <span>
                  <strong>Giảm thiểu dữ liệu (Data Minimization):</strong> Chỉ thu thập thông tin tối thiểu cần thiết để xác định
                  và liên hệ trao trả. Nghiêm cấm thu thập thông tin tài chính, mật khẩu hoặc số giấy tờ định danh đầy đủ.
                </span>
              </li>
              <li className="privacy-rule-item allowed">
                <CheckCircle2 size={18} />
                <span>
                  <strong>Không vụ lợi &amp; An toàn học đường:</strong> Toàn bộ quy trình trao trả đồ là hoạt động hỗ trợ cộng đồng
                  sinh viên miễn phí. Nghiêm cấm hành vi đòi tiền chuộc, giữ tài sản để ép buộc hoặc quấy rối dưới mọi hình thức.
                </span>
              </li>
            </ul>
          </section>

          {/* SECTION 2: 5 Cam kết bảo vệ quyền riêng tư cốt lõi của DVSV */}
          <section id="sec-commitments" className="privacy-section">
            <div className="privacy-section__header">
              <span className="privacy-section__badge">
                <ShieldCheck size={14} /> Điều 02 · Cam kết hành động từ DVSV
              </span>
              <h2>5 Cam kết bảo vệ quyền riêng tư cốt lõi của DVSV</h2>
            </div>

            <p>
              Phòng Dịch vụ Sinh viên ĐH FPT Đà Nẵng đưa ra 5 cam kết không thỏa hiệp nhằm bảo vệ sự an tâm tuyệt đối
              của sinh viên và cán bộ khi sử dụng hệ thống Lost &amp; Found:
            </p>

            <div className="privacy-commitments-grid">
              {/* Commitment 1 */}
              <div className="privacy-commitment-card">
                <div className="privacy-commitment-card__header">
                  <div className="privacy-commitment-card__icon">
                    <Lock size={20} />
                  </div>
                  <span className="privacy-commitment-card__badge">Cam kết số 01</span>
                </div>
                <h3>1. Tuyệt đối không mở khóa thiết bị</h3>
                <p>
                  Cán bộ DVSV và người nhặt <strong>nghiêm cấm mọi hành vi</strong> thử mật khẩu, mở khóa màn hình, xem tin nhắn,
                  ảnh chụp cá nhân, lịch sử duyệt web hoặc cắm thiết bị (điện thoại, laptop, iPad, USB) vào máy tính để quét nội dung.
                  Mọi thiết bị điện tử được bảo quản nguyên trạng nguồn và niêm phong cổng kết nối.
                </p>
              </div>

              {/* Commitment 2 */}
              <div className="privacy-commitment-card">
                <div className="privacy-commitment-card__header">
                  <div className="privacy-commitment-card__icon">
                    <EyeOff size={20} />
                  </div>
                  <span className="privacy-commitment-card__badge">Cam kết số 02</span>
                </div>
                <h3>2. Che mờ dữ liệu định danh (PII Masking)</h3>
                <p>
                  Mọi giấy tờ cá nhân (Thẻ sinh viên, CCCD, GPLX, Hộ chiếu) khi đăng thông báo <strong>bắt buộc phải được che mờ (mask)</strong>{" "}
                  số hiệu giấy tờ, mã QR, mã vạch, ngày sinh, địa chỉ thường trú và khuôn mặt. Hệ thống tự động cảnh báo và từ chối ảnh
                  gốc chưa qua che mờ thông tin nhận diện.
                </p>
              </div>

              {/* Commitment 3 */}
              <div className="privacy-commitment-card">
                <div className="privacy-commitment-card__header">
                  <div className="privacy-commitment-card__icon">
                    <Building2 size={20} />
                  </div>
                  <span className="privacy-commitment-card__badge">Cam kết số 03</span>
                </div>
                <h3>3. Staff Vault chuyên dụng bảo mật</h3>
                <p>
                  Tất cả tài sản tiếp nhận vào kho được lưu giữ tại <strong>Staff Vault</strong> (tủ lưu trữ chuyên dụng có khóa mã số
                  riêng biệt, đặt trong phòng làm việc DVSV có hệ thống Camera CCTV an ninh giám sát 24/7). Chỉ nhân viên DVSV được cấp
                  thẩm quyền mới có quyền tiếp cận và mở tủ.
                </p>
              </div>

              {/* Commitment 4 */}
              <div className="privacy-commitment-card">
                <div className="privacy-commitment-card__header">
                  <div className="privacy-commitment-card__icon">
                    <CheckCircle2 size={20} />
                  </div>
                  <span className="privacy-commitment-card__badge">Cam kết số 04</span>
                </div>
                <h3>4. Đóng bài &amp; Ẩn thông tin sau trao trả</h3>
                <p>
                  Ngay khi đồ vật được xác minh và bàn giao thành công cho chủ sở hữu, trạng thái bài đăng lập tức chuyển thành{" "}
                  <strong>RETURNED</strong>. Mọi hình ảnh, bằng chứng xác minh và tin nhắn trao đổi riêng tư sẽ tự động được đóng lại
                  và ẩn khỏi tìm kiếm công khai để bảo vệ danh tính đôi bên.
                </p>
              </div>

              {/* Commitment 5 */}
              <div className="privacy-commitment-card">
                <div className="privacy-commitment-card__header">
                  <div className="privacy-commitment-card__icon">
                    <Database size={20} />
                  </div>
                  <span className="privacy-commitment-card__badge">Cam kết số 05</span>
                </div>
                <h3>5. Nhật ký kiểm toán bất biến (storage_logs)</h3>
                <p>
                  Toàn bộ chuỗi cung ứng custody (nhập kho, niêm phong, kiểm kê, bàn giao, trả lại) được ghi nhận tự động vào bảng nhật ký
                  kiểm toán bất biến (<strong>storage_logs / audit trail</strong>) kèm thông tin định danh nhân sự phụ trách, mốc thời gian
                  chính xác (UTC+7) và mã niêm phong. Không một ai có thể sửa đổi hoặc xóa nhật ký này.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 3: Bảng phân loại mức độ nhạy cảm S0 – S3 */}
          <section id="sec-classification" className="privacy-section">
            <div className="privacy-section__header">
              <span className="privacy-section__badge">
                <AlertTriangle size={14} /> Điều 03 · Phân loại độ nhạy cảm
              </span>
              <h2>Bảng phân loại mức độ nhạy cảm tài sản (S0 – S3)</h2>
            </div>

            <p>
              Để bảo đảm áp dụng đúng biện pháp bảo mật, mọi đồ vật thất lạc được phân loại theo{" "}
              <strong>mức độ rủi ro cao nhất (S0, S1, S2, S3)</strong> của vật thể hoặc dữ liệu chứa bên trong:
            </p>

            <div className="privacy-table-wrapper">
              <table className="privacy-matrix-table">
                <thead>
                  <tr>
                    <th style={{ width: "16%" }}>Cấp độ</th>
                    <th style={{ width: "24%" }}>Ví dụ tài sản</th>
                    <th style={{ width: "30%" }}>Quy định đăng ảnh &amp; Công khai</th>
                    <th style={{ width: "30%" }}>Quy chuẩn tiếp nhận &amp; Bàn giao</th>
                  </tr>
                </thead>
                <tbody>
                  {/* S0 */}
                  <tr>
                    <td>
                      <span className="privacy-level-badge privacy-level-badge--s0">S0 · Thông thường</span>
                    </td>
                    <td>
                      Áo khoác, bình nước cá nhân, dù/ô, sách vở giáo trình, ba lô/túi vải (không có giấy tờ/ví bên trong),
                      chìa khóa cơ xe máy đơn lẻ.
                    </td>
                    <td>
                      <strong style={{ color: "#1f6b33" }}>Cho phép:</strong> Có thể đăng ảnh chụp tổng quát ngoại quan đã rà soát.
                      Hỗ trợ AI gợi ý mô tả nếu người dùng đồng ý.
                    </td>
                    <td>
                      Finder tự giữ để hẹn trao trả trực tiếp tại trường, hoặc gửi vào quầy DVSV để Staff hỗ trợ lưu giữ.
                    </td>
                  </tr>

                  {/* S1 */}
                  <tr>
                    <td>
                      <span className="privacy-level-badge privacy-level-badge--s1">S1 · Giấy tờ &amp; Thiết bị</span>
                    </td>
                    <td>
                      CCCD/Hộ chiếu, Thẻ sinh viên FPTU, GPLX, Thẻ xe chip, Điện thoại (iPhone, Android), Laptop, iPad, Ổ cứng di động, USB.
                    </td>
                    <td>
                      <strong style={{ color: "#b42318" }}>TUYỆT ĐỐI KHÔNG ĐĂNG:</strong> Mặt chứa số giấy tờ, MSSV, họ tên đầy đủ,
                      mã QR, barcode, số serial, IMEI, nội dung màn hình hiển thị. Cấm gửi ảnh gốc chứa PII cho AI bên ngoài.
                    </td>
                    <td>
                      <strong>Bảo quản kín, ưu tiên giao DVSV.</strong> Nghiêm cấm mở khóa thiết bị. Xác minh người nhận qua câu hỏi bí mật
                      (màu ốp lưng, vết trầy xước, hình nền khóa không nhạy cảm, biên lai mua hàng).
                    </td>
                  </tr>

                  {/* S2 */}
                  <tr>
                    <td>
                      <span className="privacy-level-badge privacy-level-badge--s2">S2 · Tài chính &amp; Xác thực</span>
                    </td>
                    <td>
                      Thẻ ngân hàng ATM / Visa / MasterCard, ví tiền chứa thẻ, thiết bị phần cứng OTP Token, giấy ghi chép mật khẩu/PIN,
                      sổ tiết kiệm.
                    </td>
                    <td>
                      <strong style={{ color: "#b42318" }}>NGHIÊM CẤM 100%:</strong> Không chụp, không upload ảnh, không dùng OCR
                      trích xuất dữ liệu, không đăng số thẻ, CVV, OTP hoặc tên chủ tài khoản lên hệ thống.
                    </td>
                    <td>
                      <strong>Niêm phong tức thì:</strong> Cho vào phong bì chuyên dụng có dán tem niêm phong. Không quẹt thử giao dịch.
                      Báo ngay DVSV/Ban An ninh để chuyển giao cho Ngân hàng phát hành hoặc liên hệ chủ thẻ khóa thẻ an toàn.
                    </td>
                  </tr>

                  {/* S3 */}
                  <tr>
                    <td>
                      <span className="privacy-level-badge privacy-level-badge--s3">S3 · Nguy hiểm &amp; Cấm</span>
                    </td>
                    <td>
                      Vũ khí, vật sắc nhọn gây sát thương, hóa chất độc hại, pin lithium phồng rộp nguy cơ cháy nổ, vật nghi chất cấm,
                      thuốc kê đơn đặc trị.
                    </td>
                    <td>
                      <strong style={{ color: "#b42318" }}>CẤM ĐĂNG BÀI:</strong> Không đăng bất kỳ thông tin, ảnh chụp hay tạo bài
                      trên hệ thống tìm kiếm đồ công khai.
                    </td>
                    <td>
                      <strong>Báo Ban An ninh Campus khẩn cấp:</strong> Không tự ý di chuyển vật phẩm nếu có nguy cơ mất an toàn.
                      Cô lập khu vực và chuyển giao ngay cho Campus Security hoặc Trạm Y tế Campus xử lý.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="privacy-callout privacy-callout--alert">
              <AlertCircle size={22} />
              <div>
                <strong>Danh mục thông tin tuyệt đối không được đưa lên hệ thống:</strong>
                <p style={{ margin: "4px 0 0" }}>
                  Mã PIN, mã CVV/CVC thẻ thanh toán, mã OTP, mật khẩu tài khoản, số thẻ tín dụng đầy đủ, số Căn cước công dân đầy đủ,
                  địa chỉ nhà riêng, vị trí tọa độ thời gian thực chính xác của cá nhân.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 4: Trách nhiệm bảo quản & Quy trình bàn giao tài sản */}
          <section id="sec-custody-workflow" className="privacy-section">
            <div className="privacy-section__header">
              <span className="privacy-section__badge">
                <Server size={14} /> Điều 04 · Quy trình nghiệp vụ
              </span>
              <h2>Trách nhiệm bảo quản &amp; Quy trình trao trả tài sản</h2>
            </div>

            <p>
              Để bảo đảm tính minh bạch và tránh các tranh chấp pháp lý không đáng có, hệ thống phân định rõ ràng hai nhánh
              bàn giao tài sản thất lạc:
            </p>

            <div className="privacy-workflow-paths">
              {/* Path A */}
              <div className="privacy-path-card privacy-path-card--finder">
                <span className="privacy-path-card__tag">Nhánh A · Finder giữ để trả trực tiếp</span>
                <h3>Người nhặt tự bảo quản &amp; Bàn giao</h3>
                <ol>
                  <li>
                    <strong>Finder chịu trách nhiệm vật lý:</strong> Người nhặt đồ tiếp tục giữ an toàn món đồ đến lúc bàn giao thực tế.
                  </li>
                  <li>
                    <strong>Xác minh qua tin nhắn an toàn:</strong> Sử dụng hệ thống chat nội bộ của LNFS để đặt câu hỏi nhận diện
                    (không yêu cầu gửi mật khẩu hay ảnh giấy tờ tùy thân).
                  </li>
                  <li>
                    <strong>Hẹn gặp tại nơi công cộng:</strong> Hai bên gặp nhau tại khuôn viên trường (Quầy DVSV Tòa Alpha, Thư viện,
                    Canteen FPTU). Không hẹn ở nơi vắng vẻ hoặc nhà riêng.
                  </li>
                  <li>
                    <strong>Xác nhận hoàn tất 2 chiều:</strong> Cả Finder và Claimant cùng bấm "Xác nhận đã nhận đồ" trên ứng dụng
                    để hoàn tất giao dịch và đóng bài đăng.
                  </li>
                </ol>
              </div>

              {/* Path B */}
              <div className="privacy-path-card privacy-path-card--staff">
                <span className="privacy-path-card__tag">Nhánh B · Chuyển vào kho Custody DVSV</span>
                <h3>Bàn giao cho Quầy DVSV tiếp nhận</h3>
                <ol>
                  <li>
                    <strong>Finder mang đồ đến Quầy DVSV:</strong> Finder giữ đồ cho đến khi Cán bộ DVSV cầm nhận vật lý tận tay.
                  </li>
                  <li>
                    <strong>Biên bản tiếp nhận vật lý (Intake):</strong> Cán bộ DVSV kiểm tra tình trạng ngoại quan, phân loại mức S0-S3,
                    dán nhãn mã vạch và niêm phong nếu là đồ nhạy cảm.
                  </li>
                  <li>
                    <strong>Lưu trữ tại Staff Vault:</strong> Đồ vật được chuyển vào tủ có mã số an toàn, hệ thống ghi log chuyển quyền
                    bảo quản sang DVSV.
                  </li>
                  <li>
                    <strong>Staff là người trao trả:</strong> Chủ sở hữu đến Quầy DVSV đối chiếu hồ sơ, xuất trình thẻ SV, ký biên nhận
                    và nhận lại đồ từ Staff.
                  </li>
                </ol>
              </div>
            </div>

            <div className="privacy-callout privacy-callout--warning">
              <AlertTriangle size={22} />
              <div>
                <strong>Lưu ý quan trọng khi có tranh chấp hoặc nghi ngờ gian lận:</strong>
                <p style={{ margin: "4px 0 0" }}>
                  Nếu có từ 2 người trở lên cùng nhận là chủ sở hữu, hoặc thông tin nhận dạng không trùng khớp, Staff DVSV sẽ tạm ngưng
                  trao trả, giữ tài sản ở chế độ <strong>DISPUTE_HOLD</strong> và chuyển Hội đồng DVSV / Cố vấn học tập xác minh.
                  Tuyệt đối không trao trả cho người đến trước nếu chưa xác thực đầy đủ.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 5: Quy tắc hình ảnh, AI matching & PII Masking */}
          <section id="sec-media-ai-pii" className="privacy-section">
            <div className="privacy-section__header">
              <span className="privacy-section__badge">
                <EyeOff size={14} /> Điều 05 · Bảo vệ Dữ liệu Định danh &amp; AI
              </span>
              <h2>Quy tắc hình ảnh, Trí tuệ nhân tạo (AI) &amp; PII Masking</h2>
            </div>

            <p>
              Hình ảnh đăng tải lên hệ thống LNFS phải đáp ứng các tiêu chuẩn kỹ thuật nhằm ngăn ngừa rò rỉ dữ liệu cá nhân ra môi trường
              mạng:
            </p>

            <ul className="privacy-rule-list">
              <li className="privacy-rule-item prohibited">
                <XCircle size={18} />
                <span>
                  <strong>Cấm đăng ảnh chụp màn hình thiết bị:</strong> Không chụp ảnh màn hình điện thoại hoặc máy tính đang bật để lộ
                  tin nhắn Messenger, Zalo, thông báo ngân hàng, email hoặc ảnh riêng tư.
                </span>
              </li>
              <li className="privacy-rule-item prohibited">
                <XCircle size={18} />
                <span>
                  <strong>Cấm gửi ảnh tài sản S1/S2/S3 cho AI bên ngoài:</strong> Các mô hình trí tuệ nhân tạo (Gemini AI, Vision OCR)
                  chỉ được kích hoạt có kiểm soát cho đồ dùng thông thường S0. Ảnh giấy tờ tùy thân và thẻ ngân hàng bị chặn tự động ở tầng
                  phần mềm.
                </span>
              </li>
              <li className="privacy-rule-item allowed">
                <CheckCircle2 size={18} />
                <span>
                  <strong>Chỉ đăng ảnh ngoại quan đã che mờ:</strong> Khi chụp Thẻ sinh viên hoặc CCCD, bắt buộc phải dùng công cụ che mờ
                  (Blur / Mask) toàn bộ dãy số và mã vạch trước khi đăng bài.
                </span>
              </li>
              <li className="privacy-rule-item allowed">
                <CheckCircle2 size={18} />
                <span>
                  <strong>Bảo vệ hình ảnh trong tin nhắn:</strong> Hình ảnh gửi trong kênh trao đổi xác minh chỉ lưu hành nội bộ giữa hai bên
                  trong phiên liên lạc và được mã hóa lưu trữ trên máy chủ an toàn.
                </span>
              </li>
            </ul>
          </section>

          {/* SECTION 6: Staff Vault & Nhật ký kiểm toán storage_logs */}
          <section id="sec-vault-audit" className="privacy-section">
            <div className="privacy-section__header">
              <span className="privacy-section__badge">
                <Database size={14} /> Điều 06 · Hạ tầng &amp; Nhật ký kiểm toán
              </span>
              <h2>Bảo mật kho lưu trữ (Staff Vault) &amp; Nhật ký storage_logs</h2>
            </div>

            <p>
              Phòng Dịch vụ Sinh viên áp dụng quy trình kiểm soát vật lý và kỹ thuật số đa tầng để bảo đảm tài sản được giữ an toàn tuyệt đối:
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
              <div className="privacy-commitment-card" style={{ background: "#fff" }}>
                <div className="privacy-commitment-card__header">
                  <div className="privacy-commitment-card__icon">
                    <Building2 size={20} />
                  </div>
                  <span className="privacy-commitment-card__badge">Kho vật lý</span>
                </div>
                <h3>Quy chuẩn Staff Vault</h3>
                <p>
                  - Tủ sắt chuyên dụng chống cháy, có mã khóa riêng cho từng ngăn.
                  <br />
                  - Camera giám sát an ninh độ nét cao hoạt động liên tục 24/7/365.
                  <br />
                  - Kiểm soát mở tủ theo nguyên tắc hai nhân sự (Dual Control) đối với tài sản giá trị lớn (tiền mặt &gt; 5.000.000 VNĐ,
                  laptop cao cấp, vàng bạc đá quý).
                </p>
              </div>

              <div className="privacy-commitment-card" style={{ background: "#fff" }}>
                <div className="privacy-commitment-card__header">
                  <div className="privacy-commitment-card__icon">
                    <Server size={20} />
                  </div>
                  <span className="privacy-commitment-card__badge">Hệ thống số</span>
                </div>
                <h3>Nhật ký bất biến storage_logs</h3>
                <p>
                  - Mỗi sự kiện biến động kho (nhập kho, xuất kho, niêm phong) đều sinh ra một bản ghi log bất biến.
                  <br />
                  - Ghi nhận chính xác ID nhân viên thực hiện, thời gian UTC+7, mã niêm phong và lý do nghiệp vụ.
                  <br />
                  - Nhật ký kiểm toán được sao lưu định kỳ và sẵn sàng cho công tác thanh tra học đường.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 7: Quyền của chủ thể dữ liệu */}
          <section id="sec-user-rights" className="privacy-section">
            <div className="privacy-section__header">
              <span className="privacy-section__badge">
                <Scale size={14} /> Điều 07 · Quyền của Sinh viên
              </span>
              <h2>Quyền của chủ thể dữ liệu (Theo Nghị định 13/2023/NĐ-CP)</h2>
            </div>

            <p>
              Là người sử dụng dịch vụ và chủ thể dữ liệu cá nhân tại Đại học FPT Đà Nẵng, bạn có đầy đủ các quyền hợp pháp
              được pháp luật bảo vệ:
            </p>

            <ul className="privacy-rule-list">
              <li className="privacy-rule-item allowed">
                <CheckCircle2 size={18} />
                <span>
                  <strong>Quyền được biết &amp; Quyền đồng ý:</strong> Bạn có quyền được thông báo minh bạch về mục đích xử lý dữ liệu
                  và quyết định có chia sẻ thông tin liên lạc cho đối phương hay không.
                </span>
              </li>
              <li className="privacy-rule-item allowed">
                <CheckCircle2 size={18} />
                <span>
                  <strong>Quyền yêu cầu chỉnh sửa &amp; Ẩn bài đăng:</strong> Bất cứ lúc nào, nếu phát hiện thông tin bài đăng có chứa
                  dữ liệu riêng tư không mong muốn, bạn có thể chỉnh sửa hoặc yêu cầu DVSV ẩn bài đăng lập tức.
                </span>
              </li>
              <li className="privacy-rule-item allowed">
                <CheckCircle2 size={18} />
                <span>
                  <strong>Quyền khiếu nại &amp; Báo cáo vi phạm:</strong> Nếu phát hiện người nhặt hoặc bên thứ ba có hành vi xem lén dữ liệu,
                  mở khóa thiết bị hoặc tống tiền, bạn có quyền gửi báo cáo khiếu nại để DVSV và Hội đồng Kỷ luật xử lý.
                </span>
              </li>
              <li className="privacy-rule-item allowed">
                <CheckCircle2 size={18} />
                <span>
                  <strong>Quy trình thông báo sự cố dữ liệu (Data Breach SLA):</strong> Trong trường hợp không may xảy ra sự cố kỹ thuật làm
                  ảnh hưởng đến dữ liệu cá nhân, Ban Quản trị LNFS có nghĩa vụ thông báo cho người dùng bị ảnh hưởng và cơ quan có thẩm quyền
                  trong vòng 72 giờ theo quy định của pháp luật.
                </span>
              </li>
            </ul>
          </section>

          {/* SECTION 8: Đầu mối liên hệ & Hỗ trợ khẩn cấp */}
          <section id="sec-contact-support" className="privacy-section">
            <div className="privacy-section__header">
              <span className="privacy-section__badge">
                <Phone size={14} /> Điều 08 · Liên hệ &amp; Tiếp nhận trực tiếp
              </span>
              <h2>Đầu mối liên hệ, Báo cáo sự cố &amp; Hỗ trợ khẩn cấp</h2>
            </div>

            <p>
              Mọi thắc mắc về quyền riêng tư, yêu cầu tiếp nhận tài sản giá trị cao hoặc báo cáo hành vi vi phạm chính sách,
              xin vui lòng liên hệ ngay với các đơn vị thường trực:
            </p>

            <div className="privacy-contact-grid">
              <div className="privacy-contact-card">
                <h4>
                  <Building2 size={18} /> Phòng Dịch vụ Sinh viên (DVSV)
                </h4>
                <p>Đơn vị chủ trì điều hành tiếp nhận &amp; bàn giao đồ thất lạc</p>
                <ul>
                  <li>
                    <strong>Địa điểm:</strong> Quầy DVSV, Tầng 1, Tòa nhà Alpha, Campus FPTU Đà Nẵng
                  </li>
                  <li>
                    <strong>Giờ làm việc:</strong> 07:30 – 17:30 (Thứ Hai – Thứ Bảy)
                  </li>
                  <li>
                    <strong>Hotline:</strong> (0236) 730 0999 (Nhánh 1)
                  </li>
                  <li>
                    <strong>Email:</strong> sro.dn@fe.edu.vn / dvsv.fptudn@fpt.edu.vn
                  </li>
                </ul>
              </div>

              <div className="privacy-contact-card">
                <h4>
                  <ShieldCheck size={18} /> Ban An ninh Campus (Security)
                </h4>
                <p>Đầu mối xử lý vật phẩm S3 nguy hiểm, tranh chấp &amp; mất cắp</p>
                <ul>
                  <li>
                    <strong>Địa điểm:</strong> Phòng Trực ban An ninh, Cổng chính Campus FPT Đà Nẵng
                  </li>
                  <li>
                    <strong>Trực ban:</strong> 24/7 (kể cả Chủ nhật và ngày Lễ)
                  </li>
                  <li>
                    <strong>Hotline an ninh:</strong> (0236) 730 0999 (Nhánh An ninh khẩn cấp)
                  </li>
                  <li>
                    <strong>Khu vực phụ trách:</strong> Toàn bộ khuôn viên, bãi đỗ xe và ký túc xá
                  </li>
                </ul>
              </div>

              <div className="privacy-contact-card">
                <h4>
                  <AlertCircle size={18} /> Kênh Báo cáo Trực tuyến
                </h4>
                <p>Gửi khiếu nại hoặc tố cáo vi phạm quyền riêng tư trên app</p>
                <ul>
                  <li>
                    <strong>Gửi báo cáo nhanh:</strong> Truy cập tính năng{" "}
                    <Link to="/reports" style={{ textDecoration: "underline" }}>
                      Báo cáo &amp; Phản ánh
                    </Link>
                  </li>
                  <li>
                    <strong>Thời gian phản hồi SLA:</strong> Trong vòng 04 giờ làm việc
                  </li>
                  <li>
                    <strong>Chế độ báo cáo:</strong> Cho phép gửi ẩn danh đối với trường hợp nhạy cảm
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* SECTION 9: FAQ Accordion */}
          <section id="sec-faq" className="privacy-section">
            <div className="privacy-section__header">
              <span className="privacy-section__badge">
                <Info size={14} /> Điều 09 · Giải đáp thắc mắc
              </span>
              <h2>Câu hỏi thường gặp về Quyền riêng tư (FAQ)</h2>
            </div>

            <div className="privacy-faq-list">
              {[
                {
                  q: "Tôi nhặt được một chiếc iPhone/Laptop, tôi có được mở máy xem thông tin danh bạ để tìm chủ sở hữu không?",
                  a: "TUYỆT ĐỐI KHÔNG. Theo cam kết quyền riêng tư cốt lõi của DVSV và quy định pháp luật về bảo vệ bí mật đời tư, việc tự ý mở khóa màn hình hoặc khám phá dữ liệu trên thiết bị của người khác là hành vi bị nghiêm cấm. Bạn hãy giữ nguyên tình trạng nguồn của thiết bị và mang nộp ngay cho Quầy DVSV Tòa Alpha để nhân viên tiếp nhận vào kho chuyên dụng Staff Vault.",
                },
                {
                  q: "Nếu tôi lỡ đăng tải hình ảnh Thẻ sinh viên có chứa họ tên và MSSV rõ nét thì phải xử lý thế nào?",
                  a: "Bạn hãy vào ngay bài đăng của mình và chọn 'Chỉnh sửa' để thay thế ảnh bằng phiên bản đã che mờ (masking) thông tin định danh cá nhân, hoặc nhấn 'Xóa bài đăng' và tạo lại bài mới. Nếu gặp khó khăn, bạn có thể liên hệ ngay hotline DVSV để Cán bộ hỗ trợ ẩn ảnh trên hệ thống.",
                },
                {
                  q: "Sau khi tôi đã nhận lại đồ thất lạc thành công, thông tin của tôi có bị lưu lại công khai trên mạng không?",
                  a: "Không. Khi thủ tục bàn giao hoàn tất, trạng thái bài đăng chuyển sang 'RETURNED'. Hệ thống LNFS tự động ẩn toàn bộ chi tiết định danh cá nhân, hình ảnh và lịch sử trao đổi xác minh khỏi danh sách tìm kiếm công khai. Chỉ bản ghi nhật ký kiểm toán tối thiểu (storage_logs) được lưu trữ nội bộ để phục vụ đối soát quản trị theo quy định.",
                },
                {
                  q: "Tôi có phải trả tiền chuộc hoặc tiền cảm ơn khi đến Quầy DVSV nhận lại đồ không?",
                  a: "Tuyệt đối không. Hệ thống FPTU Lost & Found và Quầy DVSV hoạt động hoàn toàn miễn phí vì lợi ích của cộng đồng sinh viên FPT. Mọi hành vi gợi ý hoặc đòi tiền chuộc đồ đều vi phạm nghiêm trọng quy chế đạo đức sinh viên và sẽ bị chuyển Hội đồng Kỷ luật xử lý.",
                },
              ].map((faq, idx) => (
                <div key={idx} className={`privacy-faq-item ${openFaqIndex === idx ? "open" : ""}`}>
                  <button type="button" className="privacy-faq-question" onClick={() => toggleFaq(idx)}>
                    <span>{faq.q}</span>
                    <ChevronDown size={18} />
                  </button>
                  {openFaqIndex === idx && <div className="privacy-faq-answer">{faq.a}</div>}
                </div>
              ))}
            </div>

            {/* Acknowledgement Footer Action */}
            <div className="privacy-ack-box">
              <CheckCircle2 size={32} color="#0b63b6" />
              <h3>Bảo vệ quyền riêng tư là trách nhiệm chung của cộng đồng FPTU</h3>
              <p>
                Bằng việc sử dụng hệ thống FPTU Lost &amp; Found, bạn xác nhận đã đọc, hiểu rõ và đồng ý tuân thủ toàn diện các quy
                chuẩn nghiệp vụ trong Chính sách này.
              </p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => (user ? navigate("/home") : navigate("/login"))}
                >
                  {user ? "Tiếp tục sử dụng ứng dụng" : "Đăng nhập ngay"} <ArrowRight size={16} />
                </button>
                <Link to="/posts" className="privacy-nav-btn privacy-nav-btn--ghost" style={{ border: "1px solid #d9e3ee" }}>
                  Xem danh sách bài đăng
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Floating Back-to-Top Button */}
      <button
        type="button"
        className={`privacy-back-to-top ${showBackToTop ? "visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        title="Cuộn lên đầu trang"
        aria-label="Cuộn lên đầu trang"
      >
        <ArrowUp size={20} />
      </button>
    </div>
  );
}
