import { useRef } from "react";
import { Printer, X, FileText } from "lucide-react";
import { useModalFocus } from "../hooks/use-modal-focus";
import "./receipt-document.css";

export interface IntakeReceiptItem {
  id?: string;
  itemName: string;
  category?: { name: string | null } | null;
  description?: string | null;
  conditionNotes?: string | null;
  storageCode?: string | null;
  handoverPoint?: { name: string | null; address: string | null } | null;
  location?: {
    area?: { name: string | null } | null;
    building?: { name: string | null } | null;
    roomText?: string | null;
  } | null;
  receivedQuantity?: number | null;
  accessories?: string | null;
  receivedAt?: string | Date | null;
}

export interface IntakeFinderInfo {
  name?: string | null;
  contact?: string | null;
  identityNumber?: string | null;
  sourceType?: string | null;
}

export interface IntakeStaffInfo {
  fullName: string;
  title?: string;
}

export interface IntakeReceiptModalProps {
  item: IntakeReceiptItem;
  finder?: IntakeFinderInfo;
  staff?: IntakeStaffInfo;
  intakeDate?: string | Date | null;
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

export function IntakeReceiptModal({
  item,
  finder,
  staff = { fullName: "Cán bộ Phòng Dịch vụ Sinh viên", title: "Cán bộ tiếp nhận kho" },
  intakeDate,
  note,
  onClose
}: IntakeReceiptModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(modalRef, true, onClose);

  const effectiveDate = intakeDate || item.receivedAt || new Date();
  const city = extractCity(item.handoverPoint?.address || item.handoverPoint?.name);
  const locationLine = formatAdministrativeDate(effectiveDate, city);
  const timeFormatted = formatAdministrativeTime(effectiveDate);
  const docNumber = `TN-${(item.storageCode || (item.id ? item.id.slice(0, 8) : "MOI")).toUpperCase()}`;

  const locationFound = [
    item.location?.area?.name,
    item.location?.building?.name,
    item.location?.roomText
  ].filter(Boolean).join(" - ") || "Khuôn viên Trường Đại học FPT";

  const finderDisplayName = finder?.name?.trim() || "Tiếp nhận Walk-in (Tại quầy)";
  const finderContact = finder?.contact?.trim() || "Chưa cung cấp";

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
      {/* Action Toolbar */}
      <div className="receipt-toolbar receipt-no-print">
        <div className="receipt-toolbar__info">
          <FileText size={20} color="#0284c7" />
          <span>Biên bản tiếp nhận tài sản vào kho</span>
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
            <span>In phiếu tiếp nhận kho</span>
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
          aria-label="Biên bản tiếp nhận tài sản vào kho lưu trữ"
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
            <h1 className="receipt-title">BIÊN BẢN TIẾP NHẬN TÀI SẢN VÀO KHO LƯU TRỮ</h1>
            <p className="receipt-subtitle">
              (V/v: Tiếp nhận, kiểm tra ngoại quan và lưu giữ tài sản thất lạc)
            </p>
          </div>

          {/* Opening Paragraph */}
          <p className="receipt-intro">
            Hôm nay, vào hồi {timeFormatted}, tại {item.handoverPoint?.name || "Văn phòng Dịch vụ Sinh viên"}{item.handoverPoint?.address ? ` (${item.handoverPoint.address})` : ""}, chúng tôi gồm có:
          </p>

          {/* Parties Section */}
          <div className="receipt-section">
            <div className="receipt-section-title">I. THÀNH PHẦN THAM GIA TIẾP NHẬN</div>

            <div className="receipt-party-box">
              <div className="receipt-party-title">1. BÊN GIAO NỘP / BÀN GIAO (BÊN GIAO):</div>
              <div className="receipt-info-grid">
                <div className="receipt-info-row">
                  <span className="receipt-label">- Họ và tên:</span>
                  <span className="receipt-value">{finderDisplayName}</span>
                </div>
                <div className="receipt-info-row">
                  <span className="receipt-label">- Số ĐT / Liên hệ:</span>
                  <span className="receipt-value">{finderContact}</span>
                </div>
                <div className="receipt-info-row receipt-info-row--full">
                  <span className="receipt-label">- Hình thức tiếp nhận:</span>
                  <span className="receipt-value">{finder?.sourceType || "Tiếp nhận trực tiếp tại quầy DVSV (Walk-in)"}</span>
                </div>
              </div>
            </div>

            <div className="receipt-party-box">
              <div className="receipt-party-title">2. ĐẠI DIỆN BÊN TIẾP NHẬN KHO (BÊN NHẬN - PHÒNG DVSV):</div>
              <div className="receipt-info-grid">
                <div className="receipt-info-row">
                  <span className="receipt-label">- Họ và tên cán bộ:</span>
                  <span className="receipt-value">{staff.fullName}</span>
                </div>
                <div className="receipt-info-row">
                  <span className="receipt-label">- Chức vụ:</span>
                  <span className="receipt-value">{staff.title || "Cán bộ tiếp nhận kho DVSV"}</span>
                </div>
                <div className="receipt-info-row receipt-info-row--full">
                  <span className="receipt-label">- Đơn vị:</span>
                  <span className="receipt-value">Phòng Dịch vụ Sinh viên (DVSV) - Trường Đại học FPT</span>
                </div>
              </div>
            </div>
          </div>

          {/* Item Details Table */}
          <div className="receipt-section">
            <div className="receipt-section-title">II. NỘI DUNG TÀI SẢN TIẾP NHẬN VÀO KHO</div>
            <table className="receipt-table">
              <tbody>
                <tr>
                  <td className="receipt-table-label">Mã lưu kho (storageCode)</td>
                  <td>
                    <span className="receipt-badge-code">{item.storageCode || "Chờ gắn mã kho"}</span>
                  </td>
                </tr>
                {item.id && (
                  <tr>
                    <td className="receipt-table-label">Mã hồ sơ hệ thống</td>
                    <td>
                      <span className="receipt-badge-code">{item.id}</span>
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="receipt-table-label">Tên món đồ / tài sản</td>
                  <td><strong>{item.itemName}</strong></td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Danh mục phân loại</td>
                  <td>{item.category?.name || "Chưa phân loại"}</td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Số lượng thực nhận</td>
                  <td>{item.receivedQuantity ?? 1} món</td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Phụ kiện kèm theo</td>
                  <td>{item.accessories || "Không có phụ kiện kèm theo"}</td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Vị trí nhặt được</td>
                  <td>{locationFound}</td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Kết quả kiểm tra ngoại quan</td>
                  <td>{item.conditionNotes || item.description || "Đã đối chiếu, ghi nhận tình trạng thực tế tại quầy"}</td>
                </tr>
                <tr>
                  <td className="receipt-table-label">Điểm tiếp nhận & lưu kho</td>
                  <td>{item.handoverPoint?.name || "Kho Phòng Dịch vụ Sinh viên"} {item.handoverPoint?.address ? `(${item.handoverPoint.address})` : ""}</td>
                </tr>
                {note && (
                  <tr>
                    <td className="receipt-table-label">Ghi chú bổ sung</td>
                    <td>{note}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Terms and Confirmation */}
          <div className="receipt-section">
            <div className="receipt-section-title">III. CAM KẾT VÀ XÁC NHẬN THÔNG TIN</div>
            <div className="receipt-terms">
              <p>
                Hai bên đã cùng nhau kiểm tra, xác nhận và cam kết tuân thủ các điều khoản sau:
              </p>
              <p>
                <strong>1. Xác nhận hiện trạng:</strong> Hai bên xác nhận toàn bộ số lượng, hiện trạng ngoại quan và đặc điểm nhận dạng của tài sản được ghi nhận trung thực, chính xác tại thời điểm bàn giao vào kho lưu trữ của Phòng Dịch vụ Sinh viên.
              </p>
              <p>
                <strong>2. Trách nhiệm lưu trữ và bảo quản:</strong> Phòng Dịch vụ Sinh viên có trách nhiệm niêm yết thông tin công khai trên hệ thống Cổng thông tin Thất lạc - Tìm kiếm FPTU, quản lý và bảo quản tài sản an toàn theo Quy chế Quản lý Tài sản Thất lạc của Trường Đại học FPT cho đến khi hoàn trả cho chủ sở hữu hoặc hết thời hạn lưu trữ theo quy định.
              </p>
              <p>
                <strong>3. Tính trung thực:</strong> Bên giao nộp cam kết cung cấp đúng và đầy đủ thông tin về việc nhặt được tài sản trong khuôn viên trường và đồng ý bàn giao để Nhà trường hỗ trợ tìm kiếm chủ sở hữu.
              </p>
              <p>
                Biên bản được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để theo dõi, đối chiếu.
              </p>
            </div>
          </div>

          {/* Signatures */}
          <div className="receipt-signatures">
            <div className="receipt-signature-col">
              <div className="receipt-signature-role">NGƯỜI GIAO NỘP / BÀN GIAO</div>
              <div className="receipt-signature-guide">(Ký và ghi rõ họ tên)</div>
              <div className="receipt-signature-space" />
              <div className="receipt-signature-name">{finderDisplayName}</div>
            </div>

            <div className="receipt-signature-col">
              <div className="receipt-signature-role">CÁN BỘ TIẾP NHẬN KHO</div>
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
