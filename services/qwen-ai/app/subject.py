"""Reject people/body parts as lost-property subjects without guessing a replacement."""
import re
import unicodedata


def human_subject(data):
    for field in ("category", "object_name"):
        text = unicodedata.normalize("NFD", data.get(field) or "").casefold()
        text = "".join(c for c in text if not unicodedata.combining(c)).replace("đ", "d")
        text = re.sub(r"^(?:mot |a |the )", "", text.strip())
        if re.match(r"^(?:ban tay|ngon tay|nguoi|hand|hands|finger|person|human)(?:\s|$)", text):
            return True
    return False


def unknown_object():
    return {"category": None, "object_name": None, "colors": [], "material": None,
            "brand": None, "visible_text": [], "distinctive_features": [], "caption": None,
            "primary_color": None, "secondary_colors": [], "shape": None, "pattern": None}
