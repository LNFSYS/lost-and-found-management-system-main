from types import SimpleNamespace

import torch
from PIL import Image

from app.engine import Engine
from app.subject import human_subject
import pytest


def test_short_visual_tasks_keep_requests_independent(monkeypatch):
    engine = Engine.__new__(Engine)
    engine.settings = SimpleNamespace(image_edge=672)
    engine.processor = SimpleNamespace(image_processor=SimpleNamespace(size={"longest_edge":672**2}))
    answers = iter(["mouse", "unknown", "black", "top", "Raised scroll wheel", "", "", "yes", "unknown",
                    "water bottle", "unknown", "blue", "side", "A cap", "", "", "yes", "unknown", "unknown"])
    prompts = []
    def answer(image, prompt, max_tokens=24):
        prompts.append(prompt)
        return next(answers)
    monkeypatch.setattr(engine, "_answer", answer)
    monkeypatch.setattr(engine, "_read_lettering", lambda *args: [])
    image = Image.new("RGB", (32,32))
    assert engine._generate(image, "LOST", "a wallet")["object_name"] == "Chuột máy tính"
    assert engine._generate(image, "FOUND", "a phone")["object_name"] == "Bình nước"
    assert engine._generate(image, "FOUND", "mouse")["object_name"] is None
    assert len(prompts) == 19
    assert "wallet" not in prompts[0]
    assert "mouse" not in prompts[9]


def test_crop_identifying_different_object_falls_back_to_overview(monkeypatch):
    engine = Engine.__new__(Engine)
    answers = iter(["mouse", "[100,100,800,800]", "backpack"])
    monkeypatch.setattr(engine, "_answer", lambda *args: next(answers))
    seen = []
    monkeypatch.setattr(engine, "_inspect_details", lambda overview, crop, label, **kwargs: seen.append((overview is crop, label)))
    image = Image.new("RGB", (300,400))
    engine._inspect_views(image, image, 672, False)
    assert seen == [(True, "mouse")]


@pytest.mark.parametrize("label", ["Bàn tay cầm", "Một bàn tay", "A hand holding", "Người đàn ông"])
def test_body_subject_detection(label):
    assert human_subject({"object_name": label})
    assert not human_subject({"object_name": "Tay cầm chơi game", "category": "game controller"})


@pytest.mark.parametrize("recovered", [True, False])
def test_subject_retry_is_bounded_and_does_not_reuse_previous_request(monkeypatch, recovered):
    engine = Engine.__new__(Engine)
    engine.device = "cpu"
    engine.info = lambda: {}
    calls = []
    def generate(image, kind, description, *, focus_retry=False):
        calls.append(focus_retry)
        return {"object_name": "Chuột máy tính" if recovered and focus_retry else "Bàn tay cầm"}
    monkeypatch.setattr(engine, "_generate", generate)
    for _ in range(2):
        result = engine.predict(Image.new("RGB", (32, 32)), "LOST", "")
        assert result["data"]["object_name"] == ("Chuột máy tính" if recovered else None)
        if not recovered:
            assert result["data"]["distinctive_features"] == []
    assert calls == [False, True, False, True]


def test_valid_subject_needs_no_extra_inference(monkeypatch):
    engine = Engine.__new__(Engine)
    engine.device = "cpu"
    engine.info = lambda: {}
    calls = []
    def generate(*args):
        calls.append(True)
        return {"object_name": "Bình nước", "category": "water bottle"}
    monkeypatch.setattr(engine, "_generate", generate)
    assert engine.predict(Image.new("RGB", (32, 32)), "LOST", "")["data"]["object_name"] == "Bình nước"
    assert len(calls) == 1


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
