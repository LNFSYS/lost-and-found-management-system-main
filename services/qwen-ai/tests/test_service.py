import io
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.main import create_app, decode_image
from app.runner import Runner, ServiceError
from app.schema import parse_analysis

KEY = "unit-test-key-not-a-secret-0123456789"


def test_upload_retains_detail_for_crop_but_bounds_cpu_image():
    settings = Settings(image_edge=672)
    raw = decode_image(image_bytes((1800, 2400)), "image/png", settings)
    with Image.open(io.BytesIO(raw)) as decoded:
        assert max(decoded.size) == 1536
DATA = {"category": "wallet", "object_name": "wallet", "colors": ["black"],
        "material": None, "brand": None, "visible_text": [], "distinctive_features": [],
        "caption": "A black wallet."}


def image_bytes(size=(32, 32)):
    buffer = io.BytesIO()
    Image.new("RGB", size, "black").save(buffer, "PNG")
    return buffer.getvalue()


class FakeRunner:
    state, loaded, last_error = "unloaded", False, None
    info = {"cuda_available": False, "device": None, "quantization": "nf4-fp16"}

    def __init__(self):
        self.calls = []
        self.error = None

    def close(self):
        pass

    def analyze(self, image, post_type, description):
        self.calls.append((image, post_type, description))
        if self.error:
            raise self.error
        return {"status": "success", "model": "Qwen/Qwen3-VL-2B-Instruct", "data": DATA,
                "elapsed_seconds": 0.2, "inference_seconds": 0.1, "warnings": []}


@pytest.fixture
def setup():
    runner = FakeRunner()
    with TestClient(create_app(Settings(api_key=KEY, max_upload_bytes=1024), runner)) as client:
        yield client, runner


def post(client, raw=None, mime="image/png", **kwargs):
    return client.post("/ai/analyze", headers={"Authorization": "Bearer " + KEY},
        files={"image": ("sample.png", raw if raw is not None else image_bytes(), mime)},
        data={"type": "FOUND", **kwargs})


def test_health_is_lazy(setup):
    client, runner = setup
    assert client.get("/health").json()["model_loaded"] is False
    assert not runner.calls


@pytest.mark.parametrize("path,method", [("/ai/model-info", "get"), ("/ai/analyze", "post")])
def test_auth_before_validation(setup, path, method):
    client, runner = setup
    assert getattr(client, method)(path).status_code == 401
    assert getattr(client, method)(path, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert not runner.calls


def test_missing_key_fails_closed():
    with TestClient(create_app(Settings(), FakeRunner())) as client:
        assert client.get("/ai/model-info").status_code == 503


def test_model_info_requires_key(setup):
    client, _ = setup
    response = client.get("/ai/model-info", headers={"Authorization": "Bearer " + KEY})
    assert response.status_code == 200
    assert response.json()["model_id"] == "Qwen/Qwen3-VL-2B-Instruct"


def test_valid_contract_and_context(setup):
    client, runner = setup
    response = post(client, user_description="user claim, not evidence")
    assert response.status_code == 200
    assert response.json()["data"] == parse_analysis(__import__("json").dumps(DATA)).model_dump()
    assert response.json()["confidence"] is None
    assert response.json()["confidence_source"] == "unavailable"
    assert runner.calls[0][1:] == ("FOUND", "user claim, not evidence")
    assert "raw_text" not in response.json()


@pytest.mark.parametrize("raw,mime,status", [(b"invalid", "image/png", 422),
    (image_bytes(), "image/jpeg", 415), (image_bytes(), "text/plain", 415),
    (b"x" * 1025, "image/png", 413)])
def test_invalid_uploads(setup, raw, mime, status):
    client, runner = setup
    assert post(client, raw, mime).status_code == status
    assert not runner.calls


def test_body_limit_without_content_length(setup):
    client, runner = setup
    response = client.post("/ai/analyze", headers={"Authorization": "Bearer " + KEY},
        content=iter([b"x" * 70000]))
    assert response.status_code == 413
    assert not runner.calls


def test_dimensions_limit():
    runner = FakeRunner()
    with TestClient(create_app(Settings(api_key=KEY, max_image_pixels=1024), runner)) as client:
        assert post(client, image_bytes((64, 64))).status_code == 413
        assert not runner.calls


def test_type_and_context_limits(setup):
    client, runner = setup
    assert post(client, type="OTHER").status_code == 422
    assert post(client, user_description="x" * 2001).status_code == 422
    assert not runner.calls


@pytest.mark.parametrize("code,status", [("gpu_out_of_memory", 503), ("inference_timeout", 504),
                                        ("invalid_model_output", 502), ("inference_busy", 429)])
def test_failure_contract(setup, code, status):
    client, runner = setup
    runner.error = ServiceError(code, status)
    response = post(client)
    assert response.status_code == status
    assert response.json()["error"] == code
    assert "data" not in response.json()


def test_strict_model_json():
    import json
    assert parse_analysis("```json\n" + json.dumps(DATA) + "\n```").brand is None
    for bad in ["{", "[]", "{}", json.dumps({**DATA, "colors": "black"}),
                json.dumps({**DATA, "invented": "extra"})]:
        with pytest.raises(ValueError):
            parse_analysis(bad)


# Spawn-safe workers test real process isolation without torch or model weights.
def slow_worker(settings, incoming, outgoing):
    while incoming.get() is not None:
        outgoing.put({"event": "ready", "info": {"device": "fake"}})
        time.sleep(30)


def success_worker(settings, incoming, outgoing):
    while incoming.get() is not None:
        outgoing.put({"event": "ready", "info": {"device": "fake"}})
        outgoing.put({"event": "result", "data": DATA, "inference_seconds": 0.01,
                      "warnings": [], "info": {"device": "fake"}})


def test_timeout_kills_worker_and_recovers():
    runner = Runner(Settings(load_timeout=15, inference_timeout=0.1), worker=slow_worker)
    with pytest.raises(ServiceError, match="inference_timeout"):
        runner.analyze(image_bytes(), "FOUND", "")
    assert runner.process is None
    assert not runner.loaded
    runner.worker = success_worker
    runner.settings.inference_timeout = 5
    try:
        assert runner.analyze(image_bytes(), "LOST", "")["data"] == DATA
        pid = runner.process.pid
        runner.analyze(image_bytes(), "LOST", "")
        assert runner.process.pid == pid  # Resident worker is reused.
    finally:
        runner.close()


def test_busy_does_not_release_active_lock():
    runner = Runner(Settings())
    runner.lock.acquire()
    try:
        with pytest.raises(ServiceError, match="inference_busy"):
            runner.analyze(image_bytes(), "FOUND", "")
        assert runner.lock.locked()
    finally:
        runner.lock.release()
        runner.close()
