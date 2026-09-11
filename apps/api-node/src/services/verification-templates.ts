import { normalizeVietnameseText } from "../utils/text.js";

export type VerificationQuestionType = "TEXT" | "MULTIPLE_CHOICE" | "VISUAL_DETAIL";

export interface VerificationPrompt {
  key: string;
  prompt: string;
  questionType: VerificationQuestionType;
  options?: string[];
}

export interface VerificationTemplate {
  id: string;
  version: number;
  category: string;
  minimumAnswers: number;
  prompts: VerificationPrompt[];
}

const common = [
  { key: "context", prompt: "Bạn nhớ đã nhìn thấy hoặc sử dụng vật phẩm này ở đâu và vào khoảng thời gian nào?", questionType: "TEXT" as const },
  { key: "unique_mark", prompt: "Hãy mô tả một dấu hiệu riêng tư trên vật phẩm mà bạn chưa đăng công khai.", questionType: "VISUAL_DETAIL" as const }
];

export const verificationTemplates: VerificationTemplate[] = [
  {
    id: "electronics-ownership",
    version: 1,
    category: "electronics",
    minimumAnswers: 1,
    prompts: [
      { key: "accessory", prompt: "Vật phẩm có phụ kiện, ốp, tem hoặc dấu xước riêng nào không? Hãy mô tả mà không gửi mã đầy đủ.", questionType: "VISUAL_DETAIL" },
      { key: "device_detail", prompt: "Hãy mô tả một chi tiết chỉ chủ sở hữu thường biết về thiết bị này (không gửi mật khẩu, OTP hoặc số serial đầy đủ).", questionType: "TEXT" },
      ...common
    ]
  },
  {
    id: "documents-ownership",
    version: 1,
    category: "documents",
    minimumAnswers: 1,
    prompts: [
      { key: "document_context", prompt: "Đây là loại giấy tờ nào và bạn thường dùng nó trong bối cảnh nào? Không gửi số giấy tờ đầy đủ.", questionType: "TEXT" },
      { key: "redacted_detail", prompt: "Hãy mô tả một chi tiết riêng tư đã được che bớt trên giấy tờ, không gửi ảnh hoặc số đầy đủ.", questionType: "VISUAL_DETAIL" },
      ...common
    ]
  },
  {
    id: "wallet-card-ownership",
    version: 1,
    category: "wallet-card",
    minimumAnswers: 1,
    prompts: [
      { key: "contents", prompt: "Bên trong ví hoặc bao đựng có nhóm vật dụng nào mà bạn có thể mô tả an toàn? Không gửi số thẻ hoặc thông tin tài chính.", questionType: "TEXT" },
      { key: "material_mark", prompt: "Hãy mô tả chất liệu, màu sắc hoặc dấu hiệu riêng tư của ví/thẻ mà bạn chưa công khai.", questionType: "VISUAL_DETAIL" },
      ...common
    ]
  },
  {
    id: "keys-bag-ownership",
    version: 1,
    category: "keys-bag",
    minimumAnswers: 1,
    prompts: [
      { key: "shape_count", prompt: "Hãy mô tả hình dáng, số lượng chìa khóa hoặc ngăn/phụ kiện đi kèm mà chỉ chủ sở hữu thường biết.", questionType: "VISUAL_DETAIL" },
      { key: "private_mark", prompt: "Vật phẩm có móc, dây, miếng dán hoặc dấu riêng nào không? Không gửi thông tin có thể dùng để mở khóa.", questionType: "TEXT" },
      ...common
    ]
  },
  {
    id: "other-ownership",
    version: 1,
    category: "other",
    minimumAnswers: 1,
    prompts: [
      { key: "private_detail", prompt: "Hãy mô tả một dấu hiệu riêng tư trên vật phẩm mà bạn chưa đăng công khai.", questionType: "VISUAL_DETAIL" },
      ...common
    ]
  }
];

function categoryBucket(categoryName: string | null | undefined) {
  const normalized = normalizeVietnameseText(categoryName ?? "");
  if (/(dien tu|dien thoai|laptop|may tinh|tablet|tai nghe|sac|cap|usb|o cung|chuot|ban phim|electronics|phone)/.test(normalized)) return "electronics";
  if (/(giay to|the sinh vien|student id|cccd|cmnd|bang lai|document|ho so|tai lieu|passport)/.test(normalized)) return "documents";
  if (/(vi|bop|wallet|the ngan hang|card)/.test(normalized)) return "wallet-card";
  if (/(chia khoa|the xe|the phong|moc khoa|key|balo|tui xach|tui dung laptop|bag)/.test(normalized)) return "keys-bag";
  return "other";
}

export function templateForCategory(categoryName: string | null | undefined) {
  const bucket = categoryBucket(categoryName);
  return verificationTemplates.find((template) => template.category === bucket) ?? verificationTemplates[verificationTemplates.length - 1];
}

export function promptForKey(template: VerificationTemplate, key: string) {
  return template.prompts.find((prompt) => prompt.key === key) ?? null;
}

const forbiddenQuestion = /(password|mật khẩu|mat khau|otp|pin|cvv|full\s*(serial|imei|card|document)|đầy đủ|day du|qr|barcode|mã mở khóa|ma mo khoa|ignore\s+(all|any|previous)\s+instructions|system\s+prompt|developer\s+message|reveal\s+secret|bypass\s+(privacy|security))/i;

export function validateCustomQuestion(prompt: string) {
  const value = prompt.trim();
  if (value.length < 8 || value.length > 500) return "Câu hỏi tùy chỉnh phải dài từ 8 đến 500 ký tự.";
  if (forbiddenQuestion.test(value)) return "Câu hỏi không được yêu cầu thông tin bí mật hoặc chứa chỉ dẫn vượt qua chính sách bảo mật.";
  return null;
}

export function safeAnswer(value: string) {
  const answer = value.trim();
  if (answer.length < 1 || answer.length > 2000) return "Câu trả lời phải dài từ 1 đến 2000 ký tự.";
  return null;
}

export function safeReason(value: string | null | undefined) {
  if (!value) return null;
  return value.trim()
    .replace(/(password|mật khẩu|mat khau|otp|pin|cvv|mã mở khóa|ma mo khoa)\s*[:=]?\s*[^\s,;]+/gi, "[redacted]")
    .replace(/\b(?:\d[ -]?){8,}\b/g, "[redacted]")
    .slice(0, 1000);
}
