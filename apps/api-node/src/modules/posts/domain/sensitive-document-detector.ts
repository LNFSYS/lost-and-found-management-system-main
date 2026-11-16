export interface SensitiveDetectionResult {
  isSensitive: boolean;
  documentType: string | null;
  sensitiveReason: string | null;
}

const SENSITIVE_KEYWORDS: Record<string, string[]> = {
  CCCD: ["cccd", "căn cước", "can cuoc", "cmnd", "chứng minh", "chung minh", "identity card", "id card"],
  STUDENT_CARD: ["thẻ sinh viên", "the sinh vien", "thẻ sv", "the sv", "thẻ fpt", "student card", "mssv"],
  DRIVER_LICENSE: ["gplx", "giấy phép lái xe", "giay phep lai xe", "bằng lái", "bang lai", "driver license"],
  BANK_CARD: ["thẻ ngân hàng", "the ngan hang", "thẻ atm", "the atm", "vietcombank", "tpbank", "techcombank", "mb bank", "mbbank", "bidv", "agribank", "vpbank", "visa", "mastercard"],
  PERSONAL_DOCUMENT: ["hộ chiếu", "passport", "cà vẹt", "ca vet", "đăng ký xe", "dang ky xe", "bảo hiểm y tế", "bhyt"]
};

const DOC_NAME_MAP: Record<string, string> = {
  CCCD: "Căn cước công dân (CCCD / CMND)",
  STUDENT_CARD: "Thẻ sinh viên (Student ID Card)",
  DRIVER_LICENSE: "Giấy phép lái xe (GPLX)",
  BANK_CARD: "Thẻ ngân hàng (ATM / Visa / Mastercard)",
  PERSONAL_DOCUMENT: "Giấy tờ cá nhân bảo mật"
};

export function detectSensitiveDocumentType(text: string): SensitiveDetectionResult {
  const lower = (text || "").toLowerCase();
  for (const [key, keywords] of Object.entries(SENSITIVE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      const docName = DOC_NAME_MAP[key] || "Giấy tờ tùy thân bảo mật";
      return {
        isSensitive: true,
        documentType: docName,
        sensitiveReason: `Phát hiện ${docName} chứa thông tin cá nhân/bảo mật. Đã chuyển hồ sơ về mục Lưu trữ Giấy tờ cá nhân của Staff để bảo vệ quyền riêng tư, không công khai đối soát ra ngoài.`
      };
    }
  }
  return { isSensitive: false, documentType: null, sensitiveReason: null };
}
