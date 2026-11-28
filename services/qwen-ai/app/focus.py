"""Validate Qwen's normalized box before using it for an inference-only crop."""
import re

from PIL import Image


def focus_crop(image, text, edge, *, text_region=False):
    boxes = re.findall(r"\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]", text)
    if len(boxes) != 1:
        return None
    x1, y1, x2, y2 = map(int, boxes[0])
    if not (0 <= x1 < x2 <= 1000 and 0 <= y1 < y2 <= 1000):
        return None
    area = (x2 - x1) * (y2 - y1) / 1_000_000
    if not (0.002 if text_region else 0.06) <= area <= 0.88 or min(x2 - x1, y2 - y1) < (20 if text_region else 100):
        return None
    # Small margin prevents tight boxes from cutting off buttons/straps.
    w, h = image.size
    margin = 15 if text_region else 35
    bounds = (max(0, x1 - margin) * w // 1000, max(0, y1 - margin) * h // 1000,
              min(1000, x2 + margin) * w // 1000, min(1000, y2 + margin) * h // 1000)
    crop = image.crop(bounds)
    crop.thumbnail((edge, edge), Image.Resampling.LANCZOS)
    return crop
