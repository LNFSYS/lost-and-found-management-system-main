import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Flame,
  Info,
  Layers3,
  MapPin,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp
} from "lucide-react";
import {
  api,
  type RadarAlert,
  type RadarAnalytics,
  type RadarHotspot,
  type RadarTopCategory
} from "../services/api";
import "./campus-radar-dashboard.css";

type DatePreset = "7d" | "30d" | "90d" | "custom";

function formatDateInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPresetDates(days: number): { from: string; to: string } {
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    from: formatDateInput(fromDate),
    to: formatDateInput(toDate)
  };
}

function formatViDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

function formatViDateTime(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

export function CampusRadarDashboard() {
  const initialDates = useMemo(() => getPresetDates(30), []);
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [fromDate, setFromDate] = useState<string>(initialDates.from);
  const [toDate, setToDate] = useState<string>(initialDates.to);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<RadarAnalytics | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchRadarData = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRadarAnalytics(from, to);
      setAnalytics(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể tải dữ liệu Radar Analytics";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRadarData(fromDate, toDate);
  }, [fetchRadarData, fromDate, toDate]);

  function handlePresetChange(newPreset: DatePreset) {
    setPreset(newPreset);
    if (newPreset === "7d") {
      const dates = getPresetDates(7);
      setFromDate(dates.from);
      setToDate(dates.to);
    } else if (newPreset === "30d") {
      const dates = getPresetDates(30);
      setFromDate(dates.from);
      setToDate(dates.to);
    } else if (newPreset === "90d") {
      const dates = getPresetDates(90);
      setFromDate(dates.from);
      setToDate(dates.to);
    }
  }

  function handleManualDateChange(type: "from" | "to", val: string) {
    setPreset("custom");
    if (type === "from") {
      setFromDate(val);
    } else {
      setToDate(val);
    }
  }

  function handleRefresh() {
    void fetchRadarData(fromDate, toDate);
  }

  async function handleAcknowledge(alertId: string) {
    if (acknowledgingId) return;
    setAcknowledgingId(alertId);
    setActionNotice(null);
    try {
      await api.acknowledgeRadarAlert(alertId);
      setActionNotice("Đã ghi nhận cảnh báo thành công. Trạng thái đã được cập nhật.");
      setAnalytics(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          alerts: prev.alerts.map(a =>
            a.id === alertId ? { ...a, status: "ACKNOWLEDGED" as const } : a
          )
        };
      });
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể ghi nhận cảnh báo";
      setError(msg);
    } finally {
      setAcknowledgingId(null);
    }
  }

  // Hotspots calculations
  const hotspots: RadarHotspot[] = analytics?.hotspots ?? [];
  const maxHotspotIncidents = useMemo(() => {
    if (!hotspots.length) return 1;
    return Math.max(...hotspots.map(h => h.incidentCount), 1);
  }, [hotspots]);

  const totalHotspotIncidents = useMemo(() => {
    return hotspots.reduce((sum, h) => sum + h.incidentCount, 0);
  }, [hotspots]);

  // Categories calculations
  const categories: RadarTopCategory[] = analytics?.categories ?? [];
  const totalLostItems = useMemo(() => {
    return categories.reduce((sum, c) => sum + c.lostCount, 0);
  }, [categories]);

  const maxCategoryLost = useMemo(() => {
    if (!categories.length) return 1;
    return Math.max(...categories.map(c => c.lostCount), 1);
  }, [categories]);

  // Alerts calculations
  const alerts: RadarAlert[] = analytics?.alerts ?? [];
  const openAlerts = useMemo(() => {
    return alerts.filter(a => a.status === "OPEN");
  }, [alerts]);

  const criticalAlertsCount = useMemo(() => {
    return alerts.filter(a => a.severity === "CRITICAL" && a.status === "OPEN").length;
  }, [alerts]);

  const topHotspotName = hotspots.length > 0
    ? (hotspots[0].buildingName || hotspots[0].areaName || "Chưa xác định")
    : "Chưa có";

  return (
    <div className="campus-radar-container">
      {/* Header Banner */}
      <section className="radar-hero-card">
        <div className="radar-hero-content">
          <div className="radar-hero-badge">
            <Radar className="radar-pulse-icon" size={20} />
            <span>FPTU CAMPUS RADAR &bull; THỐNG KÊ ĐIỂM NÓNG</span>
          </div>
          <h1>Radar Thất Lạc & Điểm Nóng Cơ Sở</h1>
          <p>
            Giám sát xu hướng thất lạc tài sản, phát hiện sớm các điểm nóng bất thường theo
            thời gian thực và phân tích nhóm vật phẩm có nguy cơ cao trên toàn khuôn viên FPTU.
          </p>
        </div>
        <div className="radar-hero-stats">
          <div className="radar-hero-stat-box">
            <span className="radar-hero-stat-label">Cảnh báo mở</span>
            <strong className={`radar-hero-stat-num ${criticalAlertsCount > 0 ? "radar-text-critical" : ""}`}>
              {openAlerts.length}
            </strong>
          </div>
          <div className="radar-hero-stat-box">
            <span className="radar-hero-stat-label">Vụ việc điểm nóng</span>
            <strong className="radar-hero-stat-num">{totalHotspotIncidents}</strong>
          </div>
          <div className="radar-hero-stat-box">
            <span className="radar-hero-stat-label">Tổng đồ báo mất</span>
            <strong className="radar-hero-stat-num">{totalLostItems}</strong>
          </div>
        </div>
      </section>

      {/* Date Range Filter Bar */}
      <section className="radar-filter-bar-card">
        <div className="radar-filter-bar-inner">
          <div className="radar-filter-presets">
            <span className="radar-filter-label">
              <Calendar size={16} /> Khoảng thời gian:
            </span>
            <div className="radar-preset-buttons" role="group" aria-label="Bộ chọn nhanh thời gian">
              <button
                type="button"
                className={`radar-preset-btn ${preset === "7d" ? "active" : ""}`}
                onClick={() => handlePresetChange("7d")}
              >
                7 ngày qua
              </button>
              <button
                type="button"
                className={`radar-preset-btn ${preset === "30d" ? "active" : ""}`}
                onClick={() => handlePresetChange("30d")}
              >
                30 ngày qua
              </button>
              <button
                type="button"
                className={`radar-preset-btn ${preset === "90d" ? "active" : ""}`}
                onClick={() => handlePresetChange("90d")}
              >
                Học kỳ này (3 tháng)
              </button>
              <button
                type="button"
                className={`radar-preset-btn ${preset === "custom" ? "active" : ""}`}
                onClick={() => setPreset("custom")}
              >
                Tùy chọn
              </button>
            </div>
          </div>

          <div className="radar-filter-dates">
            <label className="radar-date-input-group">
              <span>Từ ngày:</span>
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={e => handleManualDateChange("from", e.target.value)}
              />
            </label>
            <label className="radar-date-input-group">
              <span>Đến ngày:</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={e => handleManualDateChange("to", e.target.value)}
              />
            </label>
            <button
              type="button"
              className="primary-button radar-refresh-btn"
              onClick={handleRefresh}
              disabled={loading}
              title="Cập nhật lại dữ liệu Radar Analytics"
            >
              <RefreshCw size={16} className={loading ? "spin-icon" : ""} />
              <span>{loading ? "Đang tải..." : "Cập nhật dữ liệu"}</span>
            </button>
          </div>
        </div>

        <div className="radar-filter-meta">
          <span className="radar-meta-item">
            <ClockIcon size={14} /> Quét từ: <strong>{formatViDate(fromDate)}</strong> đến <strong>{formatViDate(toDate)}</strong>
          </span>
          {analytics && (
            <span className="radar-meta-item radar-meta-muted">
              Đồng bộ dữ liệu cơ sở dữ liệu thời gian thực
            </span>
          )}
        </div>
      </section>

      {/* Action Notices / Error Banners */}
      {actionNotice && (
        <div className="radar-feedback-banner radar-feedback-banner--success" role="status">
          <CheckCircle2 size={18} />
          <span>{actionNotice}</span>
        </div>
      )}

      {error && (
        <div className="radar-feedback-banner radar-feedback-banner--error" role="alert">
          <AlertOctagon size={18} />
          <span>{error}</span>
          <button type="button" className="radar-banner-retry" onClick={handleRefresh}>
            Thử lại
          </button>
        </div>
      )}

      {/* Radar Hotspot Alerts Banner */}
      <section className="radar-alerts-section">
        <div className="radar-section-header">
          <div className="radar-section-title-wrap">
            <span className="radar-section-icon radar-section-icon--alert">
              <AlertTriangle size={20} />
            </span>
            <div>
              <h2>Hộp Cảnh báo Radar (Radar Hotspot Alerts)</h2>
              <p>Phát hiện đột biến tần suất thất lạc so với phương sai thống kê chuẩn (Z-Score &ge; 2.0&sigma;)</p>
            </div>
          </div>
          <span className={`radar-alert-pill ${openAlerts.length > 0 ? "has-alerts" : "all-clear"}`}>
            {openAlerts.length > 0
              ? `${openAlerts.length} Cảnh báo cần xử lý`
              : "0 Cảnh báo mở"}
          </span>
        </div>

        {openAlerts.length === 0 ? (
          <div className="radar-all-clear-card">
            <ShieldCheck size={32} className="radar-clear-icon" />
            <div className="radar-clear-info">
              <h3>Hệ thống Radar an toàn &bull; Không có đột biến điểm nóng</h3>
              <p>
                Toàn bộ các vị trí trong khoảng thời gian từ {formatViDate(fromDate)} đến {formatViDate(toDate)} đều
                nằm trong ngưỡng dao động bình thường. Không phát hiện sự cố mất cắp hoặc bỏ quên hàng loạt.
              </p>
            </div>
          </div>
        ) : (
          <div className="radar-alerts-grid">
            {openAlerts.map(alert => {
              const isCritical = alert.severity === "CRITICAL";
              const isWarning = alert.severity === "WARNING";
              const isAcknowledging = acknowledgingId === alert.id;

              return (
                <article
                  key={alert.id}
                  className={`radar-alert-card ${
                    isCritical ? "radar-alert-card--critical" : isWarning ? "radar-alert-card--warning" : "radar-alert-card--watch"
                  }`}
                >
                  <div className="radar-alert-card-top">
                    <div className="radar-alert-severity-badge">
                      {isCritical ? (
                        <>
                          <AlertOctagon size={16} />
                          <span>NGHIÊM TRỌNG (CRITICAL)</span>
                        </>
                      ) : isWarning ? (
                        <>
                          <AlertTriangle size={16} />
                          <span>CẢNH BÁO (WARNING)</span>
                        </>
                      ) : (
                        <>
                          <Info size={16} />
                          <span>GIÁM SÁT (WATCH)</span>
                        </>
                      )}
                    </div>
                    <span className="radar-alert-status-badge">
                      {alert.status === "OPEN" ? "Chưa ghi nhận" : "Đã ghi nhận"}
                    </span>
                  </div>

                  <div className="radar-alert-card-main">
                    <h3 className="radar-alert-title">
                      {alert.buildingName || alert.areaName ? (
                        <>
                          <Building2 size={16} />
                          <span>
                            {alert.buildingName ?? "Khuôn viên"} {alert.areaName ? `(${alert.areaName})` : ""}
                          </span>
                        </>
                      ) : (
                        <>
                          <MapPin size={16} />
                          <span>Điểm nóng chưa gán định danh</span>
                        </>
                      )}
                    </h3>

                    {alert.categoryName && (
                      <div className="radar-alert-category-tag">
                        <Tag size={13} />
                        <span>Danh mục nghi vấn: <strong>{alert.categoryName}</strong></span>
                      </div>
                    )}

                    <div className="radar-alert-stats-row">
                      <div className="radar-anomaly-stat">
                        <span className="stat-label">Số vụ ghi nhận:</span>
                        <strong className="stat-value">{alert.observedCount} vụ</strong>
                      </div>
                      <div className="radar-anomaly-stat">
                        <span className="stat-label">Mức kỳ vọng:</span>
                        <span className="stat-value">{Number(alert.expectedMean).toFixed(1)} vụ</span>
                      </div>
                      <div className="radar-anomaly-stat">
                        <span className="stat-label">Chỉ số Z-Score:</span>
                        <strong className="stat-value stat-value--highlight">
                          +{Number(alert.zScore).toFixed(2)}&sigma;
                        </strong>
                      </div>
                    </div>

                    <p className="radar-alert-description">
                      Phát hiện tăng đột biến {alert.observedCount} vụ việc (kỳ vọng bình thường:{" "}
                      {Number(alert.expectedMean).toFixed(1)}). Nguy cơ cao có tình trạng bỏ quên hoặc trộm cắp tập trung.
                    </p>

                    <div className="radar-alert-timestamps">
                      <span>Cửa sổ quét: {formatViDate(alert.windowStart)} - {formatViDate(alert.windowEnd)}</span>
                      <span>Phát hiện: {formatViDateTime(alert.lastDetectedAt)}</span>
                    </div>
                  </div>

                  <div className="radar-alert-card-footer">
                    <button
                      type="button"
                      className="radar-acknowledge-btn"
                      disabled={isAcknowledging || alert.status !== "OPEN"}
                      onClick={() => handleAcknowledge(alert.id)}
                      title="Xác nhận cán bộ đã xem và ghi nhận cảnh báo điểm nóng này"
                    >
                      {isAcknowledging ? (
                        <>
                          <RefreshCw size={15} className="spin-icon" />
                          <span>Đang ghi nhận...</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>Đã ghi nhận</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 4 Summary Stat Cards */}
      <section className="radar-kpi-summary-grid">
        <article className="radar-kpi-card">
          <div className="radar-kpi-icon radar-kpi-icon--flame">
            <Flame size={22} />
          </div>
          <div className="radar-kpi-info">
            <small>Điểm nóng nhiều vụ nhất</small>
            <strong>{topHotspotName}</strong>
            <span>{hotspots[0]?.incidentCount ?? 0} vụ việc ghi nhận</span>
          </div>
        </article>

        <article className="radar-kpi-card">
          <div className="radar-kpi-icon radar-kpi-icon--layers">
            <Layers3 size={22} />
          </div>
          <div className="radar-kpi-info">
            <small>Nhóm đồ thất lạc hàng đầu</small>
            <strong>{categories[0]?.categoryName ?? "Chưa có"}</strong>
            <span>{categories[0]?.lostCount ?? 0} món đồ báo mất</span>
          </div>
        </article>

        <article className="radar-kpi-card">
          <div className="radar-kpi-icon radar-kpi-icon--trend">
            <TrendingUp size={22} />
          </div>
          <div className="radar-kpi-info">
            <small>Tổng địa điểm ghi nhận</small>
            <strong>{hotspots.length} khu vực</strong>
            <span>Chiếm {totalHotspotIncidents} vụ việc</span>
          </div>
        </article>

        <article className="radar-kpi-card">
          <div className="radar-kpi-icon radar-kpi-icon--activity">
            <Activity size={22} />
          </div>
          <div className="radar-kpi-info">
            <small>Chỉ số kiểm soát an toàn</small>
            <strong className={openAlerts.length > 0 ? "radar-text-warning" : "radar-text-green"}>
              {openAlerts.length === 0 ? "100% An toàn" : `Cảnh báo (${openAlerts.length})`}
            </strong>
            <span>{openAlerts.length === 0 ? "Không có điểm nóng mở" : "Cần bố trí giám sát"}</span>
          </div>
        </article>
      </section>

      {/* Main Analytics Grid: Hotspots Ranking & Category Breakdown */}
      <div className="radar-analytics-layout">
        {/* Requirement 2: Hotspots Ranking */}
        <section className="radar-panel radar-hotspots-panel">
          <div className="radar-panel-heading">
            <div className="radar-panel-title-group">
              <span className="radar-icon-box radar-icon-box--flame">
                <Flame size={20} />
              </span>
              <div>
                <h2>Điểm nóng Tòa nhà / Khu vực</h2>
                <p>Xếp hạng địa điểm có số lượng vụ việc thất lạc nhiều nhất</p>
              </div>
            </div>
            <span className="radar-count-tag">{hotspots.length} địa điểm</span>
          </div>

          <div className="radar-panel-content">
            {hotspots.length === 0 ? (
              <div className="radar-empty-state">
                <MapPin size={36} className="radar-empty-icon" />
                <p>Không có dữ liệu điểm nóng trong khoảng thời gian đã chọn.</p>
                <small>Hãy chọn khoảng thời gian rộng hơn để xem phân tích dữ liệu.</small>
              </div>
            ) : (
              <div className="radar-hotspots-list">
                {hotspots.map((item, index) => {
                  const rank = index + 1;
                  const ratio = Math.min(100, Math.max(5, (item.incidentCount / maxHotspotIncidents) * 100));
                  const percentage = totalHotspotIncidents > 0
                    ? ((item.incidentCount / totalHotspotIncidents) * 100).toFixed(1)
                    : "0";

                  const categoriesList = item.commonCategories
                    ? item.commonCategories.split(",").map(s => s.trim()).filter(Boolean)
                    : [];

                  return (
                    <article key={`${item.buildingId}-${item.areaName}-${index}`} className="radar-hotspot-item">
                      <div className="radar-hotspot-top-line">
                        <div className="radar-hotspot-identity">
                          <span
                            className={`radar-rank-badge ${
                              rank === 1
                                ? "radar-rank-badge--gold"
                                : rank === 2
                                ? "radar-rank-badge--silver"
                                : rank === 3
                                ? "radar-rank-badge--bronze"
                                : ""
                            }`}
                          >
                            #{rank}
                          </span>
                          <div className="radar-hotspot-names">
                            <strong className="radar-hotspot-primary">
                              {item.buildingName || item.areaName || "Khu vực chưa phân loại"}
                            </strong>
                            {item.buildingName && item.areaName && (
                              <span className="radar-hotspot-secondary">&bull; {item.areaName}</span>
                            )}
                          </div>
                        </div>

                        <div className="radar-hotspot-metrics">
                          <strong className="radar-incident-count">{item.incidentCount} vụ</strong>
                          <span className="radar-incident-pct">({percentage}%)</span>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="radar-progress-track" title={`${item.incidentCount} vụ việc (${percentage}%)`}>
                        <div
                          className={`radar-progress-fill ${
                            rank === 1
                              ? "radar-progress-fill--primary"
                              : rank <= 3
                              ? "radar-progress-fill--secondary"
                              : "radar-progress-fill--muted"
                          }`}
                          style={{ width: `${ratio}%` }}
                        />
                      </div>

                      {/* Common Categories Tags */}
                      {categoriesList.length > 0 && (
                        <div className="radar-hotspot-common-tags">
                          <span className="radar-tags-label">Thường bỏ quên:</span>
                          <div className="radar-tags-wrap">
                            {categoriesList.map((cat, idx) => (
                              <span key={idx} className="radar-tag-pill">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Requirement 3: Category Breakdown */}
        <section className="radar-panel radar-categories-panel">
          <div className="radar-panel-heading">
            <div className="radar-panel-title-group">
              <span className="radar-icon-box radar-icon-box--layers">
                <Layers3 size={20} />
              </span>
              <div>
                <h2>Nhóm đồ mất nhiều nhất</h2>
                <p>Tỷ lệ và số lượng đồ thất lạc phân theo từng danh mục</p>
              </div>
            </div>
            <span className="radar-count-tag">{categories.length} nhóm đồ</span>
          </div>

          <div className="radar-panel-content">
            {categories.length === 0 ? (
              <div className="radar-empty-state">
                <Layers3 size={36} className="radar-empty-icon" />
                <p>Chưa có dữ liệu danh mục thất lạc trong khoảng thời gian đã chọn.</p>
                <small>Hệ thống sẽ tổng hợp khi có các báo cáo đồ thất lạc mới.</small>
              </div>
            ) : (
              <div className="radar-categories-breakdown">
                {/* Spotlight on top category */}
                {categories.length > 0 && (
                  <div className="radar-category-spotlight">
                    <div className="radar-spotlight-header">
                      <Sparkles size={16} className="radar-spotlight-sparkle" />
                      <span>Danh mục bị thất lạc nhiều nhất</span>
                    </div>
                    <div className="radar-spotlight-body">
                      <h3>{categories[0].categoryName}</h3>
                      <div className="radar-spotlight-stat">
                        <strong>{categories[0].lostCount} món</strong>
                        <span>
                          {totalLostItems > 0
                            ? `(${((categories[0].lostCount / totalLostItems) * 100).toFixed(1)}% tổng số)`
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="radar-category-bars-list">
                  {categories.map((cat, index) => {
                    const ratio = Math.min(100, Math.max(4, (cat.lostCount / maxCategoryLost) * 100));
                    const percentage = totalLostItems > 0
                      ? ((cat.lostCount / totalLostItems) * 100).toFixed(1)
                      : "0";

                    return (
                      <div key={cat.categoryId || index} className="radar-cat-bar-item">
                        <div className="radar-cat-bar-header">
                          <div className="radar-cat-name-group">
                            <span className="radar-cat-bullet" />
                            <strong className="radar-cat-title">{cat.categoryName}</strong>
                          </div>
                          <div className="radar-cat-numbers">
                            <span className="radar-cat-count">
                              <strong>{cat.lostCount}</strong> món
                            </span>
                            <span className="radar-cat-share">{percentage}%</span>
                          </div>
                        </div>

                        <div className="radar-cat-track">
                          <div
                            className={`radar-cat-fill radar-cat-fill--c${(index % 5) + 1}`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Action Recommendations Card */}
          <div className="radar-advisory-card">
            <div className="radar-advisory-title">
              <ShieldCheck size={18} />
              <span>Khuyến nghị Vận hành & Tuần tra DVSV</span>
            </div>
            <ul className="radar-advisory-list">
              <li>
                <ChevronRight size={14} />
                <span>
                  Tăng cường giám sát tại <strong>{topHotspotName}</strong> vào các khung giờ cao điểm tan ca.
                </span>
              </li>
              <li>
                <ChevronRight size={14} />
                <span>
                  Phổ biến cảnh báo bảo quản tài sản đối với nhóm{" "}
                  <strong>{categories[0]?.categoryName ?? "Ví tiền & Thiết bị"}</strong> trên bảng tin sinh viên.
                </span>
              </li>
              <li>
                <ChevronRight size={14} />
                <span>
                  Đảm bảo cán bộ trực kho DVSV chủ động đối chiếu đồ tiếp nhận vào kho (Intake) với các cảnh báo điểm nóng.
                </span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function ClockIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default CampusRadarDashboard;
