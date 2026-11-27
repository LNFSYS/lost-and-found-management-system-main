import json
import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from .prose import describe, observed, sentence_case, object_label

ShortText = Annotated[str, Field(max_length=300)]
TextList = Annotated[list[ShortText], Field(max_length=20)]


class Analysis(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    category: ShortText | None
    object_name: ShortText | None
    colors: TextList
    material: ShortText | None
    brand: ShortText | None
    visible_text: TextList
    distinctive_features: TextList
    caption: Annotated[str, Field(max_length=1500)] | None
    primary_color: ShortText | None = None
    secondary_colors: TextList = Field(default_factory=list)
    shape: ShortText | None = None
    pattern: ShortText | None = None

    @model_validator(mode="after")
    def normalize_evidence(self):
        def unique(values):
            seen, result = set(), []
            for value in values:
                value = " ".join(value.split())
                key = value.casefold().strip(" .;,")
                if key and key not in {"unknown", "null", "không rõ"} and key not in seen:
                    seen.add(key)
                    result.append(value)
            return result

        for field in ("category", "object_name", "material", "brand", "primary_color", "shape", "pattern"):
            value = getattr(self, field)
            if value:
                value = " ".join(value.split())
                setattr(self, field, value)
            if value and value.strip().casefold() in {"unknown", "null", "không rõ"}:
                setattr(self, field, None)
        for field in ("colors", "secondary_colors", "visible_text", "distinctive_features"):
            setattr(self, field, unique(getattr(self, field)))
        self.distinctive_features = [value for value in self.distinctive_features if observed(value)]
        if self.object_name:
            self.object_name = sentence_case(self.object_name)
        if self.primary_color:
            self.colors = unique([self.primary_color, *self.secondary_colors, *self.colors])
            self.secondary_colors = [color for color in self.colors if color.casefold() != self.primary_color.casefold()]
        # Conservative brand evidence gate: a stripe/lookalike logo is insufficient.
        if self.brand and not any(self.brand.casefold() == text.casefold() or
                self.brand.casefold() in text.casefold().split() for text in self.visible_text):
            self.brand = None
        if self.caption:
            sentences = unique(re.split(r"(?<=[.!?])\s+|(?<=[.!?])(?=[A-ZĐÀ-Ỹ])|\n+", self.caption))
            repeated_subject = len(re.findall(re.escape(object_label(self.object_name or "Vật phẩm")), " ".join(sentences), re.I)) > 1
            if len(sentences) > 2 or len(self.caption) > 320 or repeated_subject or not observed(self.caption) or "đặc điểm nhìn thấy:" in self.caption.casefold():
                # Recover a concise draft from existing observations if generation
                # rambles or hits the per-field cap. Never translate/guess new facts.
                details = unique([*self.distinctive_features,
                    *(["dáng " + self.shape] if self.shape else []), *(["họa tiết " + self.pattern] if self.pattern else [])])
                self.caption = describe(self.object_name, self.colors, details)
            else:
                self.caption = sentence_case(" ".join(sentences))
        return self


class AnalysisResponse(BaseModel):
    status: Literal["success"] = "success"
    model: str
    data: Analysis
    elapsed_seconds: float
    inference_seconds: float
    warnings: list[str] = Field(default_factory=list)
    confidence: None = None
    confidence_source: Literal["unavailable"] = "unavailable"


def parse_analysis(text: str) -> Analysis:
    # Permit a single markdown JSON fence, never guess missing/truncated fields.
    clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    def no_duplicate_keys(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise json.JSONDecodeError("Duplicate JSON key", "", 0)
            result[key] = value
        return result
    return Analysis.model_validate(json.loads(clean, object_pairs_hook=no_duplicate_keys))
