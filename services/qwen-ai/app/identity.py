"""Format short visual answers without inventing attributes or product models."""
import re

from .schema import Analysis
from .subject import unknown_object, human_subject

LABELS = {
    "mouse": "Chuột máy tính", "computer mouse": "Chuột máy tính",
    "wireless mouse": "Chuột không dây", "keyboard": "Bàn phím",
    "phone": "Điện thoại", "smartphone": "Điện thoại", "mobile phone": "Điện thoại",
    "water bottle": "Bình nước", "bottle": "Chai nước", "thermos": "Bình giữ nhiệt",
    "backpack": "Ba lô", "bag": "Túi", "wallet": "Ví", "purse": "Ví",
    "laptop": "Máy tính xách tay", "headphones": "Tai nghe", "earbuds": "Tai nghe",
    "watch": "Đồng hồ", "keys": "Chìa khóa", "key": "Chìa khóa",
    "glasses": "Kính mắt", "umbrella": "Ô", "book": "Sách", "pen": "Bút",
    "charger": "Bộ sạc", "game controller": "Tay cầm chơi game",
}
COLORS = {"black": "đen", "white": "trắng", "gray": "xám", "grey": "xám",
          "red": "đỏ", "blue": "xanh dương", "green": "xanh lá",
          "yellow": "vàng", "orange": "cam", "pink": "hồng",
          "purple": "tím", "brown": "nâu", "silver": "bạc", "gold": "vàng kim",
          "cream": "kem", "beige": "be", "ivory": "trắng ngà", "navy": "xanh navy",
          "transparent": "trong suốt"}


def clean_identity(text):
    text = re.sub(r"^(?:a|an|the)\s+", "", text.strip().lower()).strip(' ."\n')
    if (text in {"unknown", "unclear", "none", "null", "object"}
            or len(text.split()) > 6 or len(text) > 80):
        return None
    return text or None


def agreed_brand(first, second):
    def clean(value):
        return value.strip().strip('". ').upper()
    a, b = clean(first), clean(second)
    if a != b or a in {"UNKNOWN", "NONE", "NULL", "UNREADABLE"}:
        return None
    if not re.fullmatch(r"[A-Z][A-Z &.-]{1,39}", a) or len(a.split()) > 3:
        return None
    return a


def format_identity(label, color):
    data = unknown_object()
    data.update(category=label, object_name=LABELS.get(label, label))
    if not label or human_subject(data):
        return data
    # Only accept a single supported color answer, never extract a guessed color
    # from a rambling description of the hand or background.
    primary = COLORS.get(color.strip().lower().strip(' ."\n'))
    name = data["object_name"]
    data.update(primary_color=primary, colors=[primary] if primary else [],
                caption=f"{name} màu {primary}." if primary else f"{name}.")
    return Analysis.model_validate(data).model_dump()
