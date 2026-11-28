"""Literal, bounded OCR agreement. Never correct a model name from prior knowledge."""
import re
import unicodedata

READ_TEXT = (
    "Read the clearly legible words printed on the foreground object. Copy brand names, "
    "product names and short labels exactly, one line per label. Do not identify the object, "
    "correct spelling, expand abbreviations or guess missing letters. Ignore the background. "
    "Exclude serial numbers, IMEI, phone numbers and personal information. "
    "If no printed words are readable, answer unknown."
)


def text_lines(text):
    result = []
    for line in text.splitlines():
        line = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", line).strip().strip('"`')
        if not 2 <= len(line) <= 90 or not any(c.isalpha() for c in line):
            continue
        if re.search(r"unknown|unreadable|unclear|not visible|no text|cannot|can't|serial|imei|s/n|https?://|@", line, re.I):
            continue
        if re.search(r"\d{6,}", line) or len(line.split()) > 12:
            continue
        if line.casefold() not in {value.casefold() for value in result}:
            result.append(line)
    return result[:8]


def tokens(text):
    return re.findall(r"[\w]+(?:[&+.-][\w]+)*", unicodedata.normalize("NFKC", text).upper())


def agreed_text(first, second):
    """Retain contiguous literal words seen in both reads, no fuzzy correction."""
    a, b = text_lines(first), text_lines(second)
    matches = {tuple(tokens(line)) for line in b}
    result = []
    for line in a:
        words = tokens(line)
        phrase = " ".join(words)
        if tuple(words) in matches and len(phrase) >= 3 and phrase not in result:
            result.append(phrase)
    return result[:6]


def logo_details(first, second):
    """Describe agreed shapes without turning a resemblance into a brand claim."""
    shapes = [
        (r"\bapple\b", "Logo hình quả táo"),
        (r"\bsnake", "Logo hình rắn"),
        (r"\b(?:three|3)\s+stripes?\b", "Logo có ba sọc"),
        (r"\b(?:circle|circular)\b", "Logo dạng tròn"),
        (r"\bstar\b", "Logo hình ngôi sao"),
        (r"\btriangle|triangular\b", "Logo hình tam giác"),
    ]
    if any(re.search(r"\b(?:unknown|no|not|without|unclear|maybe|possibly|resembles|resembling)\b", value, re.I) for value in (first, second)):
        return []
    return [vi for pattern, vi in shapes if all(re.search(pattern, value, re.I) for value in (first, second))][:2]
