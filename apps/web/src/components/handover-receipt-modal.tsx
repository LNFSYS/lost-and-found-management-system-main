import { useRef } from "react";
import { Printer, X, FileText } from "lucide-react";
import { useModalFocus } from "../hooks/use-modal-focus";
import "./receipt-document.css";

export interface HandoverReceiptItem {
  id: string;
  itemName: string;
  category?: { name: string | null } | null;
  conditionNotes?: string | null;
  description?: string | null;
  storageCode?: string | null;
  handoverPoint?: { name: string | null; address: string | null } | null;
  receivedQuantity?: number | null;
  accessories?: string | null;
  receivedAt?: string | null;
}

export interface HandoverRecipientInfo {
  fullName: string;
  phoneNumber: string;
  identityNumber: string; // MSSV or CCCD
}

export interface HandoverStaffInfo {
  fullName: string;
  title?: string;
}

export interface HandoverReceiptModalProps {
  item: HandoverReceiptItem;
  recipient: HandoverRecipientInfo;
  staff?: HandoverStaffInfo;
  handoverDate?: string | Date | null;
  note?: string | null;
  onClose: () => void;
}

function extractCity(addressOrName?: string | null): string {
  if (!addressOrName) return "Hà Nội";
  if (/đà nẵng/i.test(addressOrName)) return "Đà Nẵng";
  if (/hồ chí minh|tp\.?hcm|quận 9|thủ đức/i.test(addressOrName)) return "TP. Hồ Chí Minh";
  if (/quy nhơn/i.test(addressOrName)) return "Quy Nhơn";
  if (/cần thơ/i.test(addressOrName)) return "Cần Thơ";
  return "Hà Nội";
}

function formatAdministrativeDate(dateInput?: string | Date | null, location = "Hà Nội") {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) {
    return `${location}, ngày ... tháng ... năm ...`;
  }
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${location}, ngày ${day} tháng ${month} năm ${year}`;
}

function formatAdministrativeTime(dateInput?: string | Date | null) {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) {
    return ".... giờ .... phút, ngày ..../..../........";
  }
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${hours} giờ ${minutes} phút, ngày ${day} tháng ${month} năm ${year}`;
}

export function HandoverReceiptModal({
  item,
  recipient,
  staff = { fullName: "Cán bộ Phòng Dịch vụ Sinh viên", title: "Cán bộ DVSV" },
  handoverDate,
  note,
  onClose
}: HandoverReceiptModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(modalRef, true, onClose);

  const city = extractCity(item.handoverPoint?.address || item.handoverPoint?.name);
  const locationLine = formatAdministrativeDate(handoverDate, city);
  const timeFormatted = formatAdministrativeTime(handoverDate);
  const docNumber = `BG-${(item.storageCode || item.id.slice(0, 8)).toUpperCase()}`;

  function handlePrint() {
    window.print();
  }

  return (
    <div
      className="receipt-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Floating Action Toolbar */}
      <div className="receipt-toolbar receipt-no-print">
        <div className="receipt-toolbar__info">
          <FileText size={20} color="#0284c7" />
          <span>Biên bản bàn giao tài sản thất lạc</span>
          <span className="receipt-toolbar__badge">Khổ A4</span>
        </div>
        <div className="receipt-toolbar__actions">
          <button
            type="button"
            className="receipt-btn-print"
            onClick={handlePrint}
            title="In văn bản (Ctrl+P)"
          >
            <Printer size={18} />
            <span>In biên bản</span>
          </button>
          <button
            type="button"
            className="receipt-btn-close"
            onClick={onClose}
            aria-label="Đóng xem trước"
          >
            <X size={18} />
            <span>Đóng</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="receipt-printable-container">
        <div
          ref={modalRef}
          className="receipt-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Biên bản bàn giao tài sản thất lạc"
          tabIndex={-1}
        >
          {/* Header */}
          <div className="receipt-header">
            <div className="receipt-header-left">
              <div className="receipt-org-title">TRƯỜNG ĐẠI HỌC FPT</div>
              <div className="receipt-dept-title">PHÒNG DỊCH VỤ SINH VIÊN (DVSV)</div>
              <div className="receipt-header-divider" />
              <div className="receipt-doc-number">Số: {docNumber}</div>
            </div>

            <div className="receipt-header-right">
              <div className="receipt-national-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div className="receipt-national-motto">Độc lập - Tự do - Hạnh phúc</div>
              <div className="receipt-national-divider" />
              <div className="receipt-date-location">{locationLine}</div>
            </div>
          </div>

          {/* Title */}
          <div className="receipt-title-block">
            <h1 className="receipt-title">BIÊN BẢN BÀN GIAO TÀI SẢN THẤT LẠC</h1>
            <p className="receipt-subtitle">
              (V/v: Bàn giao, hoàn trả tài sản thất lạc cho chủ sở hữu hợp pháp)
            </p>
          </div>

          {/* Opening Paragraph */}
          <p className="receipt-intro">
            Hôm nay, vào hồi {timeFormatted}, tại {item.handoverPoint?.name || "Văn phòng Dịch vụ Sinh viên"}{item.handoverPoint?.address ? ` (${item.handoverPoint.address})` : ""}, chúng tôi gồm có:
          </p>

          {/* Parties Section */}
          <div className="receipt-section">
            <div className="receipt-section-title">I. CÁC BÊN THAM GIA BÀN GIAO</div>

            <div className="receipt-party-box">
              <div className="receipt-party-title">1. ĐẠI DIỆN BÊN BÀN GIAO (BÊN A - PHÒNG DVSV):</div>
              <div className="receipt-info-grid">
                <div className="receipt-info-row">
                  <span className="receipt-label">- Ông/Bà:</span>
                  <span className="receipt-value">{staff.fullName}</span>
                </div>
                <div className="receipt-info-row">
                  <span className="receipt-label">- Chức vụ:</span>
                  <span className="receipt-value">{staff.title || "Cán bộ Phòng Dịch vụ Sinh viên"}</span>
                </div>
                <div className="receipt-info-row receipt-info-row--full">
                  <span className="receipt-label">- Đơn vị:</span>
                  <span className="receipt-value">Phòng Dịch vụ Sinh viên (DVSV) - Trường Đại học FPT</span>
                </div>
              </div>
            </div>

            <div className="receipt-party-box">
              <div className="receipt-party-title">2. ĐẠI DIỆN BÊN NHẬN TÀI SẢN (BÊN B - NGƯỜI NHẬN):</div>
              <div className="receipt-info-grid">
                <div className="receipt-info-row">
                  <span className="receipt-label">- Họ và tên:</span>
                  <span className="receipt-value">{recipient.fullName || "............................................................"}</span>
                </div>
                <div className="receipt-info-row">
                  <span className="receipt-label">- Số ĐT:</span>
                  <span className="receipt-value">{recipient.phoneNumber || "............................................................"}</span>
                </div>
                <div className="receipt-info-row receipt-info-row--full">
                  <span className="receipt-label">- MSSV / CCCD / CMND:</span>
                  <span className="receipt-value">{recipient.identityNumber || "............................................................"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Handover Item Details */}
          <div className="receipt-section">
            <div className="receipt-section-title">II. THÔNG TIN CHI TIẾT TÀI SẢN BÀN GIAO</div>
            <table className="receipt-table">
              <tbody>
                <tr>
                  <td className="receipt-table-label">Mã hồ sơ tiếp nhận</td>
                  <td>
                    <span className="receipt-badge-code">{item.id}</span>
                  </td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Mã vị trí lưu kho</td>
                  <td>
                    <span className="receipt-badge-code">{item.storageCode || "Lưu kho tạm quầy DVSV"}</span>
                  </td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Tên tài sản</td>
                  <td><strong>{item.itemName}</strong></td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Danh mục tài sản</td>
                  <td>{item.category?.name || "Chưa phân loại"}</td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Số lượng bàn giao</td>
                  <td>{item.receivedQuantity ?? 1} món</td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Phụ kiện kèm theo</td>
                  <td>{item.accessories || "Không có phụ kiện kèm theo"}</td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Tình trạng ngoại quan bàn giao</td>
                  <td>{item.conditionNotes || item.description || "Nguyên trạng như khi tiếp nhận tại kho"}</td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Địa điểm lưu & bàn giao</td>
                  <td>{item.handoverPoint?.name || "Điểm giao nhận DVSV"} {item.handoverPoint?.address ? `(${item.handoverPoint.address})` : ""}</td>
                </tr>
                {note && (
                  <tr>
                    <td className="receipt-table-label">Ghi chú bàn giao</td>
                    <td>{note}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Terms and Non-Dispute Commitment */}
          <div className="receipt-section">
            <div className="receipt-section-title">III. ĐIỀU KHOẢN CAM KẾT VÀ XÁC NHẬN</div>
            <div className="receipt-terms">
              <p>
                Hai bên đã cùng nhau kiểm tra, đối chiếu thực tế và thống nhất bàn giao tài sản với các nội dung cam kết sau đây:
              </p>
              <p>
                <strong>1. Xác nhận nhận đủ tài sản:</strong> Bên B (Người nhận) xác nhận đã kiểm tra kỹ lưỡng, đối chiếu thông tin và nhận lại đúng, đủ toàn bộ tài sản nêu trên cùng phụ kiện kèm theo đúng với tình trạng nguyên vẹn được ghi nhận tại thời điểm bàn giao, không phát sinh bất kỳ hư hỏng, thiếu hụt hay mất mát nào.
              </p>
              <p>
                <strong>2. Trách nhiệm pháp lý:</strong> Bên B cam kết chịu hoàn toàn trách nhiệm trước pháp luật về tính chính xác, trung thực của các thông tin cá nhân đã cung cấp và quyền sở hữu hợp pháp đối với tài sản được nhận lại.
              </p>
              <p>
                <strong>3. Cam kết không khiếu nại:</strong> Bên B cam đoan và cam kết không có bất kỳ khiếu nại, khiếu kiện hay tranh chấp nào liên quan đến tài sản này đối với Bên A (Cán bộ phụ trách, Phòng Dịch vụ Sinh viên và Trường Đại học FPT) sau khi đã ký tên nhận bàn giao tài sản.
              </p>
              <p>
                Biên bản được lập thành 02 (hai) bản có giá trị pháp lý như nhau, Bên A giữ 01 bản lưu trữ hồ sơ, Bên B giữ 01 bản để theo dõi. Biên bản có hiệu lực kể từ thời điểm hai bên ký tên xác nhận.
              </p>
            </div>
          </div>

          {/* Signatures */}
          <div className="receipt-signatures">
            <div className="receipt-signature-col">
              <div className="receipt-signature-role">NGƯỜI NHẬN TÀI SẢN</div>
              <div className="receipt-signature-guide">(Ký và ghi rõ họ tên)</div>
              <div className="receipt-signature-space" />
              <div className="receipt-signature-name">{recipient.fullName || "................................................"}</div>
            </div>

            <div className="receipt-signature-col">
              <div className="receipt-signature-role">CÁN BỘ BÀN GIAO</div>
              <div className="receipt-signature-guide">(Ký và ghi rõ họ tên)</div>
              <div className="receipt-signature-space" />
              <div className="receipt-signature-name">{staff.fullName}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
