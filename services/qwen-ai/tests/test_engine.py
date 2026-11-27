from types import SimpleNamespace

import torch
from PIL import Image

from app.engine import Engine


def test_oom_retries_smaller_image_and_restores_processor(monkeypatch):
    engine = Engine.__new__(Engine)
    engine.device = "cpu"  # No real GPU allocation or model download in this test.
    engine.processor = SimpleNamespace(image_processor=SimpleNamespace(
        size={"shortest_edge": 4096, "longest_edge": 448**2}))
    engine.info = lambda: {"device": "test"}
    calls, cleanup = [], []

    def generate(image, post_type, description):
        calls.append((image.size, engine.processor.image_processor.size.copy()))
        if len(calls) == 1:
            raise torch.cuda.OutOfMemoryError("simulated")
        return {"caption": None}

    monkeypatch.setattr(engine, "_generate", generate)
    monkeypatch.setattr(torch.cuda, "empty_cache", lambda: cleanup.append(True))
    result = engine.predict(Image.new("RGB", (448, 448)), "FOUND", "")
    assert calls[1][0] == (224, 224)
    assert calls[1][1]["longest_edge"] == 224**2
    assert engine.processor.image_processor.size["longest_edge"] == 448**2
    assert len(cleanup) == 1
    assert result["warnings"]
