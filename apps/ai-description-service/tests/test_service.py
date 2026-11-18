from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageFilter

from app.classifier import MobileNetClassifier, preprocess
from app.main import create_app

ROOT = Path(__file__).resolve().parents[1]
REAL_IMAGE = ROOT.parent / "web" / "tests" / "fixtures" / "appointment-item.png"
KEY = "test-description-key"


@pytest.fixture(scope="module")
def client():
    classifier = MobileNetClassifier()
    app = create_app(classifier=classifier, api_key=KEY)
    with TestClient(app) as test_client:
        yield test_client


def test_health_and_readiness(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/ready").status_code == 401
    response = client.get("/ready", headers={"X-AI-Service-Key": KEY})
    assert response.status_code == 200
    assert response.json()["provider"] == "CPUExecutionProvider"
    assert response.json()["cpu_threads"] == 1
    assert response.json()["labels"] == 12


def test_fixture_image_returns_three_editable_suggestions(client):
    with REAL_IMAGE.open("rb") as image:
        response = client.post("/v1/describe", headers={"X-AI-Service-Key": KEY},
                               files=[("files", ("item.png", image, "image/png"))])
    assert response.status_code == 200
    result = response.json()
    assert len(result["top3"]) == 3
    assert result["category_name"] == result["top3"][0]["label"]
    assert result["confidence"] == result["top3"][0]["confidence"]
    assert all(0 <= item["confidence"] <= 1 for item in result["top3"])
    assert result["top3"] == sorted(result["top3"], key=lambda item: item["confidence"], reverse=True)
    assert result["requires_confirmation"] is True
    assert result["confidence_calibrated"] is False
    assert result["score_kind"] == "uncalibrated_softmax"
    assert "uncalibrated" in result["score_kind"]
    assert result["inference_ms"] > 0
    assert result["model_version"].startswith("mobilenetv3-small-lnfs-v1:")


def test_closed_set_score_stays_a_human_confirmed_suggestion(client):
    """A closed-set score is never a verified category."""
    with REAL_IMAGE.open("rb") as image:
        response = client.post("/v1/describe", headers={"X-AI-Service-Key": KEY},
                               files=[("files", ("item.png", image, "image/png"))])
    assert response.status_code == 200
    result = response.json()
    assert result["requires_confirmation"] is True
    assert result["confidence_calibrated"] is False
    assert any("12" in warning for warning in result["warnings"])
    assert result["score_kind"] == "uncalibrated_softmax"


def test_blurred_real_image_keeps_the_same_safe_contract(client):
    with REAL_IMAGE.open("rb") as image:
        blurred = Image.open(image).convert("RGB").filter(ImageFilter.GaussianBlur(radius=8))
    payload = BytesIO()
    blurred.save(payload, format="JPEG", quality=80)
    response = client.post("/v1/describe", headers={"X-AI-Service-Key": KEY},
                           files=[("files", ("blurred.jpg", payload.getvalue(), "image/jpeg"))])
    assert response.status_code == 200
    result = response.json()
    assert len(result["top3"]) == 3
    assert result["requires_confirmation"] is True
    assert result["confidence_calibrated"] is False


def test_multiple_real_views_are_aggregated_without_changing_confirmation(client):
    image_bytes = REAL_IMAGE.read_bytes()
    response = client.post("/v1/describe", headers={"X-AI-Service-Key": KEY}, files=[
        ("files", ("view-1.png", image_bytes, "image/png")),
        ("files", ("view-2.png", image_bytes, "image/png")),
    ])
    assert response.status_code == 200
    result = response.json()
    assert result["inference_images"] == 2
    assert len(result["top3"]) == 3
    assert result["requires_confirmation"] is True
    assert result["confidence_calibrated"] is False


def test_auth_type_and_corrupt_image_are_rejected(client):
    with REAL_IMAGE.open("rb") as image:
        assert client.post("/v1/describe", files=[("files", ("item.png", image, "image/png"))]).status_code == 401
    assert client.post("/v1/describe", headers={"X-AI-Service-Key": KEY},
                       files=[("files", ("bad.svg", b"<svg/>", "image/svg+xml"))]).status_code == 415
    assert client.post("/v1/describe", headers={"X-AI-Service-Key": KEY},
                       files=[("files", ("bad.jpg", b"not an image", "image/jpeg"))]).status_code == 400


def test_inference_failure_returns_generic_unavailable_without_fake_score():
    class FailingClassifier:
        session = object()
        labels = ["label"] * 12
        version = "test-model"

        def load(self):
            return None

        def predict(self, _images):
            raise RuntimeError("private model failure details")

    app = create_app(classifier=FailingClassifier(), api_key=KEY)
    with TestClient(app) as test_client, REAL_IMAGE.open("rb") as image:
        response = test_client.post("/v1/describe", headers={"X-AI-Service-Key": KEY},
                                    files=[("files", ("item.png", image, "image/png"))])
    assert response.status_code == 503
    assert response.json() == {"detail": "Image classification unavailable"}
    assert "confidence" not in response.json()
    assert "private model failure details" not in response.text


def test_preprocess_outputs_finite_chw_tensor():
    tensor = preprocess(Image.new("RGB", (400, 200), (40, 120, 220)), 224,
                       [0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    assert tensor.shape == (3, 224, 224)
    assert tensor.dtype.name == "float32"
    assert tensor.min() > -3 and tensor.max() < 3
