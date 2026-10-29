type ConditionKnowledge = { id: string; title: string; keywords: string[]; guidance: string };

const knowledge: ConditionKnowledge[] = [
  {
    id: "visual-basics",
    title: "Nguyên tắc ghi nhận tình trạng bằng quan sát",
    keywords: ["tình trạng", "ảnh", "nhận", "xước", "móp", "nứt", "bẩn", "hư hỏng"],
    guidance: "Chỉ ghi dấu hiệu nhìn thấy rõ; mô tả vị trí và mức độ tương đối. Tách điều quan sát được khỏi điều chưa chắc chắn. Không suy luận chức năng bên trong, nguồn gốc, thời gian hư hỏng hoặc quyền sở hữu. Ảnh không đủ rõ thì nói chưa thể xác định và yêu cầu nhân viên kiểm tra trực tiếp."
  },
  {
    id: "electronics",
    title: "Thiết bị điện tử",
    keywords: ["điện thoại", "laptop", "máy tính", "tablet", "máy tính bảng", "tai nghe", "camera", "đồng hồ thông minh", "thiết bị", "màn hình", "cổng sạc"],
    guidance: "Quan sát vỏ, góc cạnh, màn hình, cụm camera, nút và cổng kết nối. Ghi vết xước, nứt, móp, bẩn hoặc phụ kiện chỉ khi nhìn thấy. Không kết luận thiết bị bật được, sạc được, chống nước hay hoạt động bình thường từ ảnh tĩnh."
  },
  {
    id: "bags-and-fabric",
    title: "Balo, túi và vật phẩm bằng vải",
    keywords: ["balo", "ba lô", "túi", "ví", "vải", "dây kéo", "khóa kéo", "quai", "dây đeo", "đường may"],
    guidance: "Quan sát mặt vải, góc đáy, quai, khóa kéo và đường may. Ghi vết rách, sờn, bẩn, phai màu hoặc phụ kiện nhìn rõ; không khẳng định khóa hay đường may còn sử dụng tốt nếu chưa kiểm tra trực tiếp."
  },
  {
    id: "paper-and-cards",
    title: "Sách, giấy tờ và thẻ",
    keywords: ["sách", "vở", "giấy", "thẻ", "tài liệu", "card", "bìa", "trang"],
    guidance: "Chỉ mô tả bìa, góc, mép, nếp gấp, vết rách hoặc vết bẩn quan sát được. Không đọc hoặc đưa số giấy tờ, mã thẻ, mã QR, barcode hay thông tin cá nhân vào ghi chú tình trạng."
  },
  {
    id: "containers",
    title: "Bình, chai và hộp đựng",
    keywords: ["bình", "chai", "ly", "hộp", "nắp", "nhựa", "kim loại", "thủy tinh"],
    guidance: "Quan sát thân, đáy, nắp và miệng bình để ghi vết nứt, móp, trầy hoặc bẩn nhìn thấy. Không suy luận độ kín, vệ sinh bên trong, chất lỏng bên trong hoặc an toàn sử dụng từ ảnh."
  },
  {
    id: "small-items",
    title: "Kính, chìa khóa và phụ kiện nhỏ",
    keywords: ["kính", "chìa khóa", "móc khóa", "dây chuyền", "nhẫn", "phụ kiện", "ốp", "sticker"],
    guidance: "Quan sát số lượng, hình dạng, màu, bộ phận đi kèm và vết cong, nứt, xước hoặc bong tróc. Không phỏng đoán vật liệu hay giá trị nếu ảnh không thể hiện rõ."
  }
];

const stopWords = new Set("va voi cua cho la mot nhung cac va tai trong co duoc khi tren duoi nay do nay nhu".split(" "));

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
}

function tokens(value: string) {
  return normalize(value).match(/[a-z0-9]+/g)?.filter(token => token.length > 1 && !stopWords.has(token)) ?? [];
}

/** Small in-process RAG corpus: retrieve warehouse inspection guidance relevant to the item context. */
export function retrieveWarehouseConditionKnowledge(query: string, limit = 3) {
  const queryTerms = new Set(tokens(query));
  const documentTerms = knowledge.map(entry => new Set(tokens(`${entry.title} ${entry.keywords.join(" ")} ${entry.guidance}`)));
  const documentFrequency = new Map<string, number>();
  for (const terms of documentTerms) for (const term of terms) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);

  const ranked = knowledge.map((entry, index) => {
    let score = 0;
    for (const term of queryTerms) {
      if (!documentTerms[index]!.has(term)) continue;
      const idf = Math.log(1 + knowledge.length / (documentFrequency.get(term) ?? 1));
      const keywordBoost = tokens(entry.keywords.join(" ")).includes(term) ? 2 : 1;
      score += idf * keywordBoost;
    }
    return { ...entry, score };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const general = ranked.find(entry => entry.id === "visual-basics")!;
  return [general, ...ranked.filter(entry => entry.id !== general.id && entry.score > 0).slice(0, Math.max(0, limit - 1))]
    .map(({ id, title, guidance }) => ({ id, title, guidance }));
}
