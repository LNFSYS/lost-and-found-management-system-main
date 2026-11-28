"""Conservative wording cleanup; no new model call or new visual claims."""
import re


def sentence_case(text):
    return re.sub(r"(^|[.!?]\s+)([^\W\d_])", lambda m: m[1] + m[2].upper(), text.strip())


def observed(text):
    return not re.search(r"có thể|dùng để|sử dụng để|dùng làm|công dụng|có lẽ|dường như|possibly|might|could|used for|used to", text, re.I)


def joined(values):
    return values[0] if len(values) == 1 else ", ".join(values[:-1]) + " và " + values[-1] if values else ""


def object_label(name):
    name = re.sub(r"^(?:một\s+)?(?:chiếc|cái)\s+", "", name.strip(), flags=re.I)
    match = re.match(r"điện thoại|bình giữ nhiệt|bình nước|balo|ba lô|túi xách|máy tính|ví|bình|chai|cốc", name, re.I)
    return match[0] if match else re.split(r"\s+màu\s+", name, flags=re.I)[0]


def compact_details(details, object_name, subject):
    prefix = r"^(?:một\s+)?(?:(?:chiếc|cái)\s+)?" + re.escape(object_label(object_name or "Vật phẩm")) + r"(?=\s|$)\s*"
    def key(value):
        return re.sub(r"\bmàu\s+", "", value.casefold()).replace("ở phía ", "ở ").strip()
    seen, result = set(), []
    for value in details:
        for detail in re.split(r"[,;\n]+", value):
            detail = re.sub(prefix, "", detail.strip(), flags=re.I)
            detail = re.sub(r"^có\s+", "", detail, flags=re.I).strip().rstrip(".!?;")
            detail = re.sub(r"^(?:được\s+)?làm bằng\s+", "chất liệu ", detail, flags=re.I)
            normalized = key(detail)
            if not normalized or not observed(detail) or re.search(r"được cầm|cầm bằng tay", detail, re.I):
                continue
            if normalized not in seen and normalized not in key(subject):
                result.append(detail)
                seen.add(normalized)
    return result


def describe(object_name, colors, details):
    subject = sentence_case(object_name or "Vật phẩm").rstrip(".!?")
    colors = [color for color in colors if observed(color) and color.casefold() not in subject.casefold()]
    if colors:
        subject += " màu " + joined(colors)
    kept = []
    for detail in compact_details(details, object_name, subject):
        if len(kept) >= 10:
            break
        if len(subject + ", có " + joined([*kept, detail]) + ".") <= 500:
            kept.append(detail)
    return subject + (", có " + joined(kept) if kept else "") + "."
