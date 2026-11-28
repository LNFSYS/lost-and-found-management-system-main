/** Normalize repeated evidence without deleting meaningful repeated words inside a sentence. */
export function uniqueEvidence(values: string[]): string[] {
  const seen = new Set<string>();
  return values.map(value => value.normalize("NFC").replace(/\s+/g, " ").trim())
    .filter(value => {
      const key = value.toLocaleLowerCase("vi").replace(/[.!?;,]+$/u, "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function coherentDescription(captions: Array<string | null>): string {
  return uniqueEvidence(captions.flatMap(caption => (caption ?? "").split(/(?<=[.!?])\s+|(?<=[.!?])(?=[A-ZĐÀ-Ỹ])|\n+/u)))
    .map(sentence => sentenceCase(/[.!?]$/u.test(sentence) ? sentence : `${sentence}.`)).join(" ");
}

export function sentenceCase(value: string): string {
  return value.trim().replace(/(^|[.!?]\s+)([\p{L}])/gu, (_match, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase("vi"));
}

export function isObservedDetail(value: string): boolean {
  return !/(?:có thể|dùng để|sử dụng để|dùng làm|công dụng|có lẽ|dường như|possibly|might|could|used for|used to)/iu.test(value);
}

function joinDetails(values: string[]): string {
  return values.length < 2 ? values.join("") : `${values.slice(0, -1).join(", ")} và ${values.at(-1)}`;
}

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function objectLabel(name: string): string {
  return name.trim().replace(/^(?:một\s+)?(?:chiếc|cái)\s+/iu, "")
    .match(/^(?:điện thoại|bình giữ nhiệt|bình nước|balo|ba lô|túi xách|máy tính|ví|bình|chai|cốc)/iu)?.[0]
    ?? name.split(/\s+màu\s+/iu)[0].trim();
}

export function compactDetails(features: string[], objectName: string, subject: string): string[] {
  const prefix = new RegExp(`^(?:một\\s+)?(?:(?:chiếc|cái)\\s+)?${escapePattern(objectLabel(objectName))}(?=\\s|$)\\s*`, "iu");
  const key = (value: string) => value.toLocaleLowerCase("vi").replace(/\bmàu\s+/gu, "")
    .replace(/ở phía /gu, "ở ").replace(/\s+/gu, " ").trim();
  const seen = new Set<string>();
  return features.flatMap(value => value.split(/[,;\n]+/u)).map(value => value.trim().replace(prefix, "")
    .replace(/^có\s+/iu, "").replace(/^(?:được\s+)?làm bằng\s+/iu, "chất liệu ").replace(/[.!?;]+$/u, ""))
    .filter(value => {
      const normalized = key(value);
      if (!normalized || !isObservedDetail(value) || /(?:được cầm|cầm bằng tay)/iu.test(value)
        || key(subject).includes(normalized) || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

export function polishedDescription(captions: Array<string | null>, objectName: string | null, colors: string[], features: string[]): string {
  const prose = coherentDescription(captions);
  const sentences = prose.split(/(?<=[.!?])\s+/u).filter(Boolean);
  const label = objectLabel(objectName || "Vật phẩm");
  const repetitions = prose.match(new RegExp(escapePattern(label), "giu"))?.length ?? 0;
  if (prose && prose.length <= 320 && repetitions <= 1 && sentences.length <= 2 && isObservedDetail(prose) && !/Đặc điểm nhìn thấy:/iu.test(prose)) return prose;
  let subject = sentenceCase(objectName || "Vật phẩm").replace(/[.!?]+$/u, "");
  const additionalColors = uniqueEvidence(colors).filter(isObservedDetail)
    .filter(color => !subject.toLocaleLowerCase("vi").includes(color.toLocaleLowerCase("vi")));
  if (additionalColors.length) subject += ` màu ${joinDetails(additionalColors)}`;
  const details: string[] = [];
  for (const detail of compactDetails(features.length ? features : sentences, objectName || "Vật phẩm", subject)) {
    if (details.length >= 10) break;
    if (`${subject}, có ${joinDetails([...details, detail])}.`.length <= 500) details.push(detail);
  }
  const surfaces = details.filter(value => /^bề mặt\s+/iu.test(value))
    .map(value => value.replace(/^bề mặt\s+/iu, ""));
  const structure = details.filter(value => !/^bề mặt\s+/iu.test(value))
    .map(value => value.replace(/^Thân\b/u, "thân"));
  return `${subject}${structure.length ? `, có ${joinDetails(structure)}` : ""}.`
    + (surfaces.length ? ` Bề mặt ${joinDetails(surfaces)}.` : "");
}

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("vi").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();

// Names from 008_seed_item_categories.sql; IDs always come from the live catalog.
const aliases = [
  ["computer mouse", "mouse", "wireless mouse", "wired mouse", "gaming mouse", "keyboard", "computer keyboard", "chuot", "chuot may tinh", "chuot khong day", "chuot co day", "ban phim", "chuot ban phim"],
  ["backpack", "rucksack", "balo", "ba lo"],
  ["wallet", "vi", "bop", "vi bop"],
  ["handbag", "tui xach"],
  ["laptop bag", "laptop sleeve", "tui dung laptop"],
  ["phone", "smartphone", "mobile phone", "dien thoai"],
  ["laptop", "may tinh xach tay"],
  ["headphones", "earphones", "earbuds", "tai nghe"],
  ["water bottle", "drinking bottle", "insulated bottle", "thermal bottle", "thermos",
    "vacuum flask", "thermos flask", "binh nuoc", "binh giu nhiet", "chai nuoc", "binh dung nuoc"],
];

export function isHumanSubject(value: string | null): boolean {
  return /^(?:ban tay|ngon tay|nguoi|hand|hands|finger|person|human)(?: |$)/.test(normalized(value ?? ""));
}

export function resolveQwenCategory(evidence: Array<string | null>, catalogNames: string[]): string {
  const detected = evidence.map(value => normalized(value ?? "").replace(/\s+mau\s+.+$/, "")).filter(Boolean);
  const matches = catalogNames.filter(name => {
    const target = normalized(name);
    return detected.some(value => value === target || aliases.some(group => group.includes(value) && group.includes(target)));
  });
  return matches.length === 1 ? matches[0] : "";
}
