"""Bound and format model observations; never promote speculative attributes."""
import re

from .prose import describe, observed, joined
from .schema import Analysis

# These are translations of observed concepts, not attributes inferred from an
# object category. An unrecognized phrase is omitted rather than mistranslated.
VISUAL_TERMS = [
    (r"\b(?:dual|two|2)[ -](?:rear[ -])?cameras?\b", "Có cụm camera kép"),
    (r"\b(?:triple|three|3)[ -](?:rear[ -])?cameras?\b", "Có cụm ba camera"),
    (r"\b(?:rear|back)[ -]cameras?\b", "Có camera mặt sau"),
    (r"\b(?:black|dark)[ -](?:lid|cap)\b", "Có nắp màu đen"),
    (r"\bwhite[ -](?:lid|cap)\b", "Có nắp màu trắng"),
    (r"\b(?:red)[ -](?:rim|frame|edge|border)\b", "Có viền màu đỏ"),
    (r"\b(?:chipped|peeling)[ -]paint\b", "Có chỗ bong tróc sơn"),
    (r"\b(?:white)[ -](?:glide[ -]|rubber[ -])?pads?\b", "Có miếng đệm màu trắng"),
    (r"\bscroll wheel\b", "Có con lăn"),
    (r"\b(?:optical )?sensor\b", "Có cảm biến"),
    (r"\bside buttons?\b", "Có nút bấm bên hông"),
    (r"\bbuttons?\b", "Có nút bấm"),
    (r"\b(?:glide|rubber|white|skate) pads?\b|\bmouse feet\b", "Có miếng đệm"),
    (r"\bzipper\b|\bzips?\b", "Có khóa kéo"),
    (r"\bshoulder straps?\b", "Có quai đeo vai"),
    (r"\bstraps?\b", "Có dây đeo"),
    (r"\bhandles?\b", "Có tay cầm"),
    (r"\bpockets?\b", "Có ngăn túi"),
    (r"\bbuckles?\b", "Có khóa cài"),
    (r"\blid\b|\bcap\b", "Có nắp"),
    (r"\bspout\b", "Có vòi uống"),
    (r"\bkey\s*ring\b", "Có vòng móc chìa khóa"),
    (r"\bscreen\b|\bdisplay\b", "Có màn hình"),
    (r"\bcamera\b", "Có cụm camera"),
    (r"\bcable\b|\bcord\b", "Có dây cáp"),
    (r"\bkeyboard\b", "Có bàn phím"),
    (r"\blens(?:es)?\b", "Có tròng kính"),
    (r"\blogo\b", "Có logo"),
    (r"\bbar\s?code\b", "Có mã vạch"),
    (r"\btext\b|\blettering\b|\blabel\b", "Có chữ hoặc nhãn in"),
    (r"\bsymbols?\b|\bregulatory marks\b", "Có ký hiệu in trên bề mặt"),
    (r"\bscratches\b|\bscratched\b", "Bề mặt có vết trầy"),
    (r"\bwear\b|\bworn\b", "Bề mặt có dấu mòn"),
    (r"\bcracks?\b|\bcracked\b", "Có vết nứt"),
    (r"\bdents?\b|\bdented\b", "Có vết móp"),
    (r"\bstains?\b|\bstained\b", "Có vết bẩn"),
    (r"\bpeeling\b", "Bề mặt có chỗ bong tróc"),
    (r"\bstickers?\b", "Có nhãn dán"),
    (r"\bmatte\b", "Bề mặt nhám mờ"),
    (r"\bglossy\b|\bshiny\b|\bgloss\b", "Bề mặt bóng"),
    (r"\bsmooth\b", "Bề mặt nhẵn"),
    (r"\btextured\b|\bridged\b", "Có bề mặt tạo vân"),
    (r"\bstripes?\b|\bstriped\b", "Có họa tiết sọc"),
    (r"\bfloral\b", "Có họa tiết hoa"),
    (r"\bcheckered\b|\bplaid\b", "Có họa tiết kẻ ô"),
    (r"\btransparent\b|\bsee-through\b", "Có phần trong suốt"),
    (r"\bcurved\b|\brounded\b", "Thân có đường cong bo tròn"),
    (r"\brectangular\b", "Có chi tiết hình chữ nhật"),
]


def localized_features(verified):
    result = []
    for line in verified:
        # A negative or comparative clause must not turn into a positive fact.
        if re.search(r"\b(?:no|not|without|unlike|like|resembl\w*|minimal)\b", line, re.I):
            continue
        for pattern, vietnamese in VISUAL_TERMS:
            if re.search(pattern, line, re.I) and vietnamese not in result:
                if vietnamese == "Có con lăn" and re.search(r"textured|ridged", line, re.I):
                    vietnamese = "Có con lăn tạo vân"
                if vietnamese == "Có bề mặt tạo vân" and re.search(r"scroll wheel", line, re.I):
                    continue
                if vietnamese == "Có nút bấm" and "Có nút bấm bên hông" in result:
                    continue
                if vietnamese == "Có dây đeo" and "Có quai đeo vai" in result:
                    continue
                if vietnamese == "Có cụm camera" and any("camera" in item for item in result):
                    continue
                if vietnamese == "Có nắp" and any("nắp màu" in item for item in result):
                    continue
                if vietnamese == "Có miếng đệm" and "Có miếng đệm màu trắng" in result:
                    continue
                result.append(vietnamese)
    return result[:8]


def visual_candidates(text):
    """Split compound claims so a wrong label cannot discard a visible sensor."""
    result = []
    seen = set()
    for line in feature_lines(text, limit=6):
        if re.search(r"\b(?:no|not|without|unlike|like|resembl\w*|minimal)\b", line, re.I):
            continue
        for pattern, _ in VISUAL_TERMS:
            match = re.search(pattern, line, re.I)
            if match and match[0].lower() not in seen:
                concept = match[0].lower()
                seen.add(concept)
                result.append(concept)
    return result[:8]


def feature_lines(text, limit=3):
    result = []
    for line in text.splitlines():
        line = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", line).strip().rstrip(".;")
        if not line or len(line) > 220 or not observed(line):
            continue
        if re.search(r"\b(?:maybe|probably|appears|resembles|resembling|likely|unknown)\b", line, re.I):
            continue
        if re.search(r"\b(?:hand|finger|person|background|serial number)\b|bàn tay|ngón tay|số sê.?ri", line, re.I):
            continue
        if line.casefold() not in {value.casefold() for value in result}:
            result.append(line)
        if len(result) == limit:
            break
    return result


def confirmed(text):
    return text.strip().lower().strip(".!") == "yes"


def add_details(data, features):
    data = dict(data)
    data["distinctive_features"] = features
    # Labels are capitalized in chips, but clauses inside a sentence are not.
    clauses = [value[:1].lower() + value[1:] for value in features]
    structure = [value for value in clauses if not value.startswith("bề mặt")]
    surface = [value for value in clauses if value.startswith("bề mặt")]
    for text in data.get("visible_text", []):
        structure.append(f'có chữ “{text}”')
    data["caption"] = describe(data["object_name"], data["colors"], structure)
    if surface:
        data["caption"] += " Bề mặt " + joined([value.removeprefix("bề mặt ") for value in surface]) + "."
    return Analysis.model_validate(data).model_dump()
