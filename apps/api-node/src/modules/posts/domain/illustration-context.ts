import { normalizeVietnameseText } from "../../../shared/domain/text.js";

// Curated retrieval corpus: item references only, never user posts or private evidence.
const references = [
  { id: "phone", names: "điện thoại smartphone iphone samsung oppo xiaomi máy tính bảng ipad tablet", features: "màu vỏ, cụm camera, ốp và vết xước" },
  { id: "computer", names: "laptop máy tính macbook bàn phím chuột mouse", features: "màu vỏ, kích thước, bàn phím và sticker" },
  { id: "wallet", names: "ví bóp wallet card holder", features: "màu, chất liệu, hình dáng và khóa kéo" },
  { id: "bag", names: "balo ba lô túi cặp bag backpack túi xách túi đựng laptop túi chống sốc", features: "màu, chất liệu, số ngăn và dây đeo" },
  { id: "keys", names: "chìa khóa chùm chìa key móc khóa smartkey", features: "số chìa, màu và hình dạng móc khóa" },
  { id: "audio", names: "tai nghe airpods headphone earphone loa earbuds", features: "màu, kiểu dáng và hộp đựng" },
  { id: "card", names: "thẻ giấy tờ căn cước bằng lái chứng minh card thẻ xe thẻ phòng thẻ sinh viên", features: "màu và hình dáng chung; thẻ trống, không tên, số, ảnh chân dung hoặc mã" },
  { id: "accessory", names: "đồng hồ vòng nhẫn dây chuyền trang sức kính watch glasses", features: "màu, chất liệu, hình dáng và dây đeo" },
  { id: "bottle", names: "bình nước cốc ly bottle bình giữ nhiệt ly giữ nhiệt tumbler thermos", features: "màu, chất liệu, nắp và tay cầm" },
  { id: "clothes", names: "áo quần mũ nón giày dép jacket shoe hat khoác áo khoác hoodie polo t-shirt", features: "màu, chất liệu, kiểu dáng và họa tiết" },
  { id: "stationery", names: "sách vở bút tài liệu sổ notebook pen book thước giáo trình máy tính cầm tay", features: "màu bìa, kích thước và kiểu đóng gáy; không nội dung cá nhân" },
  { id: "device", names: "sạc cáp usb pin máy ảnh camera ổ cứng sạc dự phòng củ sạc", features: "màu, hình dáng, đầu nối và phụ kiện" },
  { id: "umbrella", names: "ô dù umbrella", features: "màu, kiểu cán, họa tiết và kích thước" }
];

export interface IllustrationContext { id: string; category: string; reference: string; }

// Complete item names avoid matching fragments such as "trang" in "trang suc".
const itemNames: Record<string, string[]> = {
  phone: ["điện thoại", "smartphone", "iphone", "samsung", "oppo", "xiaomi", "máy tính bảng", "ipad", "tablet"],
  computer: ["laptop", "máy tính", "macbook", "bàn phím", "chuột", "mouse"],
  wallet: ["ví", "bóp", "wallet"],
  bag: ["balo", "ba lô", "túi", "cặp", "bag", "backpack", "túi xách", "túi đựng laptop"],
  keys: ["chìa khóa", "chùm chìa", "key", "móc khóa", "smartkey"],
  audio: ["tai nghe", "airpods", "headphone", "earphone", "loa", "earbuds"],
  card: ["thẻ", "giấy tờ", "căn cước", "bằng lái", "chứng minh", "card", "thẻ xe", "thẻ phòng", "thẻ sinh viên"],
  accessory: ["đồng hồ", "vòng", "nhẫn", "dây chuyền", "trang sức", "kính", "watch", "glasses"],
  bottle: ["bình nước", "bình giữ nhiệt", "cốc", "ly", "bottle", "tumbler", "thermos"],
  clothes: ["áo", "quần", "mũ", "nón", "giày", "dép", "jacket", "shoe", "hat", "khoác", "áo khoác", "hoodie", "polo", "t-shirt"],
  stationery: ["sách", "vở", "bút", "tài liệu", "sổ", "notebook", "pen", "book", "thước", "giáo trình", "máy tính cầm tay"],
  device: ["sạc", "cáp", "usb", "pin", "máy ảnh", "camera", "ổ cứng", "sạc dự phòng", "củ sạc"],
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
