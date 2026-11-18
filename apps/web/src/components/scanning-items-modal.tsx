import { LoaderCircle, ScanSearch } from "lucide-react";
import { createPortal } from "react-dom";

export interface ScanningItemsModalProps {
  isOpen: boolean;
  type?: "LOST" | "FOUND";
}

export function ScanningItemsModal({ isOpen, type = "LOST" }: ScanningItemsModalProps) {
  if (!isOpen) return null;

  const isLost = type === "LOST";

  return createPortal(
    <div
      className="custody-modal-overlay scanning-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanning-modal-title"
      style={{ zIndex: 9999 }}
    >
      <div
        className="custody-modal scanning-modal-card"
        style={{
          width: "min(100%, 450px)",
          textAlign: "center",
          padding: "2.5rem 1.75rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.35)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="scanning-spinner-wrapper"
          style={{
            position: "relative",
            width: "80px",
            height: "80px",
            margin: "0 auto 0.75rem",
            display: "grid",
            placeItems: "center"
          }}
        >
          <LoaderCircle
            className="is-spinning"
            size={76}
            style={{
              color: isLost ? "#f97316" : "#10b981",
              strokeWidth: 2.2
            }}
          />
          <ScanSearch
            size={32}
            style={{
              position: "absolute",
              color: isLost ? "#ea580c" : "#059669"
            }}
          />
        </div>

        <h2
          id="scanning-modal-title"
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#0f172a",
            margin: 0
          }}
        >
          Hệ thống đang quét các vật phẩm...
        </h2>

        <p
          style={{
            fontSize: "0.925rem",
            color: "#64748b",
            margin: 0,
            lineHeight: 1.55,
            maxWidth: "360px"
          }}
        >
          Đang lưu bài đăng và đối chiếu dữ liệu để tìm các vật phẩm{" "}
          <strong style={{ color: "#334155" }}>
            {isLost ? "nhặt được (FOUND)" : "thất lạc (LOST)"}
          </strong>{" "}
          có đặc điểm tương đồng trong hệ thống.
        </p>

        <div
          style={{
            marginTop: "0.75rem",
            width: "100%",
            maxWidth: "240px",
            height: "4px",
            backgroundColor: "#f1f5f9",
            borderRadius: "9999px",
            overflow: "hidden",
            position: "relative"
          }}
        >
          <div
            className="scanning-status-progress"
            style={{
              width: "50%",
              height: "100%",
              backgroundColor: isLost ? "#f97316" : "#10b981",
              borderRadius: "9999px"
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
