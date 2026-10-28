import { normalizeVietnameseText } from "../../../shared/domain/text.js";

// Curated retrieval corpus: item references only, never user posts or private evidence.
const references = [
  { id: "phone", names: "điện thoại smartphone iphone samsung oppo xiaomi", features: "màu vỏ, cụm camera, ốp và vết xước" },
  { id: "computer", names: "laptop máy tính macbook bàn phím chuột mouse", features: "màu vỏ, kích thước, bàn phím và sticker" },
  { id: "wallet", names: "ví bóp wallet", features: "màu, chất liệu, hình dáng và khóa kéo" },
  { id: "bag", names: "balo ba lô túi cặp bag backpack", features: "màu, chất liệu, số ngăn và dây đeo" },
  { id: "keys", names: "chìa khóa chùm chìa key móc khóa", features: "số chìa, màu và hình dạng móc khóa" },
  { id: "audio", names: "tai nghe airpods headphone earphone loa", features: "màu, kiểu dáng và hộp đựng" },
  { id: "card", names: "thẻ giấy tờ căn cước bằng lái chứng minh card", features: "màu và hình dáng chung; thẻ trống, không tên, số, ảnh chân dung hoặc mã" },
  { id: "accessory", names: "đồng hồ vòng nhẫn dây chuyền trang sức kính watch glasses", features: "màu, chất liệu, hình dáng và dây đeo" },
  { id: "bottle", names: "bình nước cốc ly bottle", features: "màu, chất liệu, nắp và tay cầm" },
  { id: "clothes", names: "áo quần mũ nón giày dép jacket shoe hat", features: "màu, chất liệu, kiểu dáng và họa tiết" },
  { id: "stationery", names: "sách vở bút tài liệu sổ notebook pen book", features: "màu bìa, kích thước và kiểu đóng gáy; không nội dung cá nhân" },
  { id: "device", names: "sạc cáp usb pin máy ảnh camera ổ cứng", features: "màu, hình dáng, đầu nối và phụ kiện" },
  { id: "umbrella", names: "ô dù umbrella", features: "màu, kiểu cán, họa tiết và kích thước" }
];

export interface IllustrationContext { id: string; category: string; reference: string; }

// Complete item names avoid matching fragments such as "trang" in "trang suc".
const itemNames: Record<string, string[]> = {
  phone: ["điện thoại", "smartphone", "iphone", "samsung", "oppo", "xiaomi"],
  computer: ["laptop", "máy tính", "macbook", "bàn phím", "chuột", "mouse"],
  wallet: ["ví", "bóp", "wallet"],
  bag: ["balo", "ba lô", "túi", "cặp", "bag", "backpack"],
  keys: ["chìa khóa", "chùm chìa", "key", "móc khóa"],
  audio: ["tai nghe", "airpods", "headphone", "earphone", "loa"],
  card: ["thẻ", "giấy tờ", "căn cước", "bằng lái", "chứng minh", "card"],
  accessory: ["đồng hồ", "vòng", "nhẫn", "dây chuyền", "trang sức", "kính", "watch", "glasses"],
  bottle: ["bình nước", "bình giữ nhiệt", "cốc", "ly", "bottle"],
  clothes: ["áo", "quần", "mũ", "nón", "giày", "dép", "jacket", "shoe", "hat"],
  stationery: ["sách", "vở", "bút", "tài liệu", "sổ", "notebook", "pen", "book"],
  device: ["sạc", "cáp", "usb", "pin", "máy ảnh", "camera", "ổ cứng"],
  umbrella: ["ô", "dù", "umbrella"]
};

export function retrieveIllustrationContext(category: string, description: string): IllustrationContext | null {
  const searchable = (value: string) => ` ${normalizeVietnameseText(value).replace(/[^a-z0-9]+/g, " ").trim()} `;
  const text = searchable(description);
  const categoryText = searchable(category);
  // Only the catalog's catch-all leaf may retrieve by description alone.
  const otherItems = categoryText.trim() === "vat dung khac";
  const ranked = references.map(doc => {
    const terms = (itemNames[doc.id] ?? []).map(searchable);
    return { doc, categoryHits: terms.filter(term => categoryText.includes(term)).length,
      descriptionHits: terms.filter(term => text.includes(term)).length };
  }).filter(item => (otherItems || item.categoryHits > 0) && item.descriptionHits > 0)
    .sort((a, b) => b.categoryHits - a.categoryHits || b.descriptionHits - a.descriptionHits);
  const selected = ranked[0]?.doc;
  return selected ? { id: selected.id, category, reference: `Vật phẩm: ${selected.names}. Đặc điểm quan sát được: ${selected.features}. Chỉ minh họa một vật thể, nền trung tính, không người hoặc khung cảnh.` } : null;
}
