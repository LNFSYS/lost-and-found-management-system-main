export const CONTACT_PHOTO_MINIMUM_SCORE = 0.5;

export function contactPhotoQuestions(analysis: { title: string; visualAttributes: string[]; suggestedCategory?: { name: string } | null }) {
  const signals = [analysis.title, analysis.suggestedCategory?.name ?? "", ...analysis.visualAttributes].join(" ").toLocaleLowerCase("vi-VN");
  let detail = "Vật phẩm có chất liệu, hình dáng và phụ kiện đi kèm như thế nào?";
  if (/điện thoại|phone|camera|máy tính|laptop|tablet/.test(signals)) {
    detail = "Vật phẩm có kiểu dáng, bố cục camera hoặc cổng kết nối và phụ kiện như thế nào?";
  } else if (/balo|túi|ví|wallet|bag|zipper|khóa kéo/.test(signals)) {
    detail = "Vật phẩm có chất liệu, kiểu khóa và bố cục các ngăn như thế nào?";
  } else if (/áo|quần|giày|shirt|shoe|clothing/.test(signals)) {
    detail = "Vật phẩm có kiểu dáng, kích cỡ và họa tiết ở vị trí nào?";
  }
  // Do not disclose the expected answer or OCR data in a suggested question.
  const condition = /trầy|xước|rách|stain|scratch|damage/.test(signals)
    ? "Vật phẩm có vết trầy, vết bẩn hoặc dấu hư hỏng nào? Chúng nằm ở đâu?"
    : "Vật phẩm có màu sắc, dấu hiệu riêng hoặc phụ kiện nào để phân biệt?";
  return [detail, condition, "Bạn có thể mô tả một đặc điểm riêng không xuất hiện trong bài đăng công khai không?"];
}
