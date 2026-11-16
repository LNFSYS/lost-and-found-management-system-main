import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard,
  ExternalLink,
  Eye,
  Inbox,
  LoaderCircle,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
  X
} from "lucide-react";
import { api, type SensitiveDocumentItem } from "../services/api";

export function SensitiveDocumentsTab() {
  const [items, setItems] = useState<SensitiveDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  async function loadData(query?: string) {
    setLoading(true);
    setError("");
    try {
      const res = await api.listSensitiveDocuments(query);
      setItems(res.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách giấy tờ cá nhân");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    void loadData(search);
  }

  const filteredItems = items.filter((item) => {
    if (filterType === "ALL") return true;
    const docLower = item.documentType.toLowerCase();
    if (filterType === "CCCD") return docLower.includes("căn cước") || docLower.includes("cccd") || docLower.includes("cmnd");
    if (filterType === "STUDENT_CARD") return docLower.includes("thẻ sinh viên") || docLower.includes("student");
    if (filterType === "BANK_CARD") return docLower.includes("thẻ ngân hàng") || docLower.includes("atm") || docLower.includes("visa");
    if (filterType === "DRIVER_LICENSE") return docLower.includes("giấy phép lái xe") || docLower.includes("gplx") || docLower.includes("bằng lái");
    return true;
  });

  function getBadgeStyle(type: string) {
    const t = type.toLowerCase();
    if (t.includes("căn cước") || t.includes("cccd")) {
      return { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5", label: "Căn cước (CCCD / CMND)" };
    }
    if (t.includes("thẻ sinh viên")) {
      return { bg: "#ffedd5", color: "#c2410c", border: "#fdba74", label: "Thẻ sinh viên FPT" };
    }
    if (t.includes("thẻ ngân hàng") || t.includes("atm")) {
      return { bg: "#dcfce7", color: "#15803d", border: "#86efac", label: "Thẻ ATM / Ngân hàng" };
    }
    if (t.includes("giấy phép lái xe") || t.includes("gplx")) {
      return { bg: "#f3e8ff", color: "#7e22ce", border: "#d8b4fe", label: "Bằng lái xe (GPLX)" };
    }
    return { bg: "#e2e8f0", color: "#334155", border: "#cbd5e1", label: "Giấy tờ bảo mật" };
  }

  return (
    <div className="sensitive-docs-tab" style={{ padding: "1.5rem 0" }}>
      {/* Tab Header Banner */}
      <div style={{
        background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
        color: "white",
        borderRadius: "12px",
        padding: "1.5rem 2rem",
        marginBottom: "1.5rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <ShieldAlert size={20} style={{ color: "#93c5fd" }} />
            <span style={{ fontSize: "0.85rem", letterSpacing: "1px", textTransform: "uppercase", color: "#93c5fd", fontWeight: 700 }}>
              PII Vault • Lưu trữ bảo mật thông tin cá nhân
            </span>
          </div>
          <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.5rem", fontWeight: 700 }}>
            Kho Lưu trữ Giấy tờ & Thẻ cá nhân
          </h2>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "#bfdbfe", maxWidth: "700px", lineHeight: 1.5 }}>
            Khu vực dành riêng cho Staff quản lý CCCD, Thẻ sinh viên, Thẻ ngân hàng, GPLX được nhặt trên campus.
            Hệ thống AI DINOv2 tự động ẩn các bài này khỏi Bảng tin chung để bảo vệ dữ liệu cá nhân của sinh viên.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData(search)}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            backgroundColor: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            color: "white",
            padding: "0.6rem 1.2rem",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem"
          }}
        >
          <RefreshCw size={16} className={loading ? "spin-icon" : ""} />
          Làm mới
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        marginBottom: "1.5rem",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        {/* Category Pills */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {[
            { key: "ALL", label: "Tất cả" },
            { key: "CCCD", label: "Căn cước / CMND" },
            { key: "STUDENT_CARD", label: "Thẻ sinh viên" },
            { key: "BANK_CARD", label: "Thẻ ngân hàng" },
            { key: "DRIVER_LICENSE", label: "GPLX / Bằng lái" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterType(tab.key)}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "20px",
                border: filterType === tab.key ? "1px solid #2563eb" : "1px solid #e2e8f0",
                backgroundColor: filterType === tab.key ? "#2563eb" : "#ffffff",
                color: filterType === tab.key ? "#ffffff" : "#475569",
                fontWeight: filterType === tab.key ? 700 : 500,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.5rem" }}>
          <div style={{ position: "relative", minWidth: "260px" }}>
            <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Tìm theo tên, MSSV, ghi chú..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem 0.5rem 2.25rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem"
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              backgroundColor: "#f1f5f9",
              border: "1px solid #cbd5e1",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer"
            }}
          >
            Tìm
          </button>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "8px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#64748b" }}>
          <LoaderCircle size={32} className="spin-icon" style={{ margin: "0 auto 1rem auto" }} />
          <p>Đang tải danh sách hồ sơ giấy tờ bảo mật...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredItems.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "4rem 2rem",
          backgroundColor: "#f8fafc",
          borderRadius: "12px",
          border: "2px dashed #cbd5e1"
        }}>
          <Inbox size={48} style={{ color: "#94a3b8", marginBottom: "1rem" }} />
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#334155" }}>Không có giấy tờ cá nhân nào</h3>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
            Hiện chưa có CCCD, Thẻ SV hay thẻ ngân hàng nào được ghi nhận trong danh sách này.
          </p>
        </div>
      )}

      {/* Cards Grid */}
      {!loading && filteredItems.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: "1.25rem"
        }}>
          {filteredItems.map((item) => {
            const badge = getBadgeStyle(item.documentType);
            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  {/* Top: Badges */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                    <span style={{
                      backgroundColor: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: "6px"
                    }}>
                      {badge.label}
                    </span>
                    <span style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: item.status === "RESOLVED" ? "#16a34a" : "#2563eb",
                      backgroundColor: item.status === "RESOLVED" ? "#dcfce7" : "#eff6ff",
                      padding: "2px 8px",
                      borderRadius: "4px"
                    }}>
                      {item.status === "RESOLVED" ? "Đã trả lại" : "Đang lưu giữ"}
                    </span>
                  </div>

                  {/* Thumbnail & Title */}
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}>
                    {item.mediaUrl ? (
                      <div
                        style={{
                          width: "80px",
                          height: "80px",
                          borderRadius: "8px",
                          overflow: "hidden",
                          position: "relative",
                          flexShrink: 0,
                          cursor: "pointer",
                          border: "1px solid #e2e8f0"
                        }}
                        onClick={() => setPreviewImage({ url: item.mediaUrl!, title: item.title })}
                        title="Click để phóng to ảnh"
                      >
                        <img
                          src={item.mediaUrl}
                          alt={item.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <div style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: "rgba(0,0,0,0.5)",
                          color: "white",
                          textAlign: "center",
                          fontSize: "0.65rem",
                          padding: "2px 0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "2px"
                        }}>
                          <Eye size={10} /> Phóng to
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "8px",
                        backgroundColor: "#f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#94a3b8",
                        flexShrink: 0
                      }}>
                        <CreditCard size={28} />
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: "0 0 0.35rem 0", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                        {item.title}
                      </h4>
                      <p style={{
                        margin: 0,
                        fontSize: "0.85rem",
                        color: "#64748b",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        lineHeight: 1.4
                      }}>
                        {item.description || "Không có mô tả chi tiết."}
                      </p>
                    </div>
                  </div>

                  {/* Metadata: Người nộp & Vị trí */}
                  <div style={{
                    backgroundColor: "#f8fafc",
                    borderRadius: "8px",
                    padding: "0.75rem",
                    fontSize: "0.825rem",
                    color: "#475569",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                    marginBottom: "1rem"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <User size={14} style={{ color: "#64748b" }} />
                      <span>Người giao nộp: <strong>{item.ownerName}</strong> ({item.ownerEmail || "Không có email"})</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <MapPin size={14} style={{ color: "#64748b" }} />
                      <span>Vị trí: {[item.buildingName, item.roomText, item.areaName, item.customLocation].filter(Boolean).join(" · ") || "Chưa xác định"}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{
                  display: "flex",
                  gap: "0.5rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid #f1f5f9"
                }}>
                  {item.ownerEmail && (
                    <a
                      href={`mailto:${item.ownerEmail}?subject=[FPTU Lost & Found] Thông báo tiếp nhận ${encodeURIComponent(item.documentType)}&body=Chào bạn, Phòng Dịch vụ Sinh viên (DVSV) Đại học FPT thông báo đã tiếp nhận ${encodeURIComponent(item.documentType)} mang tên bạn. Vui lòng mang giấy tờ liên quan đến quầy DVSV để nhận lại.`}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.35rem",
                        padding: "0.45rem",
                        backgroundColor: "#2563eb",
                        color: "white",
                        borderRadius: "6px",
                        fontSize: "0.825rem",
                        fontWeight: 600,
                        textDecoration: "none"
                      }}
                    >
                      <Mail size={14} /> Gửi email
                    </a>
                  )}
                  <Link
                    to={`/posts/${item.id}/matches`}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      padding: "0.45rem",
                      backgroundColor: "#f1f5f9",
                      color: "#334155",
                      borderRadius: "6px",
                      fontSize: "0.825rem",
                      fontWeight: 600,
                      textDecoration: "none",
                      border: "1px solid #cbd5e1"
                    }}
                  >
                    <ExternalLink size={14} /> Đối soát
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}
          onClick={() => setPreviewImage(null)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "1rem",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              position: "relative"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h4 style={{ margin: 0, fontSize: "1.1rem" }}>{previewImage.title}</h4>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ overflow: "auto", textAlign: "center" }}>
              <img
                src={previewImage.url}
                alt={previewImage.title}
                style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: "8px" }}
              />
            </div>
            <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.8rem", color: "#64748b", textAlign: "center" }}>
              ⚠️ Thông tin bảo mật nội bộ Staff. Không chụp màn hình chia sẻ ra ngoài.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
