export type VerificationQuestionType = "TEXT" | "MASKED_SERIAL" | "MULTIPLE_CHOICE" | "VISUAL_DETAIL";
export type VerificationPrivacyLevel = "PRIVATE" | "HIGHLY_PRIVATE";

export interface VerificationPromptTemplate {
  key: string;
  prompt: string;
  questionType: VerificationQuestionType;
  privacyLevel: VerificationPrivacyLevel;
}

export interface VerificationQuestionTemplate {
  id: string;
  version: number;
  categoryNames: readonly string[];
  minimumAnswers: number;
  prompts: readonly VerificationPromptTemplate[];
}

const templates = [
  {
    id: "student-document",
    version: 1,
    categoryNames: ["the sinh vien", "cccd / cmnd", "bang lai xe", "giay to xe", "ho so / tai lieu", "giay to ca nhan"],
    minimumAnswers: 1,
    prompts: [
      { key: "issuing-context", prompt: "Giấy tờ do đơn vị nào cấp hoặc được dùng trong bối cảnh nào?", questionType: "TEXT", privacyLevel: "PRIVATE" },
      { key: "redacted-mark", prompt: "Hãy mô tả một đặc điểm không công khai, không ghi toàn bộ mã số trên giấy tờ.", questionType: "MASKED_SERIAL", privacyLevel: "HIGHLY_PRIVATE" },
      { key: "cover-condition", prompt: "Giấy tờ có vỏ bọc, dấu vết hoặc tình trạng riêng nào?", questionType: "VISUAL_DETAIL", privacyLevel: "PRIVATE" }
    ]
  },
  {
    id: "payment-card",
    version: 1,
    categoryNames: ["the ngan hang"],
    minimumAnswers: 1,
    prompts: [
      { key: "issuer-card-type", prompt: "Thẻ thuộc ngân hàng hoặc loại thẻ nào? Không cung cấp toàn bộ số thẻ.", questionType: "TEXT", privacyLevel: "HIGHLY_PRIVATE" },
      { key: "masked-card-detail", prompt: "Cung cấp tối đa bốn số cuối hoặc một chi tiết đã che bớt trên thẻ.", questionType: "MASKED_SERIAL", privacyLevel: "HIGHLY_PRIVATE" },
      { key: "card-condition", prompt: "Thẻ có vết xước, hình dán hoặc dấu hiệu riêng nào?", questionType: "VISUAL_DETAIL", privacyLevel: "PRIVATE" }
    ]
  },
  {
    id: "phone-device",
    version: 1,
    categoryNames: ["dien thoai"],
    minimumAnswers: 1,
    prompts: [
      { key: "case-accessory", prompt: "Ốp lưng hoặc phụ kiện đi kèm có màu và đặc điểm gì?", questionType: "VISUAL_DETAIL", privacyLevel: "PRIVATE" },
      { key: "masked-device-mark", prompt: "Mô tả một dấu hiệu riêng hoặc một phần mã thiết bị đã che bớt; không gửi IMEI đầy đủ.", questionType: "MASKED_SERIAL", privacyLevel: "HIGHLY_PRIVATE" },
      { key: "loss-context", prompt: "Bạn nhớ lần cuối sử dụng thiết bị ở khu vực và khoảng thời gian nào?", questionType: "TEXT", privacyLevel: "PRIVATE" }
    ]
  },
  {
    id: "computer-device",
    version: 1,
    categoryNames: ["laptop", "may tinh bang", "tui dung laptop"],
    minimumAnswers: 1,
    prompts: [
      { key: "case-sticker", prompt: "Thiết bị hoặc túi đựng có hình dán, vết xước hay phụ kiện riêng nào?", questionType: "VISUAL_DETAIL", privacyLevel: "PRIVATE" },
      { key: "masked-serial", prompt: "Cung cấp một phần serial đã che bớt hoặc dấu hiệu không công khai; không gửi toàn bộ serial.", questionType: "MASKED_SERIAL", privacyLevel: "HIGHLY_PRIVATE" },
      { key: "accessories", prompt: "Thiết bị đi cùng sạc, cáp, bút hoặc phụ kiện nào?", questionType: "TEXT", privacyLevel: "PRIVATE" }
    ]
  },
  {
    id: "wallet-bag",
    version: 1,
    categoryNames: ["vi / bop", "balo", "tui xach", "tui vi & phu kien"],
    minimumAnswers: 1,
    prompts: [
      { key: "material-layout", prompt: "Vật có chất liệu, kiểu khóa và bố cục ngăn như thế nào?", questionType: "VISUAL_DETAIL", privacyLevel: "PRIVATE" },
      { key: "contents-category", prompt: "Bên trong có những nhóm vật dụng nào? Không cung cấp mã tài chính hoặc thông tin đăng nhập.", questionType: "TEXT", privacyLevel: "HIGHLY_PRIVATE" },
      { key: "private-mark", prompt: "Mô tả một dấu hiệu riêng không xuất hiện trong bài đăng công khai.", questionType: "TEXT", privacyLevel: "PRIVATE" }
    ]
  },
  {
    id: "keys-access-card",
    version: 1,
    categoryNames: ["chia khoa", "the xe", "the phong", "moc khoa", "chia khoa & the"],
    minimumAnswers: 1,
    prompts: [
      { key: "key-count-shape", prompt: "Chùm có bao nhiêu chìa hoặc thẻ, hình dạng chính như thế nào?", questionType: "VISUAL_DETAIL", privacyLevel: "PRIVATE" },
      { key: "keychain-detail", prompt: "Móc khóa, dây đeo hoặc dấu hiệu riêng có đặc điểm gì?", questionType: "VISUAL_DETAIL", privacyLevel: "PRIVATE" },
      { key: "use-context", prompt: "Vật thường được dùng ở khu vực hoặc cho mục đích nào?", questionType: "TEXT", privacyLevel: "PRIVATE" }
    ]
  },
  {
    id: "generic-item",
    version: 1,
    categoryNames: [],
    minimumAnswers: 1,
    prompts: [
      { key: "non-public-mark", prompt: "Mô tả một đặc điểm riêng không được nêu trong bài đăng công khai.", questionType: "TEXT", privacyLevel: "PRIVATE" },
      { key: "condition-accessory", prompt: "Vật có tình trạng hoặc phụ kiện đi kèm nào có thể phân biệt?", questionType: "VISUAL_DETAIL", privacyLevel: "PRIVATE" },
      { key: "loss-context", prompt: "Bạn nhớ lần cuối có vật này ở khu vực và khoảng thời gian nào?", questionType: "TEXT", privacyLevel: "PRIVATE" }
    ]
  }
] as const satisfies readonly VerificationQuestionTemplate[];

const prohibitedPromptPatterns = [
  /\b(password|passcode|pin|otp|cvv|cvc)\b/i,
  /m[aậ]t\s*kh[aẩ]u|m[aã]\s*pin|m[aã]\s*otp/i,
  /(to[aà]n\s*b[oộ]|đ[aầ]y\s*đ[uủ]).*(imei|serial|s[oố]\s*th[eẻ]|s[oố]\s*t[aà]i\s*kho[aả]n)/i,
  /private\s*key|seed\s*phrase/i,
  /ignore\s+(all\s+)?(previous|prior)\s+instructions|system\s+prompt|developer\s+message|bypass\s+(safety|policy)/i,
  /bỏ\s+qua\s+(toàn\s+bộ\s+)?hướng\s+dẫn/i
];

export function listVerificationTemplates() {
  return templates;
}

export function resolveVerificationTemplate(categoryName: string, parentCategoryName?: string | null) {
  const normalized = [categoryName, parentCategoryName ?? ""].map((value) => value.trim().toLocaleLowerCase("vi"));
  return templates.find((template) => template.categoryNames.some((name) => normalized.includes(name)))
    ?? templates[templates.length - 1];
}

export function findVerificationPrompt(templateId: string, version: number, promptKey: string) {
  const template = templates.find((item) => item.id === templateId && item.version === version);
  const prompt = template?.prompts.find((item) => item.key === promptKey);
  return template && prompt ? { template, prompt } : null;
}

export function normalizeVerificationPrompt(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function normalizeVerificationAnswer(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
}

export function unsafeVerificationPromptReason(value: string) {
  const prompt = normalizeVerificationPrompt(value);
  if (prompt.length < 10 || prompt.length > 500) return "Câu hỏi phải có từ 10 đến 500 ký tự";
  if (prohibitedPromptPatterns.some((pattern) => pattern.test(prompt))) {
    return "Câu hỏi không được yêu cầu mật khẩu, mã xác thực hoặc mã định danh đầy đủ";
  }
  return null;
}

export function unsafeVerificationReasonReason(value: string) {
  const reason = normalizeVerificationPrompt(value);
  if (reason.length < 3 || reason.length > 1000) return "Lý do phải có từ 3 đến 1000 ký tự";
  if (prohibitedPromptPatterns.some((pattern) => pattern.test(reason)) || /\b\d{8,}\b/.test(reason)) {
    return "Lý do không được chứa đáp án bí mật, thông tin đăng nhập hoặc mã định danh đầy đủ";
  }
  return null;
}
